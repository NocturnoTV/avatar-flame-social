import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const MAX_UPLOAD_ATTEMPTS = 3;

type SupabaseRuntime = {
  storageUrl?: string;
  supabaseKey?: string;
};

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

function encodeTusMetadata(value: string) {
  return btoa(value);
}

function retryDelay(attempt: number) {
  return new Promise((resolve) => window.setTimeout(resolve, 500 * 2 ** attempt));
}

async function responseError(response: Response, fallback: string): Promise<Error> {
  const body = await response.text().catch(() => "");
  if (body) {
    try {
      const parsed = JSON.parse(body) as { message?: string; error?: string };
      return new Error(parsed.message || parsed.error || fallback);
    } catch {
      return new Error(body.slice(0, 240));
    }
  }
  return new Error(`${fallback} (HTTP ${response.status})`);
}

async function resumableUpload(bucket: string, path: string, file: Blob) {
  const runtime = supabase as unknown as SupabaseRuntime;
  if (!runtime.storageUrl || !runtime.supabaseKey) {
    throw new Error("La configuration du stockage vidéo est indisponible.");
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Votre session a expiré. Reconnectez-vous avant de publier.");
  }

  const endpoint = `${runtime.storageUrl.replace(/\/$/, "")}/upload/resumable`;
  const authHeaders = {
    authorization: `Bearer ${session.access_token}`,
    apikey: runtime.supabaseKey,
    "Tus-Resumable": "1.0.0",
  };

  let createResponse: Response;
  try {
    createResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...authHeaders,
        "Upload-Length": String(file.size),
        "Upload-Metadata": [
          `bucketName ${encodeTusMetadata(bucket)}`,
          `objectName ${encodeTusMetadata(path)}`,
          `contentType ${encodeTusMetadata(file.type || "application/octet-stream")}`,
          `cacheControl ${encodeTusMetadata("3600")}`,
        ].join(","),
        "x-upsert": "false",
      },
    });
  } catch {
    throw new Error(
      "Impossible de joindre le stockage vidéo. Vérifiez votre connexion puis réessayez.",
    );
  }

  if (!createResponse.ok) {
    throw await responseError(createResponse, "Impossible de démarrer l’envoi de la vidéo.");
  }

  const location = createResponse.headers.get("Location");
  if (!location) {
    throw new Error("Le stockage n’a pas renvoyé d’adresse d’envoi.");
  }

  const uploadUrl = new URL(location, endpoint).toString();
  let offset = Number(createResponse.headers.get("Upload-Offset") || 0);
  let failures = 0;

  while (offset < file.size) {
    const chunk = file.slice(offset, Math.min(offset + TUS_CHUNK_SIZE, file.size));

    try {
      const response = await fetch(uploadUrl, {
        method: "PATCH",
        headers: {
          ...authHeaders,
          "Content-Type": "application/offset+octet-stream",
          "Upload-Offset": String(offset),
        },
        body: chunk,
      });

      if (response.ok) {
        const nextOffset = Number(response.headers.get("Upload-Offset"));
        offset = Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : offset + chunk.size;
        failures = 0;
        continue;
      }

      if (response.status !== 409 && response.status !== 429 && response.status < 500) {
        throw await responseError(response, "L’envoi de la vidéo a été refusé.");
      }
    } catch (error) {
      failures += 1;
      if (failures >= MAX_UPLOAD_ATTEMPTS) {
        const detail =
          error instanceof Error && error.message !== "Failed to fetch" ? ` ${error.message}` : "";
        throw new Error(
          `L’envoi de la vidéo a été interrompu après plusieurs tentatives.${detail}`,
        );
      }
    }

    try {
      const head = await fetch(uploadUrl, {
        method: "HEAD",
        headers: authHeaders,
      });
      if (head.ok) {
        const serverOffset = Number(head.headers.get("Upload-Offset"));
        if (Number.isFinite(serverOffset) && serverOffset >= 0) offset = serverOffset;
      }
    } catch {
      // The next PATCH retries from the last confirmed offset.
    }

    await retryDelay(failures);
  }
}

export async function uploadFile(bucket: string, userId: string, file: Blob, ext: string) {
  const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${userId}/${crypto.randomUUID()}.${safeExt}`;

  if (bucket === "videos" || file.size > TUS_CHUNK_SIZE) {
    await resumableUpload(bucket, path, file);
    return `${bucket}/${path}`;
  }

  const { error } = await supabase.storage.from(bucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });
  if (error) throw error;
  return `${bucket}/${path}`;
}
