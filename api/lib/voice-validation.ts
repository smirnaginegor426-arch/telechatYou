export const MAX_VOICE_BYTES = 8 * 1024 * 1024;

const ALLOWED_VOICE_MIME_TYPES = new Set([
  "audio/webm",
  "audio/webm;codecs=opus",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/x-m4a",
  "audio/ogg",
  "audio/wav",
]);

export function isAllowedVoiceMimeType(mime?: string | null): boolean {
  if (!mime) return true;
  const normalized = mime.toLowerCase().trim();
  return (
    normalized === "audio/webm" ||
    normalized.includes("audio/") && ALLOWED_VOICE_MIME_TYPES.has(normalized)
  );
}

export function validateVoiceUpload(input: { size: number; type?: string | null }): { ok: true } | { ok: false; message: string } {
  if (input.size <= 0) {
    return { ok: false, message: "Голосовое сообщение пустое" };
  }
  if (input.size > MAX_VOICE_BYTES) {
    return { ok: false, message: "Слишком большой файл голоса" };
  }
  if (!isAllowedVoiceMimeType(input.type)) {
    return { ok: false, message: "Неподдерживаемый тип аудио" };
  }
  return { ok: true };
}
