import { RouteExperience } from "../api/client";

export function getGoogleDirectionsUrl(route: Pick<RouteExperience, "start_lat" | "start_lng" | "end_lat" | "end_lng">) {
  const start = `${route.start_lat},${route.start_lng}`;
  const end = `${route.end_lat},${route.end_lng}`;
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(start)}&destination=${encodeURIComponent(end)}&travelmode=driving`;
}

export function getGoogleMapEmbedUrl(route: Pick<RouteExperience, "start_lat" | "start_lng" | "end_lat" | "end_lng">) {
  const start = `${route.start_lat},${route.start_lng}`;
  const end = `${route.end_lat},${route.end_lng}`;
  return `https://maps.google.com/maps?saddr=${encodeURIComponent(start)}&daddr=${encodeURIComponent(end)}&output=embed`;
}

export function GoogleMapPreview({
  route,
  className = "h-64"
}: {
  route: Pick<RouteExperience, "start_location" | "end_location" | "start_lat" | "start_lng" | "end_lat" | "end_lng">;
  className?: string;
}) {
  return (
    <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
      <iframe
        title={`${route.start_location} to ${route.end_location}`}
        src={getGoogleMapEmbedUrl(route)}
        className={`w-full ${className}`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-white/70">
        <span>
          {route.start_location} → {route.end_location}
        </span>
        <a href={getGoogleDirectionsUrl(route)} target="_blank" rel="noreferrer" className="font-bold text-forest-400">
          Open in Google Maps
        </a>
      </div>
    </div>
  );
}
