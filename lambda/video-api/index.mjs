import { S3Client } from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

const s3 = new S3Client({}); // region auto from Lambda
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

function pickCorsOrigin(event) {
  const origins = (process.env.CORS_ORIGINS || "*").split(",").map(s => s.trim());
  const reqOrigin = event?.headers?.origin || event?.headers?.Origin;
  if (origins.includes("*")) return "*";
  if (reqOrigin && origins.includes(reqOrigin)) return reqOrigin;
  return origins[0] || "*";
}

function cors(event, status, body) {
  const origin = pickCorsOrigin(event);
  return {
    statusCode: status,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization,Content-Type",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : "",
  };
}

export const handler = async (event) => {
  // ---- Top-level request logging ----
  const method = event?.requestContext?.http?.method || "UNKNOWN";
  const path = event?.requestContext?.http?.path || "UNKNOWN";
  const origin = event?.headers?.origin || event?.headers?.Origin || "";
  console.log("video-api request", {
    method,
    path,
    origin,
    hasAuthz: !!(event?.headers?.authorization || event?.headers?.Authorization),
  });

  if (method === "OPTIONS") {
    console.log("CORS preflight handled");
    return cors(event, 204);
  }

  if (method !== "GET") {
    console.warn("Method not allowed:", method);
    return cors(event, 405, { error: "Method not allowed" });
  }

  if (path !== "/upload-url") {
    console.warn("Not found path:", path);
    return cors(event, 404, { error: "Not found" });
  }

  try {
    // ---- env sanity ----
    const envOk = {
      has_INPUT_BUCKET: !!process.env.INPUT_BUCKET,
      has_SUPABASE_URL: !!process.env.SUPABASE_URL,
      has_SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      has_UPLOAD_SIGNING_SECRET: !!process.env.UPLOAD_SIGNING_SECRET,
      cors_origins: process.env.CORS_ORIGINS || "",
    };
    console.log("env sanity", envOk);

    // ---- authenticate via Supabase JWT ----
    const authz = event.headers?.authorization || event.headers?.Authorization;
    if (!authz?.startsWith("Bearer ")) {
      console.warn("Missing token");
      return cors(event, 401, { error: "Missing token" });
    }
    const token = authz.slice("Bearer ".length);

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      console.warn("Invalid token", { error: error?.message });
      return cors(event, 401, { error: "Invalid token" });
    }
    const userId = data.user.id;
    console.log("authed user", { userId });

    // ---- build signed upload intent ----
    const key = `uploads/${userId}/${uuidv4()}.mp4`;
    const jti = uuidv4();
    const exp = Math.floor(Date.now() / 1000) + 5 * 60; // 5 minutes

    const payload = `${userId}:${key}:${jti}:${exp}`;
    const signingSecret = process.env.UPLOAD_SIGNING_SECRET;
    if (!signingSecret) throw new Error("UPLOAD_SIGNING_SECRET is missing");

    const sig = crypto.createHmac("sha256", signingSecret).update(payload).digest("hex");

    // ---- presigned POST (includes metadata in policy) ----
    const Conditions = [
      ["starts-with", "$key", `uploads/${userId}/`],
      { "x-amz-meta-user-id": userId },
      { "x-amz-meta-jti": jti },
      { "x-amz-meta-exp": String(exp) },
      { "x-amz-meta-sig": sig },
      { "Content-Type": "video/mp4" },
    ];

    const bucket = process.env.INPUT_BUCKET;
    if (!bucket) throw new Error("INPUT_BUCKET is missing");

    const { url, fields } = await createPresignedPost(s3, {
      Bucket: bucket,
      Key: key,
      Conditions,
      Fields: {
        key,
        "Content-Type": "video/mp4",
        "x-amz-meta-user-id": userId,
        "x-amz-meta-jti": jti,
        "x-amz-meta-exp": String(exp),
        "x-amz-meta-sig": sig,
      },
      Expires: 300,
    });

    console.log("presign ok", { urlPresent: !!url, fieldKeys: Object.keys(fields || {}), key });

    // Some SDKs include "bucket" in fields; it’s harmless but we don’t need it on client.
    if ("bucket" in fields) delete fields.bucket;

    return cors(event, 200, { url, fields, key });
  } catch (e) {
    console.error("upload-url error", e?.stack || e);
    // TEMP: expose detail to caller to speed up debugging; remove later
    return cors(event, 500, { error: "Server error", detail: String(e?.message || e) });
  }
};