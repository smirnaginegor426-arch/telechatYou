export const TELECHATYOU_PUBLIC_ORIGIN = "https://telechatyou.app";

export function profileShareUrl(username: string): string {
  return `${TELECHATYOU_PUBLIC_ORIGIN}/@${encodeURIComponent(username)}`;
}

export function chatShareUrl(chatId: number): string {
  return `${TELECHATYOU_PUBLIC_ORIGIN}/chat/${chatId}`;
}

export async function copyTextToClipboard(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Clipboard API can be unavailable in older Android WebViews.
  }

  if (typeof document === "undefined") return false;

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
