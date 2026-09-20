import { supabase } from "@/integrations/supabase/client";

const cache = new Map<string, { url: string; expires: number }>();
const TUS_CHUNK_SIZE = 6 * 1024 * 1024;
const MAX_UPLOAD_ATTEMPTS = 3;

type SupabaseRuntime = {
  // The real SupabaseClient stores this as a `URL` instance (`new URL('storage/v1', baseUrl)`),
  // not a string - calling string methods on it directly throws "is not a function".
  storageUrl?: URL;
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

  const endpoint = `${runtime.storageUrl.href.replace(/\/$/, "")}/upload/resumable`;
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
        offset =
          Number.isFinite(nextOffset) && nextOffset > offset ? nextOffset : offset + chunk.size;
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

/** Resolves when `fire` happens, or after `ms` regardless - some WebViews
 * (notably Android's, inside the Capacitor app) don't reliably fire
 * `loadedmetadata`/`seeked` on a `<video>` that was never attached to the
 * document, unlike desktop/mobile Safari and Chrome which handle a detached
 * element fine. Attaching the element (below) is the main fix; this timeout
 * is the backstop so a still-flaky WebView hangs the "Capturer" button for
 * at most a couple seconds instead of forever. */
function raceWithTimeout(attach: (resolve: () => void) => void, ms: number) {
  return new Promise<void>((resolve) => {
    const timer = window.setTimeout(resolve, ms);
    attach(() => {
      window.clearTimeout(timer);
      resolve();
    });
  });
}

/** Captures a JPEG frame from a video Blob/URL at `atSeconds`. Throws on
 * decode failure or an empty canvas so callers can distinguish "no frame"
 * from a real (recoverable) error. */
export async function captureVideoFrame(source: Blob | string, atSeconds: number): Promise<Blob> {
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  // Some WebViews (Android, inside the app) never fire loadedmetadata/seeked
  // on a video element that isn't part of the document - keeping it in the
  // DOM (just visually hidden, not display:none, which some engines also
  // treat as "don't bother decoding") is what actually makes frame capture
  // reliable there; this worked fine as a detached element on the website.
  const video = document.createElement("video");
  video.style.cssText = "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;";
  document.body.appendChild(video);
  try {
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    let loadError: Error | null = null;
    await raceWithTimeout((resolve) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => {
        loadError = new Error("Could not read video.");
        resolve();
      };
    }, 8000);
    if (loadError) throw loadError;
    if (!video.duration || Number.isNaN(video.duration)) throw new Error("Could not read video.");
    video.currentTime = Math.min(Math.max(atSeconds, 0), Math.max(video.duration - 0.05, 0));
    await raceWithTimeout((resolve) => {
      video.onseeked = () => resolve();
    }, 4000);
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) throw new Error("Could not capture frame.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not capture frame.");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not capture frame."))),
        "image/jpeg",
        0.85,
      );
    });
  } finally {
    video.remove();
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

/**
 * Captures a JPEG frame (~0.5s in, fallback first frame) from a video Blob.
 * Used to auto-generate a thumbnail when the creator didn't pick one:
 * mobile WebViews won't paint a frame from a bare <video preload="metadata">,
 * so videos without a real thumbnail render as black tiles in the native app.
 * Returns null when capture isn't possible (decode failure, tainted canvas).
 */
export async function captureVideoThumbnail(source: Blob): Promise<Blob | null> {
  if (typeof document === "undefined") return null;
  try {
    const duration = await new Promise<number>((resolve, reject) => {
      const probe = document.createElement("video");
      probe.preload = "metadata";
      probe.src = URL.createObjectURL(source);
      probe.onloadedmetadata = () => {
        const d = probe.duration;
        URL.revokeObjectURL(probe.src);
        resolve(d);
      };
      probe.onerror = () => {
        URL.revokeObjectURL(probe.src);
        reject(new Error("video decode failed"));
      };
    });
    const target = Math.min(0.5, (duration || 1) / 2);
    return await captureVideoFrame(source, target);
  } catch {
    return null;
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
