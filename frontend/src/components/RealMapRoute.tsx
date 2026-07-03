import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { Maximize2, X } from "lucide-react";
import L, { LatLngExpression, Map as LeafletMap } from "leaflet";
import { RouteExperience } from "../api/client";
import "leaflet/dist/leaflet.css";

type PathPoint = {
  lat: number;
  lng: number;
  curve?: boolean;
  /** When true, lat/lng is a point on the route line (anchor). When false/missing, legacy bezier control. */
  curve_anchor?: boolean;
  title?: string;
  description?: string;
  images?: string[];
  show_on_home?: boolean;
};

type RoutePointFields = Pick<RouteExperience, "start_location" | "end_location" | "start_lat" | "start_lng" | "end_lat" | "end_lng" | "path_points">;

const salalahCenter: LatLngExpression = [17.08, 54.12];
const salalahZoom = 11;
const salalahBounds = L.latLngBounds([16.15, 52.3], [18.25, 55.8]);
const mapTileUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const satelliteTileUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
const mapAttribution = "&copy; OpenStreetMap contributors";
const satelliteAttribution = "Tiles &copy; Esri, Maxar, Earthstar Geographics";
const mapTileOptions = {
  attribution: mapAttribution,
  maxZoom: 19,
  keepBuffer: 8
};
const satelliteTileOptions = {
  attribution: satelliteAttribution,
  maxZoom: 19,
  keepBuffer: 8
};
const CURVE_STEPS = 28;
const LINE_HIT_THRESHOLD = 0.004;

const round6 = (value: number) => Number(value.toFixed(6));

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}

function isCurvePoint(point: PathPoint) {
  return point.curve === true;
}

function isWaypoint(point: PathPoint) {
  return !isCurvePoint(point);
}

function addMapTiles(map: LeafletMap) {
  L.tileLayer(mapTileUrl, mapTileOptions).addTo(map);
  L.tileLayer(satelliteTileUrl, satelliteTileOptions).addTo(map);
}

function addDrawingMapTiles(map: LeafletMap) {
  L.tileLayer(mapTileUrl, mapTileOptions).addTo(map);
}

function parsePoints(raw?: string): PathPoint[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((point) => {
        const result: PathPoint = { lat: Number(point.lat), lng: Number(point.lng) };
        if (point.curve === true) result.curve = true;
        if (point.curve_anchor === true) result.curve_anchor = true;
        if (point.curve === true && point.curve_anchor !== true) result.curve_anchor = false;
        if (typeof point.title === "string" && point.title.trim()) result.title = point.title;
        if (typeof point.description === "string" && point.description.trim()) result.description = point.description;
        if (Array.isArray(point.images)) {
          const images = point.images.filter((item: unknown): item is string => typeof item === "string" && item.trim().length > 0);
          if (images.length) result.images = images;
        }
        if (point.show_on_home === true) result.show_on_home = true;
        return result;
      })
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  } catch {
    return [];
  }
}

function serializePoints(points: PathPoint[]) {
  return JSON.stringify(
    points.map((point) => {
      const result: Record<string, unknown> = { lat: round6(point.lat), lng: round6(point.lng) };
      if (point.curve) result.curve = true;
      if (point.curve && point.curve_anchor !== false) result.curve_anchor = true;
      if (point.title && point.title.trim()) result.title = point.title.trim();
      if (point.description && point.description.trim()) result.description = point.description.trim();
      if (point.images && point.images.length) result.images = point.images;
      if (point.show_on_home) result.show_on_home = true;
      return result;
    })
  );
}

function hasMapPoint(point: { lat: number; lng: number }) {
  return Number.isFinite(point.lat) && Number.isFinite(point.lng) && !(point.lat === 0 && point.lng === 0);
}

function approxEqual(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  return Math.abs(a.lat - b.lat) < 1e-6 && Math.abs(a.lng - b.lng) < 1e-6;
}

function findPointIndexByCoords(ordered: PathPoint[], lat: number, lng: number) {
  const target = { lat: round6(lat), lng: round6(lng) };
  return ordered.findIndex((point) => approxEqual(point, target));
}

function getWaypointIndices(ordered: PathPoint[]) {
  return ordered.map((point, index) => (isWaypoint(point) ? index : -1)).filter((index) => index >= 0);
}

function getCurveControl(ordered: PathPoint[], fromWaypointIndex: number, toWaypointIndex: number) {
  if (toWaypointIndex !== fromWaypointIndex + 2) return undefined;
  const candidate = ordered[fromWaypointIndex + 1];
  return candidate && isCurvePoint(candidate) ? candidate : undefined;
}

function quadraticPoint(a: PathPoint, control: PathPoint, b: PathPoint, t: number) {
  const u = 1 - t;
  return {
    lat: u * u * a.lat + 2 * u * t * control.lat + t * t * b.lat,
    lng: u * u * a.lng + 2 * u * t * control.lng + t * t * b.lng
  };
}

/** Convert an on-line anchor (mid-curve handle) to the bezier control point used for drawing. */
function anchorToControl(from: PathPoint, anchor: PathPoint, to: PathPoint): PathPoint {
  return {
    lat: 2 * anchor.lat - 0.5 * from.lat - 0.5 * to.lat,
    lng: 2 * anchor.lng - 0.5 * from.lng - 0.5 * to.lng
  };
}

function bezierControlForSegment(from: PathPoint, to: PathPoint, curve?: PathPoint) {
  if (!curve) return undefined;
  return anchorToControl(from, curve, to);
}

function buildSegmentCoords(from: PathPoint, to: PathPoint, curve?: PathPoint): [number, number][] {
  const control = bezierControlForSegment(from, to, curve);
  if (!control) {
    return [
      [from.lat, from.lng],
      [to.lat, to.lng]
    ];
  }
  const coords: [number, number][] = [];
  for (let step = 0; step <= CURVE_STEPS; step++) {
    const t = step / CURVE_STEPS;
    const point = quadraticPoint(from, control, to, t);
    coords.push([point.lat, point.lng]);
  }
  return coords;
}

