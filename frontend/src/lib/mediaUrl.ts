export function resolveMediaUrl(url: string | null | undefined): string {
  const value = (url || "").trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  if (value.startsWith("/")) {
    return value;
  }
  return `/${value.replace(/^\/+/, "")}`;
}

export function isVideoUrl(url: string, explicitType?: string | null): boolean {
  if (explicitType === "video") return true;
  if (explicitType === "image") return false;
  return /\.(mp4|webm|mov)(\?|$)/i.test(url);
}