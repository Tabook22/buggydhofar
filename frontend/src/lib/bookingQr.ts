export function buildPublicBookingUrl(): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const base = configured || (typeof window !== "undefined" ? window.location.origin : "https://buggydhofar.com");
  return `${base.replace(/\/$/, "")}/booking`;
}

export function buildCheckInUrl(token: string): string {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const base = configured || (typeof window !== "undefined" ? window.location.origin : "https://buggydhofar.com");
  return `${base.replace(/\/$/, "")}/checkin/${token}`;
}

export function qrCodeImageUrl(data: string, size = 220): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}`;
}

export function parseCheckInToken(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    const tokenFromSegment = (segment: string) => {
      const index = parts.indexOf(segment);
      if (index >= 0 && parts[index + 1]) {
        return parts[index + 1];
      }
      return null;
    };
    // Customer QR encodes /checkin/{token}; confirmation/verify URLs also work.
    return (
      tokenFromSegment("checkin") ||
      tokenFromSegment("confirmation") ||
      tokenFromSegment("verify") ||
      null
    );
  } catch {
    // Not a URL — treat as raw token.
  }
  return trimmed;
}