function buildFullRouteCoords(ordered: PathPoint[]): [number, number][] {
  const waypointIndices = getWaypointIndices(ordered);
  if (waypointIndices.length < 2) {
    return ordered.filter(isWaypoint).map((point) => [point.lat, point.lng] as [number, number]);
  }

  const coords: [number, number][] = [];
  for (let w = 0; w < waypointIndices.length - 1; w++) {
    const fromIndex = waypointIndices[w];
    const toIndex = waypointIndices[w + 1];
    const from = ordered[fromIndex];
    const to = ordered[toIndex];
    const curve = getCurveControl(ordered, fromIndex, toIndex);
    const segment = buildSegmentCoords(from, to, curve);
    if (coords.length) segment.shift();
    coords.push(...segment);
  }
  return coords;
}

function closestPointOnRoute(ordered: PathPoint[], lat: number, lng: number) {
  const waypointIndices = getWaypointIndices(ordered);
  let bestDistance = Infinity;
  let afterWaypointIndex = -1;
  let projectedLat = lat;
  let projectedLng = lng;

  for (let w = 0; w < waypointIndices.length - 1; w++) {
    const fromIndex = waypointIndices[w];
    const toIndex = waypointIndices[w + 1];
    const from = ordered[fromIndex];
    const to = ordered[toIndex];
    const curve = getCurveControl(ordered, fromIndex, toIndex);
    const coords = buildSegmentCoords(from, to, curve);

    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lng1] = coords[i];
      const [lat2, lng2] = coords[i + 1];
      const dx = lat2 - lat1;
      const dy = lng2 - lng1;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq === 0 ? 0 : Math.max(0, Math.min(1, ((lat - lat1) * dx + (lng - lng1) * dy) / lenSq));
      const projLat = lat1 + t * dx;
      const projLng = lng1 + t * dy;
      const dLat = lat - projLat;
      const dLng = lng - projLng;
      const distance = Math.sqrt(dLat * dLat + dLng * dLng);
      if (distance < bestDistance) {
        bestDistance = distance;
        afterWaypointIndex = fromIndex;
        projectedLat = projLat;
        projectedLng = projLng;
      }
    }
  }

  if (afterWaypointIndex < 0 || bestDistance > LINE_HIT_THRESHOLD) return null;
  return { afterWaypointIndex, lat: projectedLat, lng: projectedLng, distance: bestDistance };
}

/** Legacy curves stored the bezier control (off the line). Convert to an on-line anchor at t=0.5. */
function normalizeCurvePoints(ordered: PathPoint[]): PathPoint[] {
  if (!ordered.some((point) => isCurvePoint(point) && point.curve_anchor === false)) {
    return ordered;
  }

  const next = ordered.map((point) => ({ ...point }));
  const waypointIndices = getWaypointIndices(next);

  for (let w = 0; w < waypointIndices.length - 1; w++) {
    const fromIndex = waypointIndices[w];
    const toIndex = waypointIndices[w + 1];
    if (toIndex !== fromIndex + 2) continue;

    const curveIndex = fromIndex + 1;
    const curve = next[curveIndex];
    if (!curve || !isCurvePoint(curve) || curve.curve_anchor !== false) continue;

    const from = next[fromIndex];
    const to = next[toIndex];
    const anchor = quadraticPoint(from, curve, to, 0.5);
    next[curveIndex] = {
      ...curve,
      lat: round6(anchor.lat),
      lng: round6(anchor.lng),
      curve_anchor: true
    };
  }

  return next;
}

function getOrderedPoints(route: RoutePointFields): PathPoint[] {
  const stored = parsePoints(route.path_points);

  // path_points is the source of truth when it contains a full route
  if (stored.length >= 2) {
    return normalizeCurvePoints(stored);
  }

  const start = { lat: route.start_lat, lng: route.start_lng };
  const end = { lat: route.end_lat, lng: route.end_lng };
  const startValid = hasMapPoint(start);
  const endValid = hasMapPoint(end);

  if (stored.length > 0 && startValid && approxEqual(stored[0], start)) {
    return normalizeCurvePoints(stored);
  }

  const result: PathPoint[] = [];
  if (startValid) {
    const startFromStored = stored.find((point) => isWaypoint(point) && approxEqual(point, start));
    result.push(startFromStored ? { ...startFromStored } : { lat: round6(start.lat), lng: round6(start.lng) });
  }

  for (const point of stored) {
    if (startValid && isWaypoint(point) && approxEqual(point, start)) continue;
    if (endValid && isWaypoint(point) && approxEqual(point, end)) continue;
    result.push({ ...point });
  }

  if (endValid) {
    const endFromStored = stored.find((point) => isWaypoint(point) && approxEqual(point, end));
    const last = result[result.length - 1];
    if (endFromStored) {
      if (!last || !approxEqual(last, end)) result.push({ ...endFromStored });
      else result[result.length - 1] = { ...endFromStored };
    } else if (!last || !approxEqual(last, end)) {
      result.push({ lat: round6(end.lat), lng: round6(end.lng) });
    }
  }

  return normalizeCurvePoints(result.filter(hasMapPoint));
}

export function routeDisplayLocations(route: RoutePointFields) {
  const ordered = getOrderedPoints(route);
  const waypoints = ordered.filter(isWaypoint);
  const first = waypoints[0];
  const last = waypoints[waypoints.length - 1];
  const start =
    route.start_location?.trim() ||
    first?.title ||
    (first ? `${round6(first.lat)}, ${round6(first.lng)}` : "");
  const end =
    route.end_location?.trim() ||
    last?.title ||
    (last ? `${round6(last.lat)}, ${round6(last.lng)}` : "");
  return { start, end };
}

function hasLegacyCurvePoints(route: RoutePointFields) {
  try {
    const parsed = JSON.parse(route.path_points || "[]");
    return Array.isArray(parsed) && parsed.some((point: { curve?: boolean; curve_anchor?: boolean }) => point.curve === true && point.curve_anchor !== true);
  } catch {
    return false;
  }
}

