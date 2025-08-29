import { Platform } from "react-native";
import { apiGet } from "./api";

/* debug */ const dbg = (...args: any[]) =>
  console.log("[uploadToS3]", ...args);

export async function uploadVideoToS3(fileUri: string) {
  dbg("start", { fileUri, platform: Platform.OS });

  // 1) Ask your API for a presigned POST payload (NOT a PUT URL)
  const { url, fields, key } = await apiGet("/upload-url");

  // Remove any non-required extras just in case
  if ("bucket" in fields) delete (fields as any).bucket;

  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, String(v)));

  if (Platform.OS === "web") {
    let blob: Blob;
    try {
      blob = await (await fetch(fileUri)).blob(); // often works
    } catch {
      blob = dataUrlToBlob(fileUri); // fallback for data: URLs
    }
    form.append("file", blob, "video.mp4");
  } else {
    // Native (Expo): send as multipart with a file descriptor
    form.append("file", {
      uri: fileUri,
      name: "video.mp4",
      type: "video/mp4",
    } as any);
  }

  // 3) POST directly to S3 (policy signs all fields; no custom headers needed)
  dbg("posting to S3", { url });
  const resp = await fetch(url, { method: "POST", body: form });
  dbg("post sent");
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`S3 POST failed: ${resp.status} ${text}`);
  }

  dbg("upload success", { status: resp.status, key });
  return { key }; // S3 object key where your file lives
}

function dataUrlToBlob(dataUrl: string) {
  const [hdr, b64] = dataUrl.split(",");
  const mime = /data:(.*?);base64/.exec(hdr)?.[1] || "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}
