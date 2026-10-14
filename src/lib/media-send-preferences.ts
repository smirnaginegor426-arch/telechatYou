export type MediaSendPreferences = {
  compressPhotos: boolean;
  confirmBeforeSend: boolean;
  stickersEnabled: boolean;
};

export const DEFAULT_MEDIA_SEND_PREFERENCES: MediaSendPreferences = {
  compressPhotos: false,
  confirmBeforeSend: false,
  stickersEnabled: true,
};

export const MEDIA_SEND_PREFERENCES_CHANGED_EVENT = "tcy-media-send-preferences-changed";

const STORAGE_KEY = "tcy-media-send-preferences";

export function getMediaSendPreferences(): MediaSendPreferences {
  if (typeof window === "undefined") return DEFAULT_MEDIA_SEND_PREFERENCES;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_MEDIA_SEND_PREFERENCES;
    const parsed = JSON.parse(saved) as Partial<MediaSendPreferences>;
    return {
      compressPhotos: parsed.compressPhotos ?? DEFAULT_MEDIA_SEND_PREFERENCES.compressPhotos,
      confirmBeforeSend: parsed.confirmBeforeSend ?? DEFAULT_MEDIA_SEND_PREFERENCES.confirmBeforeSend,
      stickersEnabled: parsed.stickersEnabled ?? DEFAULT_MEDIA_SEND_PREFERENCES.stickersEnabled,
    };
  } catch {
    return DEFAULT_MEDIA_SEND_PREFERENCES;
  }
}

export function saveMediaSendPreferences(preferences: MediaSendPreferences) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Settings still work for the current screen if local storage is unavailable.
  }
  window.dispatchEvent(new Event(MEDIA_SEND_PREFERENCES_CHANGED_EVENT));
}

export async function compressPhoto(file: File): Promise<File> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 400_000) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const maxEdge = 1920;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_200_000) {
      bitmap.close();
      return file;
    }

    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, file.type, file.type === "image/png" ? undefined : 0.82);
    });
    if (!blob || blob.type !== file.type || blob.size >= file.size) return file;

    const extension = file.type === "image/jpeg" ? ".jpg" : file.type === "image/webp" ? ".webp" : ".png";
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], baseName + extension, { type: file.type, lastModified: Date.now() });
  } catch {
    // Unsupported formats or browser limitations should never prevent sending a photo.
    return file;
  }
}