function orderedPointsToValue(base: RoutePointFields, ordered: PathPoint[]): RoutePointFields {
  const normalized = normalizeCurvePoints(ordered);
  if (normalized.length === 0) {
    return { ...base, start_location: "", end_location: "", start_lat: 0, start_lng: 0, end_lat: 0, end_lng: 0, path_points: "[]" };
  }
  const waypoints = normalized.filter(isWaypoint);
  const start = waypoints[0];
  const startLat = round6(start.lat);
  const startLng = round6(start.lng);
  const startLabel = start.title || base.start_location || `Start (${startLat}, ${startLng})`;
  if (waypoints.length === 1) {
    return {
      ...base,
      start_lat: startLat,
      start_lng: startLng,
      start_location: startLabel,
      end_lat: 0,
      end_lng: 0,
      end_location: "",
      path_points: serializePoints(normalized)
    };
  }
  const end = waypoints[waypoints.length - 1];
  const endLat = round6(end.lat);
  const endLng = round6(end.lng);
  return {
    ...base,
    start_lat: startLat,
    start_lng: startLng,
    start_location: startLabel,
    end_lat: endLat,
    end_lng: endLng,
    end_location: end.title || base.end_location || `End (${endLat}, ${endLng})`,
    path_points: serializePoints(normalized)
  };
}

function makeMarker(label: string, color: string, opts?: { selected?: boolean; shown?: boolean; size?: number }) {
  const size = opts?.size ?? 30;
  const half = size / 2;
  const fontSize = size >= 40 ? 15 : 12;
  const ring = opts?.selected
    ? "box-shadow:0 0 0 4px rgba(97,211,148,.95),0 10px 25px rgba(0,0,0,.35);"
    : "box-shadow:0 10px 25px rgba(0,0,0,.35);";
  const badge = opts?.shown
    ? `<span style="position:absolute;top:-7px;inset-inline-end:-7px;background:#22c55e;color:#fff;border-radius:999px;font-size:11px;line-height:1;width:17px;height:17px;display:flex;align-items:center;justify-content:center;border:2px solid #fff">★</span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;height:${size}px;width:${size}px;border-radius:999px;background:${color};border:3px solid white;color:white;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:${fontSize}px;${ring}">${label}${badge}</div>`,
    iconSize: [size, size],
    iconAnchor: [half, half]
  });
}

