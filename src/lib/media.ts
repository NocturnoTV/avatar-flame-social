import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();

/** Storage paths are stored as "bucket/path/to/file". Returns a signed URL. */
export async function signedUrl(stored: string | null | undefined): Promise<string | null> {
  if (!stored) return null;
  if (stored.startsWith("http")) return stored;
  const hit = cache.get(stored);
  if (hit && hit.expires > Date.now()) return hit.url;
  const [bucket, ...rest] = stored.split("/");
  if (!bucket || rest.length === 0) return null;
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(rest.join("/"), 3600);
  if (error || !data) return null;
  cache.set(stored, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function uploadFile(bucket: string, userId: string, file: Blob, ext: string) {
  const path = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return `${bucket}/${path}`;
}
