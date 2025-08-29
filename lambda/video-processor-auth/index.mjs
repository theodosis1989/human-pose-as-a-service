// lambdas/video-processor/index.mjs
import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

// ---------- ENV ----------
const REGION = "eu-north-1"; // e.g., eu-north-1
const SECRET = process.env.UPLOAD_SIGNING_SECRET; // same as backend
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PROCESSOR_ARN = process.env.PROCESSOR_ARN; // set this env var to your existing lambda ARN or name

// ---------- CLIENTS ----------
const s3 = new S3Client({ region: REGION });
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const lambda = new LambdaClient({ region: REGION });

// ---------- HELPERS ----------
function verifySignature({ userId, key, jti, exp, sig }) {
  // exp is seconds
  const nowSec = Math.floor(Date.now() / 1000);
  if (!userId || !jti || !exp || !sig) return { ok: false, reason: "missing-metadata" };
  if (nowSec > Number(exp)) return { ok: false, reason: "expired-intent" };

  const payload = `${userId}:${key}:${jti}:${exp}`;
  const expected = crypto.createHmac("sha256", SECRET).update(payload).digest("hex");
  if (expected !== sig) return { ok: false, reason: "bad-signature" };

  return { ok: true };
}

async function claimByKeyOnce(key) {
  // preferred: use the RPC; fallback: insert and catch unique_violation
  const { data, error } = await supabase.rpc("try_claim_key", { _key: key });
  if (error) {
    console.error("claim key RPC error", error);
    return false;
  }
  return !!data; // true if claimed, false if already claimed
}

async function consumeQuota(userId) {
  // atomic quota increment if below limit
  const { data, error } = await supabase.rpc("consume_quota", { _user: userId });
  if (error) {
    console.error("consume_quota error", error);
    return false;
  }
  return !!data; // true = allowed, false = limit reached
}

// ---------- HANDLER ----------
export const handler = async (event) => {
  for (const rec of event.Records ?? []) {
    const Bucket = rec.s3.bucket.name;
    const Key = decodeURIComponent(rec.s3.object.key.replace(/\+/g, " "));

    try {
      // 1) Read object metadata written at upload time
      const head = await s3.send(new HeadObjectCommand({ Bucket, Key }));
      const m = head.Metadata || {}; // S3 lowercases metadata keys
      const userId = m["user-id"];
      const jti = m["jti"];
      const exp = Number(m["exp"]);
      const sig = m["sig"];

      // 2) Verify HMAC + expiry
      const v = verifySignature({ userId, key: Key, jti, exp, sig });
      if (!v.ok) {
        console.log("skip due to verification", { Key, reason: v.reason });
        continue; // or throw to DLQ if you want to inspect
      }

      // 3) Idempotency: first claim wins
      const claimed = await claimByKeyOnce(Key);
      if (!claimed) {
        console.log("duplicate event or replay; already processed", { Key });
        continue;
      }

      // 4) Consume quota atomically; if exhausted, stop
      const allowed = await consumeQuota(userId);
      if (!allowed) {
        console.log("quota exceeded; skipping processing", { userId, Key });
        // (optional) add a tag on the object or move it to a "rejected/" prefix
        continue;
      }

      // 5) ✅ Call your already-deployed processor lambda
      const payload = {
        bucket: Bucket,
        key: Key,
        userId,
        // anything else your processor expects (e.g., versionId, output prefixes)
      };

      await lambda.send(new InvokeCommand({
        FunctionName: PROCESSOR_ARN,     // can be name or full ARN
        InvocationType: 'Event',         // async, fire-and-forget
        Payload: new TextEncoder().encode(JSON.stringify(payload))
      }));

      console.log('invoked processor', { target: PROCESSOR_ARN, Key });

      console.log("processed OK", { Key, userId });
    } catch (err) {
      // S3 is at-least-once; let Lambda retry or route to DLQ
      console.error("record failed", { Key, err });
      throw err;
    }
  }
  return { ok: true };
};