function makeCurveMarker(selected?: boolean) {
  const ring = selected
    ? "box-shadow:0 0 0 4px rgba(97,211,148,.95),0 8px 20px rgba(0,0,0,.35);"
    : "box-shadow:0 8px 20px rgba(0,0,0,.35);";
  return L.divIcon({
    className: "",
    html: `<div style="height:20px;width:20px;border-radius:999px;background:#61d394;border:3px solid white;box-sizing:border-box;${ring}"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });
}

function makeInfoMarker() {
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;height:34px;width:34px;border-radius:999px;background:#16a34a;border:3px solid white;color:white;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:16px;box-shadow:0 10px 25px rgba(0,0,0,.4)">i</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function buildInfoHtml(point: PathPoint, fallbackLabel = "Point") {
  const parts: string[] = [];
  parts.push(`<div style="font-weight:800;color:#0b1f17;margin-bottom:4px">${escapeHtml(point.title || fallbackLabel)}</div>`);
  if (point.description) {
    parts.push(`<div style="font-size:12px;color:#334155;line-height:1.4;margin-bottom:6px">${escapeHtml(point.description)}</div>`);
  }
  (point.images || []).slice(0, 4).forEach((src) => {
    parts.push(
      `<button type="button" class="point-popup-image-btn" data-full-src="${escapeHtml(src)}" aria-label="View image">
        <img src="${escapeHtml(src)}" alt="" class="point-popup-image" style="width:100%;border-radius:8px;margin-top:4px;display:block;cursor:zoom-in" />
      </button>`
    );
  });
  return `<div style="max-width:240px">${parts.join("")}</div>`;
}

function pointHasDetails(point: PathPoint) {
  return Boolean(point.title?.trim() || point.description?.trim() || (point.images && point.images.length > 0));
}

function buildPointPopupHtml(point: PathPoint, fallbackLabel: string) {
  if (pointHasDetails(point)) {
    return buildInfoHtml(point, fallbackLabel);
  }
  return `<div style="max-width:240px">
    <div style="font-weight:800;color:#0b1f17">${escapeHtml(fallbackLabel)}</div>
    <div style="font-size:12px;color:#64748b;margin-top:6px">${round6(point.lat)}, ${round6(point.lng)}</div>
  </div>`;
}

function attachWaypointPopup(marker: L.Marker, point: PathPoint, fallbackLabel: string) {
  const html = buildPointPopupHtml(point, fallbackLabel);
  marker.bindPopup(html, { className: "point-info-popup", maxWidth: 280, minWidth: 220, closeButton: true });
  marker.on("click", () => marker.openPopup());
}

function waypointNumber(ordered: PathPoint[], index: number) {
  return ordered.slice(0, index + 1).filter(isWaypoint).length - 1;
}

function destroyMap(map: LeafletMap | null | undefined) {
  if (!map) return;
  try {
    map.remove();
  } catch {
    // Map may already be torn down during React strict-mode remounts.
  }
}

function safeInvalidateMap(map: LeafletMap | null | undefined) {
  if (!map) return;
  try {
    const container = map.getContainer();
    if (!container?.isConnected) return;
    map.invalidateSize();
  } catch {
    // Leaflet throws if the map panes were removed before invalidateSize runs.
  }
}

function fitRouteToBounds(map: LeafletMap, route: RoutePointFields, padding: [number, number] = [48, 48]) {
  const lineCoords = buildFullRouteCoords(getOrderedPoints(route));
  try {
    if (lineCoords.length > 1) {
      map.fitBounds(L.latLngBounds(lineCoords), { padding, maxZoom: 16 });
    }
  } catch {
    // Ignore fit errors when the map container is not laid out yet.
  }
}

function paintRouteOnMap(
  map: LeafletMap,
  layers: L.LayerGroup,
  route: RoutePointFields,
  options?: { enlarged?: boolean }
) {
  const enlarged = options?.enlarged ?? false;
  const markerSize = enlarged ? 44 : 30;
  const lineWeight = enlarged ? 8 : 6;
  const fitPadding: [number, number] = enlarged ? [72, 72] : [48, 48];

  layers.clearLayers();
  const ordered = getOrderedPoints(route);
  const lineCoords = buildFullRouteCoords(ordered);

  try {
    if (lineCoords.length > 1) {
      L.polyline(lineCoords, { color: "#61d394", weight: lineWeight, opacity: 0.95 }).addTo(layers);
      fitRouteToBounds(map, route, fitPadding);
    } else if (ordered.length === 1) {
      map.setView([ordered[0].lat, ordered[0].lng], enlarged ? 14 : 13);
    }
  } catch {
    // Ignore fit errors when the map container is not laid out yet.
  }

  const waypointIndices = getWaypointIndices(ordered);
  ordered.forEach((point, index) => {
    if (!isWaypoint(point)) return;
    const wp = waypointNumber(ordered, index);
    const isStart = wp === 0;
    const isEnd = wp === waypointIndices.length - 1 && waypointIndices.length > 1;
    const fallbackLabel = isStart ? "Start" : isEnd ? "End" : `Point ${wp}`;
    const label = isStart ? "S" : isEnd ? "E" : String(wp);
    const color = isStart ? "#29a36a" : isEnd ? "#ef4444" : "#f59e0b";

    const marker = L.marker([point.lat, point.lng], {
      icon: makeMarker(label, color, { shown: !!point.show_on_home, size: markerSize }),
      interactive: true
    }).addTo(layers);

    attachWaypointPopup(marker, point, fallbackLabel);

    if (pointHasDetails(point)) {
      marker.bindTooltip(buildInfoHtml(point, fallbackLabel), {
        direction: "top",
        className: "point-info-tip",
        opacity: 1,
        offset: [0, enlarged ? -16 : -12]
      });
    }
  });
}

export function RealMapRoutePreview({
  route,
  className = "h-64",
  title,
  allowEnlarge = true
}: {
  route: RoutePointFields;
  className?: string;
  title?: string;
  allowEnlarge?: boolean;
}) {
  const { t } = useTranslation();
  const compactContainerRef = useRef<HTMLDivElement>(null);
  const enlargedContainerRef = useRef<HTMLDivElement>(null);
  const compactMapRef = useRef<LeafletMap | null>(null);
  const compactLayersRef = useRef<L.LayerGroup | null>(null);
  const enlargedMapRef = useRef<LeafletMap | null>(null);
  const enlargedLayersRef = useRef<L.LayerGroup | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const lightboxSrcRef = useRef<string | null>(null);

  const routeKey = `${route.path_points}|${route.start_lat}|${route.start_lng}|${route.end_lat}|${route.end_lng}`;

  useEffect(() => {
    lightboxSrcRef.current = lightboxSrc;
  }, [lightboxSrc]);

  useEffect(() => {
    const onImageClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const button = target.closest(".point-popup-image-btn") as HTMLElement | null;
      const img = target.closest(".point-popup-image") as HTMLImageElement | null;
      const source = button?.getAttribute("data-full-src") || img?.getAttribute("data-full-src") || img?.src;
      if (!source) return;
      event.preventDefault();
      event.stopPropagation();
      setLightboxSrc(source);
    };

    const containers = [compactContainerRef.current, enlargedContainerRef.current].filter(Boolean) as HTMLElement[];
    containers.forEach((container) => container.addEventListener("click", onImageClick));

    return () => {
      containers.forEach((container) => container.removeEventListener("click", onImageClick));
    };
  }, [isOpen, routeKey]);

  useEffect(() => {
    if (!lightboxSrc) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightboxSrc(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxSrc]);

  useEffect(() => {
    const container = compactContainerRef.current;
    if (!container) return;

    const map = L.map(container, {
      maxBounds: salalahBounds,
      maxBoundsViscosity: 0.8,
      scrollWheelZoom: false
    }).setView(salalahCenter, salalahZoom);
    addMapTiles(map);
    const layers = L.layerGroup().addTo(map);
    compactMapRef.current = map;
    compactLayersRef.current = layers;

    return () => {
      destroyMap(map);
      compactMapRef.current = null;
      compactLayersRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = compactMapRef.current;
    const layers = compactLayersRef.current;
    if (!map || !layers) return;

    paintRouteOnMap(map, layers, route);
    const timer = window.setTimeout(() => safeInvalidateMap(map), 200);
    return () => window.clearTimeout(timer);
  }, [routeKey, route]);

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    const initTimer = window.setTimeout(() => {
      if (cancelled) return;
      const container = enlargedContainerRef.current;
      if (!container) return;

      const map = L.map(container, {
        maxBounds: salalahBounds,
        maxBoundsViscosity: 0.2,
        scrollWheelZoom: true
      }).setView(salalahCenter, salalahZoom);
      addMapTiles(map);
      const layers = L.layerGroup().addTo(map);
      enlargedMapRef.current = map;
      enlargedLayersRef.current = layers;
      paintRouteOnMap(map, layers, route, { enlarged: true });

      [200, 500].forEach((delay) => {
        window.setTimeout(() => {
          if (cancelled) return;
          safeInvalidateMap(map);
          fitRouteToBounds(map, route, [72, 72]);
        }, delay);
      });
    }, 100);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightboxSrcRef.current) setLightboxSrc(null);
        else setIsOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      cancelled = true;
      window.clearTimeout(initTimer);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      destroyMap(enlargedMapRef.current);
      enlargedMapRef.current = null;
      enlargedLayersRef.current = null;
    };
  }, [isOpen, routeKey, route]);

  const { start, end } = routeDisplayLocations(route);
  const waypointCount = getOrderedPoints(route).filter(isWaypoint).length;

  const openEnlargedMap = () => setIsOpen(true);

  return (
    <>
      <div className="overflow-hidden rounded-3xl border border-white/10 bg-white/5">
        <div className="relative">
          <div ref={compactContainerRef} className={`w-full ${className}`} />
          {allowEnlarge && (
            <button
              type="button"
              onClick={openEnlargedMap}
              className="map-enlarge-btn absolute end-3 top-3 z-[1000] inline-flex items-center gap-2 rounded-2xl bg-forest-500 px-4 py-2 text-sm font-bold text-white shadow-glow transition hover:bg-forest-400"
              aria-label={t("routes.enlargeMap")}
            >
              <Maximize2 size={16} aria-hidden="true" />
              {t("routes.enlargeMap")}
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-white/70">
          <span>
            {start} → {end}
          </span>
          <div className="flex flex-wrap items-center gap-3">
            {allowEnlarge && (
              <button
                type="button"
                onClick={openEnlargedMap}
                className="inline-flex items-center gap-1.5 rounded-xl border border-forest-400/40 bg-forest-500/15 px-3 py-1.5 text-xs font-bold text-forest-300 transition hover:bg-forest-500/25"
              >
                <Maximize2 size={14} aria-hidden="true" />
                {t("routes.enlargeMap")}
              </button>
            )}
            <span className="font-bold text-forest-400">{t("routes.clickPoints")}</span>
          </div>
        </div>
      </div>

      {isOpen &&
        createPortal(
          <div
            className="route-map-modal fixed inset-0 z-[9999] flex items-center justify-center bg-black/92 p-2 backdrop-blur-sm sm:p-3"
            onClick={() => setIsOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={title || t("routes.fullPath")}
          >
            <div
              className="route-map-modal-panel flex h-[96vh] w-[98vw] max-w-[1800px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-forest-950 shadow-2xl sm:rounded-[1.75rem]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-6 sm:py-4">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-black text-white sm:text-2xl">{title || t("routes.fullPath")}</h3>
                  <p className="mt-0.5 text-xs text-white/60 sm:text-sm">
                    {start} → {end} · {t("routes.pointCount", { count: waypointCount })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-bold text-forest-950 transition hover:bg-white/90"
                >
                  <X size={16} aria-hidden="true" />
                  {t("routes.closeMap")}
                </button>
              </div>
              <div className="relative min-h-0 flex-1">
                <div ref={enlargedContainerRef} className="absolute inset-0 h-full w-full" />
              </div>
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/10 px-4 py-3 text-xs text-white/65 sm:px-6 sm:text-sm">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-[#29a36a]" aria-hidden="true" />
                    {t("routes.start")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-[#f59e0b]" aria-hidden="true" />
                    {t("routes.stopPoints")}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="inline-block h-3 w-3 rounded-full bg-[#ef4444]" aria-hidden="true" />
                    {t("routes.end")}
                  </span>
                </div>
                <span>{t("routes.enlargeHelp")}</span>
              </div>
            </div>
          </div>,
          document.body
        )}

      {lightboxSrc &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/92 p-4 backdrop-blur"
            onClick={() => setLightboxSrc(null)}
            role="dialog"
            aria-modal="true"
            aria-label={t("routes.imageLightbox")}
          >
            <button
              type="button"
              onClick={() => setLightboxSrc(null)}
              className="absolute end-4 top-4 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white hover:bg-white/25"
            >
              {t("routes.closeMap")}
            </button>
            <img
              src={lightboxSrc}
              alt=""
              className="max-h-[90vh] max-w-[95vw] rounded-2xl object-contain shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}

export function RealMapPathPicker({
  value,
  onChange,
  onRegisterFlush,
  className = "h-[420px]"
}: {
  value: RoutePointFields;
  onChange: (value: RoutePointFields) => void;
  onRegisterFlush?: (flush: () => RoutePointFields) => void;
  className?: string;
}) {
  const mapId = useMemo(() => `path-picker-${Math.random().toString(36).slice(2)}`, []);
  const mapRef = useRef<LeafletMap | null>(null);
  const layersRef = useRef<L.LayerGroup | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const modeRef = useRef<"pan" | "draw">("pan");
  const valueRef = useRef(value);
  const drawingRef = useRef(false);
  const suppressMapClickRef = useRef(false);
  const draftPointsRef = useRef<PathPoint[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [mode, setMode] = useState<"pan" | "draw">("pan");
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [pointForm, setPointForm] = useState({ title: "", description: "", imagesText: "", show_on_home: false });
  const [pointSaved, setPointSaved] = useState(false);
  const pointFormRef = useRef(pointForm);
  const selectedIndexRef = useRef<number | null>(selectedIndex);

  useEffect(() => {
    pointFormRef.current = pointForm;
  }, [pointForm]);

  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
  }, [selectedIndex]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    setRoutePoints(buildFullRouteCoords(getOrderedPoints(value)));
  }, [value.start_lat, value.start_lng, value.end_lat, value.end_lng, value.path_points]);

  const orderedPoints = getOrderedPoints(value);
  const curveCount = orderedPoints.filter(isCurvePoint).length;

  const syncPointForm = (point: PathPoint) => {
    setPointForm({
      title: point.title || "",
      description: point.description || "",
      imagesText: (point.images || []).join("\n"),
      show_on_home: !!point.show_on_home
    });
  };

  const commitValue = (next: RoutePointFields) => {
    valueRef.current = next;
    onChange(next);
  };

  const flushPendingPointEdits = useCallback((): RoutePointFields => {
    const index = selectedIndexRef.current;
    if (index === null) return valueRef.current;

    const ordered = getOrderedPoints(valueRef.current).map((point) => ({ ...point }));
    const point = ordered[index];
    if (!point || isCurvePoint(point)) return valueRef.current;

    const form = pointFormRef.current;
    const images = form.imagesText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    ordered[index] = {
      ...ordered[index],
      title: form.title.trim() || undefined,
      description: form.description.trim() || undefined,
      images: images.length ? images : undefined,
      show_on_home: form.show_on_home
    };
    const nextValue = orderedPointsToValue(valueRef.current, ordered);
    commitValue(nextValue);
    return nextValue;
  }, [onChange]);

  useEffect(() => {
    onRegisterFlush?.(flushPendingPointEdits);
  }, [onRegisterFlush, flushPendingPointEdits]);

  const selectPoint = (index: number) => {
    flushPendingPointEdits();
    const point = getOrderedPoints(valueRef.current)[index];
    if (!point) return;
    setSelectedIndex(index);
    if (isCurvePoint(point)) return;
    syncPointForm(point);
  };

  useEffect(() => {
    if (!isOpen || !hasLegacyCurvePoints(valueRef.current)) return;
    commitValue(orderedPointsToValue(valueRef.current, getOrderedPoints(valueRef.current)));
  }, [isOpen]);

  const savePointInfo = () => {
    if (selectedIndex === null) return;
    const savedLat = getOrderedPoints(valueRef.current)[selectedIndex]?.lat;
    const savedLng = getOrderedPoints(valueRef.current)[selectedIndex]?.lng;
    flushPendingPointEdits();
    if (savedLat !== undefined && savedLng !== undefined) {
      const refreshed = getOrderedPoints(valueRef.current);
      const newIndex = findPointIndexByCoords(refreshed, savedLat, savedLng);
      if (newIndex >= 0) {
        setSelectedIndex(newIndex);
        syncPointForm(refreshed[newIndex]);
      }
    }
    setPointSaved(true);
    window.setTimeout(() => setPointSaved(false), 2500);
  };

  const toggleSelectedVisibility = (next: boolean) => {
    setPointForm((current) => ({ ...current, show_on_home: next }));
    if (selectedIndex === null) return;
    const ordered = getOrderedPoints(valueRef.current).map((point) => ({ ...point }));
    if (!ordered[selectedIndex] || isCurvePoint(ordered[selectedIndex])) return;
    ordered[selectedIndex] = { ...ordered[selectedIndex], show_on_home: next };
    commitValue(orderedPointsToValue(valueRef.current, ordered));
  };

  const deletePoint = (index: number) => {
    const ordered = getOrderedPoints(valueRef.current).filter((_, i) => i !== index);
    commitValue(orderedPointsToValue(valueRef.current, ordered));
    setSelectedIndex(null);
  };

  const insertCurveAt = (afterWaypointIndex: number, lat: number, lng: number) => {
    const ordered = [...getOrderedPoints(valueRef.current)];
    const toIndex = getWaypointIndices(ordered)[getWaypointIndices(ordered).indexOf(afterWaypointIndex) + 1];
    if (toIndex === undefined) return;

    const existingCurve = getCurveControl(ordered, afterWaypointIndex, toIndex);
    if (existingCurve) {
      selectPoint(afterWaypointIndex + 1);
      return;
    }

    const curvePoint: PathPoint = { lat: round6(lat), lng: round6(lng), curve: true, curve_anchor: true };
    ordered.splice(afterWaypointIndex + 1, 0, curvePoint);
    commitValue(orderedPointsToValue(valueRef.current, ordered));
    selectPoint(afterWaypointIndex + 1);
  };

  useEffect(() => {
    if (!isOpen || !mapRef.current) return;
    drawingRef.current = false;
    if (mode === "draw") {
      mapRef.current.dragging.disable();
    } else {
      mapRef.current.dragging.enable();
    }
  }, [isOpen, mode]);

  useEffect(() => {
    if (!isOpen) return;

    if (!mapRef.current) {
      mapRef.current = L.map(mapId, {
        keyboard: false,
        maxBounds: salalahBounds,
        maxBoundsViscosity: 0.2,
        scrollWheelZoom: true
      }).setView(salalahCenter, salalahZoom);
      if (modeRef.current === "draw") {
        mapRef.current.dragging.disable();
      } else {
        mapRef.current.dragging.enable();
      }
      addDrawingMapTiles(mapRef.current);
      layersRef.current = L.layerGroup().addTo(mapRef.current);
      mapRef.current.on("click", (event: L.LeafletMouseEvent) => {
        if (modeRef.current !== "pan") return;
        if (suppressMapClickRef.current) {
          suppressMapClickRef.current = false;
          return;
        }
        const point = { lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) };
        const nextOrdered = [...getOrderedPoints(valueRef.current), point];
        const next = orderedPointsToValue(valueRef.current, nextOrdered);
        commitValue(next);
        selectPoint(nextOrdered.length - 1);
      });
      mapRef.current.on("mousedown", (event: L.LeafletMouseEvent) => {
        if (modeRef.current !== "draw") return;
        drawingRef.current = true;
        mapRef.current?.dragging.disable();
        const point = { lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) };
        draftPointsRef.current = [point];
        setRoutePoints([[point.lat, point.lng]]);
      });
      mapRef.current.on("mousemove", (event: L.LeafletMouseEvent) => {
        if (!drawingRef.current || modeRef.current !== "draw") return;
        const point = { lat: Number(event.latlng.lat.toFixed(6)), lng: Number(event.latlng.lng.toFixed(6)) };
        const lastPoint = draftPointsRef.current[draftPointsRef.current.length - 1];
        if (lastPoint && Math.abs(lastPoint.lat - point.lat) < 0.00008 && Math.abs(lastPoint.lng - point.lng) < 0.00008) return;
        draftPointsRef.current = [...draftPointsRef.current, point];
        setRoutePoints(draftPointsRef.current.map((item) => [item.lat, item.lng]));
      });
      mapRef.current.on("mouseup", () => {
        if (!drawingRef.current || modeRef.current !== "draw") return;
        drawingRef.current = false;
        const drawnPoints = draftPointsRef.current;
        if (drawnPoints.length < 2) return;
        commitValue(orderedPointsToValue(valueRef.current, drawnPoints));
      });
    }

    const map = mapRef.current;
    const layers = layersRef.current;
    if (!layers) return;

    layers.clearLayers();
    const ordered = getOrderedPoints(value);

    const refreshLine = (override?: { index: number; lat: number; lng: number }) => {
      const current = getOrderedPoints(valueRef.current);
      const nextOrdered = override
        ? current.map((point, i) => (i === override.index ? { ...point, lat: override.lat, lng: override.lng } : point))
        : current;
      polylineRef.current?.setLatLngs(buildFullRouteCoords(nextOrdered));
    };

    const attachDrag = (marker: L.Marker, index: number) => {
      marker.on("drag", (event) => {
        const ll = (event.target as L.Marker).getLatLng();
        refreshLine({ index, lat: ll.lat, lng: ll.lng });
      });
      marker.on("dragend", (event) => {
        const ll = (event.target as L.Marker).getLatLng();
        const next = getOrderedPoints(valueRef.current);
        if (!next[index]) return;
        next[index] = { ...next[index], lat: Number(ll.lat.toFixed(6)), lng: Number(ll.lng.toFixed(6)) };
        commitValue(orderedPointsToValue(valueRef.current, next));
      });
    };

    ordered.forEach((point, index) => {
      if (isCurvePoint(point)) {
        const marker = L.marker([point.lat, point.lng], {
          icon: makeCurveMarker(selectedIndex === index),
          draggable: true,
          autoPan: true
        }).addTo(layers);
        marker.bindTooltip("Curve handle — drag to bend the route", { direction: "top" });
        marker.on("click", (event) => {
          L.DomEvent.stopPropagation(event);
          selectPoint(index);
        });
        attachDrag(marker, index);
        return;
      }

      const wp = waypointNumber(ordered, index);
      const isStart = wp === 0;
      const waypointCount = ordered.filter(isWaypoint).length;
      const isEnd = wp === waypointCount - 1 && waypointCount > 1;
      const label = isStart ? "S" : isEnd ? "E" : String(wp);
      const color = isStart ? "#29a36a" : isEnd ? "#ef4444" : "#f59e0b";
      const marker = L.marker([point.lat, point.lng], {
        icon: makeMarker(label, color, { selected: selectedIndex === index, shown: !!point.show_on_home }),
        draggable: true,
        autoPan: true
      }).addTo(layers);
      marker.bindTooltip(point.title || (isStart ? "Start" : isEnd ? "End" : `Point ${wp}`), { direction: "top" });
      marker.on("click", (event) => {
        L.DomEvent.stopPropagation(event);
        selectPoint(index);
      });
      attachDrag(marker, index);
    });

    if (routePoints.length > 1) {
      polylineRef.current = L.polyline(routePoints, {
        color: "#61d394",
        weight: 6,
        opacity: 0.92,
        interactive: mode === "pan",
        className: mode === "pan" ? "route-line-hit" : undefined
      }).addTo(layers);

      if (mode === "pan") {
        polylineRef.current.on("click", (event: L.LeafletMouseEvent) => {
          suppressMapClickRef.current = true;
          L.DomEvent.stopPropagation(event);
          const hit = closestPointOnRoute(getOrderedPoints(valueRef.current), event.latlng.lat, event.latlng.lng);
          if (!hit) return;
          insertCurveAt(hit.afterWaypointIndex, hit.lat, hit.lng);
        });
      }
    } else {
      polylineRef.current = null;
    }

    if (isOpen) {
      window.setTimeout(() => safeInvalidateMap(map), 150);
    }
  }, [isOpen, mapId, onChange, routePoints, value, selectedIndex, mode]);

  const clearAllPathPoints = () => {
    const ordered = getOrderedPoints(valueRef.current);
    const waypoints = ordered.filter(isWaypoint);
    if (waypoints.length <= 2) return;
    commitValue(orderedPointsToValue(valueRef.current, waypoints));
    setSelectedIndex(null);
  };
  const clearAllMapPoints = () => {
    commitValue({
      ...valueRef.current,
      start_location: "",
      end_location: "",
      start_lat: 0,
      start_lng: 0,
      end_lat: 0,
      end_lng: 0,
      path_points: "[]"
    });
    setSelectedIndex(null);
  };
  const closeModal = () => {
    flushPendingPointEdits();
    destroyMap(mapRef.current);
    mapRef.current = null;
    layersRef.current = null;
    setIsOpen(false);
    setSelectedIndex(null);
  };
  const resetMapView = () => {
    mapRef.current?.setView(salalahCenter, salalahZoom);
    window.setTimeout(() => safeInvalidateMap(mapRef.current), 100);
  };

  const pointLabel = (index: number) => {
    const point = orderedPoints[index];
    if (isCurvePoint(point)) return "Curve bend";
    const wp = waypointNumber(orderedPoints, index);
    const waypointCount = orderedPoints.filter(isWaypoint).length;
    if (wp === 0) return "Start";
    if (wp === waypointCount - 1 && waypointCount > 1) return "End";
    return `Point ${wp}`;
  };
  const shownCount = orderedPoints.filter((point) => isWaypoint(point) && point.show_on_home).length;
  const fieldClass = "w-full rounded-2xl border border-white/10 bg-white/10 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/40 focus:border-forest-400";
  const selectedPoint = selectedIndex !== null ? orderedPoints[selectedIndex] : null;
  const selectedIsCurve = selectedPoint ? isCurvePoint(selectedPoint) : false;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="font-bold text-white">Trip path points</p>
          <p className="text-sm text-white/60">
            {orderedPoints.filter(isWaypoint).length} point{orderedPoints.filter(isWaypoint).length === 1 ? "" : "s"} · {curveCount} curve{curveCount === 1 ? "" : "s"} · {shownCount} on main page
          </p>
        </div>
        <button type="button" onClick={() => setIsOpen(true)} className="rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white shadow-glow">
          Enlarge map
        </button>
      </div>

      <div className="mt-4 grid gap-3 text-sm text-white/70 md:grid-cols-2">
        <div><span className="font-bold text-forest-400">Start:</span> {hasMapPoint({ lat: value.start_lat, lng: value.start_lng }) ? value.start_location : "Not selected"}</div>
        <div><span className="font-bold text-red-300">End:</span> {hasMapPoint({ lat: value.end_lat, lng: value.end_lng }) ? value.end_location : "Not selected"}</div>
      </div>

      {isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 p-4 backdrop-blur">
          <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-forest-950 shadow-2xl">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5">
              <div>
                <h3 className="text-2xl font-black text-white">Enlarge map</h3>
                <p className="text-sm text-white/60">Click the map to add points. Click the green line to add a curve handle, then drag it to bend the route.</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex rounded-full bg-white/10 p-1">
                  <button type="button" onClick={() => setMode("pan")} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "pan" ? "bg-forest-500 text-white" : "text-white/70"}`}>
                    Points & curves
                  </button>
                  <button type="button" onClick={() => setMode("draw")} className={`rounded-full px-4 py-2 text-sm font-bold ${mode === "draw" ? "bg-forest-500 text-white" : "text-white/70"}`}>
                    Free draw
                  </button>
                </div>
                <button type="button" onClick={clearAllPathPoints} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/80">
                  Clear waypoints
                </button>
                <button type="button" onClick={resetMapView} className="rounded-full border border-white/10 px-4 py-2 text-sm font-bold text-white/80">
                  Reset map
                </button>
                <button type="button" onClick={clearAllMapPoints} className="rounded-full border border-red-300/40 px-4 py-2 text-sm font-bold text-red-100">
                  Clear all points
                </button>
                <button type="button" onClick={closeModal} className="rounded-full bg-white px-5 py-2 text-sm font-bold text-forest-950">
                  Done
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 gap-0 lg:grid-cols-[1fr_360px]">
              <div className={`relative w-full min-h-[420px] ${className} ${mode === "draw" ? "cursor-crosshair" : "cursor-grab"}`}>
                <div id={mapId} className="absolute inset-0 h-full w-full" />
              </div>
              <aside className="overflow-y-auto border-t border-white/10 bg-white/5 p-4 lg:border-s lg:border-t-0">
                {selectedIndex !== null && selectedPoint ? (
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white">Edit {pointLabel(selectedIndex)}</p>
                      <button type="button" onClick={() => setSelectedIndex(null)} className="text-sm font-bold text-white/60 hover:text-white">
                        Back to list
                      </button>
                    </div>
                    <p className="mt-1 text-xs text-white/50">
                      Lat {round6(selectedPoint.lat)}, Lng {round6(selectedPoint.lng)}
                    </p>
                    {pointSaved && (
                      <p className="mt-2 rounded-xl bg-forest-500/20 px-3 py-2 text-sm font-semibold text-forest-300">
                        Point info saved
                      </p>
                    )}

                    {selectedIsCurve ? (
                      <div className="mt-4 space-y-3">
                        <p className="rounded-2xl bg-white/10 p-3 text-sm text-white/70">
                          Drag this green handle on the map to curve the route between two points. Delete it to make the segment straight again.
                        </p>
                        <button type="button" onClick={() => deletePoint(selectedIndex)} className="w-full rounded-2xl border border-red-300/40 px-4 py-3 font-bold text-red-100">
                          Remove curve
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-white/70">Title</span>
                          <input
                            className={fieldClass}
                            placeholder="e.g. Wadi Darbat Viewpoint"
                            value={pointForm.title}
                            onChange={(event) => setPointForm((current) => ({ ...current, title: event.target.value }))}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-white/70">Description</span>
                          <textarea
                            className={fieldClass}
                            rows={3}
                            placeholder="Tell guests what they will see here"
                            value={pointForm.description}
                            onChange={(event) => setPointForm((current) => ({ ...current, description: event.target.value }))}
                          />
                        </label>
                        <label className="block space-y-1">
                          <span className="text-xs font-semibold text-white/70">Image URLs (one per line)</span>
                          <textarea
                            className={fieldClass}
                            rows={3}
                            placeholder={"https://...\nhttps://..."}
                            value={pointForm.imagesText}
                            onChange={(event) => setPointForm((current) => ({ ...current, imagesText: event.target.value }))}
                          />
                        </label>

                        {pointForm.imagesText.trim() && (
                          <div className="flex flex-wrap gap-2">
                            {pointForm.imagesText
                              .split(/\r?\n/)
                              .map((line) => line.trim())
                              .filter(Boolean)
                              .slice(0, 4)
                              .map((src) => (
                                <img key={src} src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                              ))}
                          </div>
                        )}

                        <label className="flex items-center gap-2 rounded-2xl bg-white/5 px-3 py-3 text-sm font-semibold text-white/80">
                          <input
                            type="checkbox"
                            checked={pointForm.show_on_home}
                            onChange={(event) => toggleSelectedVisibility(event.target.checked)}
                          />
                          Show this point on the main page
                        </label>

                        <div className="flex gap-2">
                          <button type="button" onClick={savePointInfo} className="flex-1 rounded-2xl bg-forest-500 px-4 py-3 font-bold text-white">
                            Save info
                          </button>
                          <button type="button" onClick={() => deletePoint(selectedIndex)} className="rounded-2xl border border-red-300/40 px-4 py-3 font-bold text-red-100">
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="font-bold text-white">Path points</p>
                    <p className="mt-1 text-sm text-white/60">Click the green line to add a curve. Drag the small green handle to bend the route. Click a point to edit its details.</p>
                    <div className="mt-4 space-y-2">
                      {orderedPoints.length === 0 ? (
                        <p className="rounded-2xl bg-white/10 p-3 text-sm text-white/60">No points yet. Click the map to drop your first point.</p>
                      ) : (
                        orderedPoints.map((point, index) => (
                          <button
                            key={`${point.lat}-${point.lng}-${index}-modal`}
                            type="button"
                            onClick={() => selectPoint(index)}
                            className="block w-full rounded-2xl bg-white/10 p-3 text-start text-sm text-white/80 transition hover:bg-forest-500/20 hover:text-white"
                          >
                            <span className="flex items-center justify-between">
                              <span className={`font-bold ${isCurvePoint(point) ? "text-forest-300" : "text-yellow-300"}`}>{pointLabel(index)}</span>
                              {isWaypoint(point) && point.show_on_home && (
                                <span className="rounded-full bg-forest-500/30 px-2 py-0.5 text-[11px] font-bold text-forest-200">On main page</span>
                              )}
                            </span>
                            <span className="mt-1 block text-white/70">
                              {isCurvePoint(point) ? "Drag on map to bend this segment" : point.title || `${round6(point.lat)}, ${round6(point.lng)}`}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </aside>
            </div>
            <div className="grid gap-3 border-t border-white/10 p-4 text-sm text-white/70 md:grid-cols-3">
              <div><span className="font-bold text-forest-400">Start:</span> {hasMapPoint({ lat: value.start_lat, lng: value.start_lng }) ? `${value.start_lat}, ${value.start_lng}` : "Not selected"}</div>
              <div><span className="font-bold text-yellow-300">Points:</span> {orderedPoints.filter(isWaypoint).length} · <span className="text-forest-300">{curveCount} curves</span></div>
              <div><span className="font-bold text-red-300">End:</span> {hasMapPoint({ lat: value.end_lat, lng: value.end_lng }) ? `${value.end_lat}, ${value.end_lng}` : "Not selected"}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
