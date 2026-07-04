import { FormEvent, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api, clearAdminToken, FleetUnit, isAdminAuthError, RouteExperience, SiteContent, Vehicle } from "../api/client";
import { RealMapPathPicker, RealMapRoutePreview } from "../components/RealMapRoute";
import { AdminBookingsPanel } from "../components/AdminBookingsPanel";
import { AdminBookingLinkQr } from "../components/AdminBookingLinkQr";
import { AdminTransferSettings, defaultTransferSettings } from "../components/AdminTransferSettings";

type Stats = {
  total_revenue: number;
  confirmed_bookings: number;
  pending_bookings: number;
  uncompleted_bookings: number;
  daily_bookings: number;
  monthly_bookings: number;
  total_bookings: number;
};

type VehicleForm = Omit<Vehicle, "id">;
type RouteForm = Omit<RouteExperience, "id">;
type SiteContentForm = Omit<SiteContent, "id">;

const inputClass = "w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-white outline-none focus:border-forest-400";
const vehicleTypes = [
  ["buggy", "Buggy Car"],
  ["quad", "Quad Bike"],
  ["bicycle", "Mountain Bike"],
  ["electric_bike", "Electric Bike"],
  ["offroad_bike", "Off-road Bike"]
];

const emptyVehicleForm: VehicleForm = {
  name_en: "",
  name_ar: "",
  type: "buggy",
  seats: 1,
  price_per_hour: 10,
  image_url: "",
  is_available: true,
  display_on_home: true
};

const emptyRouteForm: RouteForm = {
  name_en: "",
  name_ar: "",
  description_en: "",
  description_ar: "",
  duration_minutes: 60,
  price: 15,
  image_url: "",
  start_location: "",
  end_location: "",
  start_lat: 0,
  start_lng: 0,
  end_lat: 0,
  end_lng: 0,
  path_points: "[]",
  is_popular: false,
  display_on_home: true
};

function countRouteWaypoints(pathPoints: string) {
  try {
    const parsed = JSON.parse(pathPoints || "[]");
    if (!Array.isArray(parsed)) return 0;
    return parsed.filter((point) => point?.curve !== true).length;
  } catch {
    return 0;
  }
}

function routeFromApi(route: RouteExperience): RouteForm {
  const pathPoints =
    typeof route.path_points === "string"
      ? route.path_points || "[]"
      : JSON.stringify(route.path_points ?? []);
  return {
    name_en: route.name_en,
    name_ar: route.name_ar,
    description_en: route.description_en ?? "",
    description_ar: route.description_ar ?? "",
    duration_minutes: Number(route.duration_minutes) || 0,
    price: Number(route.price) || 0,
    image_url: route.image_url ?? "",
    start_location: route.start_location ?? "",
    end_location: route.end_location ?? "",
    start_lat: Number(route.start_lat) || 0,
    start_lng: Number(route.start_lng) || 0,
    end_lat: Number(route.end_lat) || 0,
    end_lng: Number(route.end_lng) || 0,
    path_points: pathPoints,
    is_popular: Boolean(route.is_popular),
    display_on_home: route.display_on_home !== false
  };
}

const locationPresets = [
  { label: "Itin to Ittin Viewpoint", start_location: "Itin Plain, Salalah", end_location: "Ittin Mountain Viewpoint, Dhofar", start_lat: 17.0615, start_lng: 54.0436, end_lat: 17.0916, end_lng: 54.0372, path_points: '[{"lat":17.0719,"lng":54.0404},{"lat":17.0821,"lng":54.0383}]' },
  { label: "Ain Razat to Wadi Darbat", start_location: "Ain Razat, Salalah", end_location: "Wadi Darbat, Dhofar", start_lat: 17.1206, start_lng: 54.2374, end_lat: 17.1057, end_lng: 54.4484, path_points: '[{"lat":17.1188,"lng":54.2995},{"lat":17.1112,"lng":54.3717}]' },
  { label: "Taqah to Darbat Waterfall", start_location: "Taqah Coastal Road", end_location: "Wadi Darbat Waterfall Area", start_lat: 17.0361, start_lng: 54.4019, end_lat: 17.1057, end_lng: 54.4484, path_points: '[{"lat":17.0573,"lng":54.4165},{"lat":17.0834,"lng":54.4328}]' }
];

const emptyFleetForm = {
  unit_number: 1,
  name_en: "",
  name_ar: "",
  is_active: true
};

function nextFleetUnitNumber(units: FleetUnit[]) {
  if (!units.length) return 1;
  return Math.max(...units.map((unit) => unit.unit_number)) + 1;
}

const emptySiteContent: SiteContentForm = {
  hero_badge_en: "",
  hero_badge_ar: "",
  hero_title_en: "",
  hero_title_ar: "",
  hero_subtitle_en: "",
  hero_subtitle_ar: "",
  hero_cta_en: "",
  hero_cta_ar: "",
  hero_secondary_en: "",
  hero_secondary_ar: "",
  hero_note_en: "",
  hero_note_ar: "",
  hero_background_url: "",
  hero_side_image_url: "",
  vehicles_title_en: "",
  vehicles_title_ar: "",
  vehicles_subtitle_en: "",
  vehicles_subtitle_ar: "",
  routes_title_en: "",
  routes_title_ar: "",
  routes_subtitle_en: "",
  routes_subtitle_ar: "",
  why_title_en: "",
  why_title_ar: "",
  why_image_url: "",
  ...defaultTransferSettings
};

export default function AdminDashboard() {
  const { t } = useTranslation();
  const [token, setToken] = useState(localStorage.getItem("khareef-admin-token") || "");
  const [login, setLogin] = useState({ username: "admin", password: "admin123" });
  const [loginMessage, setLoginMessage] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RouteExperience[]>([]);
  const [fleetUnits, setFleetUnits] = useState<FleetUnit[]>([]);
  const [editingVehicleId, setEditingVehicleId] = useState<number | null>(null);
  const [editingRouteId, setEditingRouteId] = useState<number | null>(null);
  const [editingFleetId, setEditingFleetId] = useState<number | null>(null);
  const [vehicleForm, setVehicleForm] = useState<VehicleForm>(emptyVehicleForm);
  const [routeForm, setRouteForm] = useState<RouteForm>(emptyRouteForm);
  const [fleetForm, setFleetForm] = useState(emptyFleetForm);
  const [isAddingRoute, setIsAddingRoute] = useState(false);
  const [viewingRouteId, setViewingRouteId] = useState<number | null>(null);
  const [routeMessage, setRouteMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [routeSaving, setRouteSaving] = useState(false);
  const [lastSavedPath, setLastSavedPath] = useState<{ id: number; name: string; action: "created" | "updated"; points: number } | null>(null);
  const flushPathEditsRef = useRef<(() => Partial<RouteForm>) | null>(null);
  const pathSaveBannerRef = useRef<HTMLDivElement | null>(null);
  const [siteContentForm, setSiteContentForm] = useState<SiteContentForm>(emptySiteContent);
  const [transferMessage, setTransferMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [fleetMessage, setFleetMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleAuthFailure(message?: string) {
    clearAdminToken();
    setToken("");
    setLoginMessage(message || t("admin.sessionExpired"));
  }

  async function loadAdminData(authToken = token) {
    if (!authToken) return null;
    try {
      const [statsData, vehicleData, routeData, fleetData, contentData] = await Promise.all([
        api.adminGet<Stats>("/api/admin/dashboard-stats", authToken),
        api.adminGet<Vehicle[]>("/api/admin/vehicles", authToken),
        api.adminGet<RouteExperience[]>("/api/admin/routes", authToken),
        api.adminGet<FleetUnit[]>("/api/admin/fleet", authToken),
        api.adminGet<SiteContent>("/api/admin/site-content", authToken)
      ]);
      setStats(statsData);
      setVehicles(vehicleData);
      setRoutes(routeData);
      setFleetUnits(fleetData);
      const { id: _id, ...editableContent } = contentData;
      setSiteContentForm({ ...emptySiteContent, ...editableContent });
      return fleetData;
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) {
        handleAuthFailure(message);
      }
      throw error;
    }
  }

  useEffect(() => {
    if (!token) return;
    loadAdminData().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!lastSavedPath) return;
    pathSaveBannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    const timer = window.setTimeout(() => setLastSavedPath(null), 12000);
    return () => window.clearTimeout(timer);
  }, [lastSavedPath]);

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setLoginMessage(null);
    try {
      const response = await api.adminLogin(login.username, login.password);
      if (response.role === "scanner") {
        setLoginMessage(t("staff.useStaffPortal"));
        return;
      }
      localStorage.setItem("khareef-admin-token", response.access_token);
      setToken(response.access_token);
      await loadAdminData(response.access_token);
    } catch (error) {
      setLoginMessage(error instanceof Error ? error.message : t("admin.loginFailed"));
    }
  }

  async function saveVehicle(event: FormEvent) {
    event.preventDefault();
    if (editingVehicleId) {
      await api.adminSend(`/api/admin/vehicles/${editingVehicleId}`, token, "PUT", vehicleForm);
    } else {
      await api.adminSend("/api/admin/vehicles", token, "POST", vehicleForm);
    }
    setEditingVehicleId(null);
    setVehicleForm(emptyVehicleForm);
    await loadAdminData();
  }

  async function saveRoute(event: FormEvent) {
    event.preventDefault();
    setRouteMessage(null);

    if (!token) {
      setRouteMessage({ type: "error", text: t("admin.pathLoginRequired") });
      return;
    }

    const flushedMap = flushPathEditsRef.current?.();
    const currentForm = flushedMap ? { ...routeForm, ...flushedMap } : routeForm;

    if (!currentForm.name_en.trim() || !currentForm.name_ar.trim()) {
      setRouteMessage({ type: "error", text: t("admin.pathNeedNames") });
      return;
    }

    const duration = Number(currentForm.duration_minutes);
    if (!Number.isFinite(duration) || duration < 1) {
      setRouteMessage({ type: "error", text: t("admin.pathNeedDuration") });
      return;
    }

    const waypointCount = countRouteWaypoints(currentForm.path_points);
    const hasStartEnd =
      Number.isFinite(currentForm.start_lat) &&
      Number.isFinite(currentForm.start_lng) &&
      Number.isFinite(currentForm.end_lat) &&
      Number.isFinite(currentForm.end_lng) &&
      !(currentForm.start_lat === 0 && currentForm.start_lng === 0) &&
      !(currentForm.end_lat === 0 && currentForm.end_lng === 0);

    if (waypointCount < 2 && !hasStartEnd) {
      setRouteMessage({ type: "error", text: t("admin.pathNeedPoints") });
      return;
    }

    const payload = routeFromApi({
      id: editingRouteId ?? 0,
      ...currentForm,
      duration_minutes: duration,
      price: Number(currentForm.price) || 0
    });

    setRouteSaving(true);
    const wasEditing = Boolean(editingRouteId);
    const pathName = currentForm.name_en.trim();
    try {
      let savedRoute: RouteExperience;
      if (editingRouteId) {
        savedRoute = await api.adminSend<RouteExperience>(`/api/admin/routes/${editingRouteId}`, token, "PUT", payload);
      } else {
        savedRoute = await api.adminSend<RouteExperience>("/api/admin/routes", token, "POST", payload);
      }
      const savedPoints = countRouteWaypoints(savedRoute.path_points);
      await loadAdminData();
      closeRouteForm();
      setLastSavedPath({
        id: savedRoute.id,
        name: savedRoute.name_en || pathName,
        action: wasEditing ? "updated" : "created",
        points: savedPoints
      });
      setRouteMessage({
        type: "success",
        text: wasEditing
          ? t("admin.pathUpdatedNamed", { name: savedRoute.name_en || pathName, id: savedRoute.id })
          : t("admin.pathCreatedNamed", { name: savedRoute.name_en || pathName, id: savedRoute.id })
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) {
        handleAuthFailure(t("admin.pathLoginRequired"));
      } else {
        setRouteMessage({ type: "error", text: message });
      }
    } finally {
      setRouteSaving(false);
    }
  }

  function closeRouteForm() {
    setEditingRouteId(null);
    setIsAddingRoute(false);
    setRouteForm(emptyRouteForm);
  }

  function startAddRoute() {
    closeRouteForm();
    setViewingRouteId(null);
    setIsAddingRoute(true);
    setRouteMessage(null);
    setLastSavedPath(null);
  }

  function startEditRoute(route: RouteExperience) {
    setViewingRouteId(null);
    setIsAddingRoute(false);
    setEditingRouteId(route.id);
    setRouteForm(routeFromApi(route));
    setRouteMessage(null);
    setLastSavedPath(null);
  }

  function startViewRoute(routeId: number) {
    setViewingRouteId(routeId);
    setIsAddingRoute(false);
    setEditingRouteId(null);
    setRouteForm(emptyRouteForm);
    setRouteMessage(null);
    setLastSavedPath(null);
  }

  async function toggleRouteDisplay(route: RouteExperience, display_on_home: boolean) {
    setRouteMessage(null);
    try {
      await api.adminSend(`/api/admin/routes/${route.id}/display`, token, "PATCH", { display_on_home });
      await loadAdminData();
      setRouteMessage({
        type: "success",
        text: display_on_home ? t("admin.pathShownOnHome") : t("admin.pathHiddenFromHome")
      });
    } catch (error) {
      setRouteMessage({ type: "error", text: error instanceof Error ? error.message : t("admin.pathSaveError") });
    }
  }

  async function deleteRoute(route: RouteExperience) {
    if (!window.confirm(t("admin.pathDeleteConfirm", { name: route.name_en }))) return;
    setRouteMessage(null);
    try {
      await api.adminSend(`/api/admin/routes/${route.id}`, token, "DELETE");
      if (viewingRouteId === route.id) setViewingRouteId(null);
      if (editingRouteId === route.id) closeRouteForm();
      await loadAdminData();
      setRouteMessage({ type: "success", text: t("admin.pathDeleted") });
    } catch (error) {
      setRouteMessage({ type: "error", text: error instanceof Error ? error.message : t("admin.pathDeleteError") });
    }
  }

  async function deleteAllRoutes() {
    if (!window.confirm(t("admin.deleteAllPathsConfirm"))) return;
    setRouteMessage(null);
    try {
      await api.adminSend("/api/admin/routes", token, "DELETE");
      setViewingRouteId(null);
      closeRouteForm();
      await loadAdminData();
      setRouteMessage({ type: "success", text: t("admin.pathsAllDeleted") });
    } catch (error) {
      setRouteMessage({ type: "error", text: error instanceof Error ? error.message : t("admin.pathDeleteError") });
    }
  }

  const viewingRoute = viewingRouteId ? routes.find((route) => route.id === viewingRouteId) : null;
  const routeFormOpen = isAddingRoute || editingRouteId !== null;

  async function saveFleetUnit(event: FormEvent) {
    event.preventDefault();
    setFleetMessage(null);
    const payload = {
      ...fleetForm,
      unit_number: Number(fleetForm.unit_number),
      name_en: fleetForm.name_en || `Buggy Bike #${fleetForm.unit_number}`,
      name_ar: fleetForm.name_ar || `دراجة باجي #${fleetForm.unit_number}`
    };
    try {
      if (editingFleetId) {
        await api.adminSend(`/api/admin/fleet/${editingFleetId}`, token, "PUT", payload);
        setFleetMessage({ type: "success", text: t("admin.fleetUpdated") });
      } else {
        await api.adminSend("/api/admin/fleet", token, "POST", payload);
        setFleetMessage({ type: "success", text: t("admin.fleetAdded") });
      }
      setEditingFleetId(null);
      const fleetData = await loadAdminData();
      if (fleetData) {
        setFleetForm({ ...emptyFleetForm, unit_number: nextFleetUnitNumber(fleetData) });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) {
        handleAuthFailure(message);
        return;
      }
      setFleetMessage({ type: "error", text: message });
    }
  }

  async function deleteFleetUnit(unit: FleetUnit) {
    if (!window.confirm(t("admin.deleteFleetConfirm", { number: unit.unit_number }))) return;
    setFleetMessage(null);
    try {
      await api.adminSend(`/api/admin/fleet/${unit.id}`, token, "DELETE");
      if (editingFleetId === unit.id) {
        setEditingFleetId(null);
      }
      const fleetData = await loadAdminData();
      if (fleetData) {
        setFleetForm({ ...emptyFleetForm, unit_number: nextFleetUnitNumber(fleetData) });
      }
      setFleetMessage({ type: "success", text: t("admin.fleetDeleted") });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("admin.pathSaveError");
      if (isAdminAuthError(message)) {
        handleAuthFailure(message);
        return;
      }
      setFleetMessage({ type: "error", text: message });
    }
  }

  async function saveSiteContent(event: FormEvent) {
    event.preventDefault();
    await api.adminSend("/api/admin/site-content", token, "PUT", siteContentForm);
    await loadAdminData();
  }

  async function deleteItem(path: string) {
    await api.adminSend(path, token, "DELETE");
    await loadAdminData();
  }

  if (!token) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-forest-950 p-4 text-white">
        <form onSubmit={submitLogin} className="glass w-full max-w-md rounded-[2rem] p-8">
          <h1 className="text-3xl font-black">{t("admin.login")}</h1>
          {loginMessage && (
            <p className="mt-4 rounded-2xl bg-red-500/15 px-4 py-3 text-sm text-red-200">{loginMessage}</p>
          )}
          <div className="mt-6 space-y-4">
            <input className={inputClass} value={login.username} onChange={(event) => setLogin({ ...login, username: event.target.value })} placeholder={t("admin.username")} />
            <input className={inputClass} type="password" value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder={t("admin.password")} />
            <button className="w-full rounded-2xl bg-forest-500 px-5 py-3 font-bold">{t("admin.signIn")}</button>
          </div>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-forest-950 p-4 text-white lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">{t("admin.dashboard")}</h1>
            <p className="mt-2 text-white/60">Control bookings, vehicles, offers, prices, route paths, and map locations.</p>
          </div>
          <button
            onClick={() => {
              clearAdminToken();
              setToken("");
              setLoginMessage(null);
            }}
            className="rounded-full border border-white/10 px-5 py-2"
          >
            Logout
          </button>
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: t("admin.revenue"),
              value: `${stats?.total_revenue || 0} ${t("booking.omr")}`,
              valueClass: "text-forest-400"
            },
            {
              label: t("admin.confirmedBookings"),
              value: stats?.confirmed_bookings ?? 0,
              valueClass: "text-forest-400"
            },
            {
              label: t("admin.pendingBookings"),
              value: stats?.pending_bookings ?? 0,
              valueClass: "text-yellow-300"
            },
            {
              label: t("admin.uncompletedBookings"),
              value: stats?.uncompleted_bookings ?? 0,
              valueClass: "text-red-400"
            }
          ].map(({ label, value, valueClass }) => (
            <div key={label} className="soft-card rounded-3xl p-6">
              <p className="text-white/60">{label}</p>
              <p className={`mt-3 text-3xl font-black ${valueClass}`}>{value}</p>
            </div>
          ))}
        </section>

        <section className="mt-4 grid gap-4 md:grid-cols-3">
          {[
            [t("admin.daily"), stats?.daily_bookings || 0, "text-forest-400"],
            [t("admin.monthly"), stats?.monthly_bookings || 0, "text-forest-400"],
            [t("admin.activeBookings"), stats?.total_bookings || 0, "text-forest-400"]
          ].map(([label, value, valueClass]) => (
            <div key={label as string} className="soft-card rounded-3xl p-6">
              <p className="text-white/60">{label}</p>
              <p className={`mt-3 text-3xl font-black ${valueClass}`}>{value}</p>
            </div>
          ))}
        </section>

        <AdminBookingLinkQr />

        <AdminBookingsPanel token={token} onAuthFailure={handleAuthFailure} />

        <AdminTransferSettings
          form={siteContentForm}
          message={transferMessage}
          onChange={(transfer) => setSiteContentForm((prev) => ({ ...prev, ...transfer }))}
          onSave={async (_event, transferForm) => {
            setTransferMessage(null);
            try {
              const payload = {
                ...siteContentForm,
                ...transferForm,
                transfer_show_mobile_wallet: false,
                transfer_mobile_wallet_en: "",
                transfer_mobile_wallet_ar: ""
              };
              await api.adminSend("/api/admin/site-content", token, "PUT", payload);
              await loadAdminData();
              setTransferMessage({ type: "success", text: t("admin.transferSaved") });
            } catch (error) {
              setTransferMessage({
                type: "error",
                text: error instanceof Error ? error.message : t("admin.transferSaveFailed")
              });
            }
          }}
        />

        <section className="mt-8 rounded-[2rem] bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">Main Page Content & Images</h2>
              <p className="mt-2 text-white/60">Edit the text, buttons, and image URLs shown on the homepage.</p>
            </div>
            <a href="/" target="_blank" className="rounded-full border border-white/10 px-5 py-2 font-bold text-forest-400" rel="noreferrer">
              View Home Page
            </a>
          </div>
          <form onSubmit={saveSiteContent} className="mt-6 grid gap-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <input className={inputClass} placeholder="Hero badge EN" value={siteContentForm.hero_badge_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_badge_en: event.target.value })} />
              <input className={inputClass} placeholder="Hero badge AR" value={siteContentForm.hero_badge_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_badge_ar: event.target.value })} />
              <input className={inputClass} placeholder="Hero title EN" value={siteContentForm.hero_title_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_title_en: event.target.value })} />
              <input className={inputClass} placeholder="Hero title AR" value={siteContentForm.hero_title_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_title_ar: event.target.value })} />
              <textarea className={inputClass} placeholder="Hero subtitle EN" value={siteContentForm.hero_subtitle_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_subtitle_en: event.target.value })} />
              <textarea className={inputClass} placeholder="Hero subtitle AR" value={siteContentForm.hero_subtitle_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_subtitle_ar: event.target.value })} />
              <input className={inputClass} placeholder="Main button EN" value={siteContentForm.hero_cta_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_cta_en: event.target.value })} />
              <input className={inputClass} placeholder="Main button AR" value={siteContentForm.hero_cta_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_cta_ar: event.target.value })} />
              <input className={inputClass} placeholder="Second button EN" value={siteContentForm.hero_secondary_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_secondary_en: event.target.value })} />
              <input className={inputClass} placeholder="Second button AR" value={siteContentForm.hero_secondary_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_secondary_ar: event.target.value })} />
              <input className={inputClass} placeholder="Hero note EN" value={siteContentForm.hero_note_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_note_en: event.target.value })} />
              <input className={inputClass} placeholder="Hero note AR" value={siteContentForm.hero_note_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_note_ar: event.target.value })} />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <input className={inputClass} placeholder="Hero background image URL" value={siteContentForm.hero_background_url} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_background_url: event.target.value })} />
              <input className={inputClass} placeholder="Hero side image URL" value={siteContentForm.hero_side_image_url} onChange={(event) => setSiteContentForm({ ...siteContentForm, hero_side_image_url: event.target.value })} />
              <input className={inputClass} placeholder="Why section image URL" value={siteContentForm.why_image_url} onChange={(event) => setSiteContentForm({ ...siteContentForm, why_image_url: event.target.value })} />
            </div>
            <div className="grid gap-4 lg:grid-cols-2">
              <input className={inputClass} placeholder="Vehicle section title EN" value={siteContentForm.vehicles_title_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, vehicles_title_en: event.target.value })} />
              <input className={inputClass} placeholder="Vehicle section title AR" value={siteContentForm.vehicles_title_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, vehicles_title_ar: event.target.value })} />
              <textarea className={inputClass} placeholder="Vehicle section subtitle EN" value={siteContentForm.vehicles_subtitle_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, vehicles_subtitle_en: event.target.value })} />
              <textarea className={inputClass} placeholder="Vehicle section subtitle AR" value={siteContentForm.vehicles_subtitle_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, vehicles_subtitle_ar: event.target.value })} />
              <input className={inputClass} placeholder="Routes section title EN" value={siteContentForm.routes_title_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, routes_title_en: event.target.value })} />
              <input className={inputClass} placeholder="Routes section title AR" value={siteContentForm.routes_title_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, routes_title_ar: event.target.value })} />
              <textarea className={inputClass} placeholder="Routes section subtitle EN" value={siteContentForm.routes_subtitle_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, routes_subtitle_en: event.target.value })} />
              <textarea className={inputClass} placeholder="Routes section subtitle AR" value={siteContentForm.routes_subtitle_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, routes_subtitle_ar: event.target.value })} />
              <input className={inputClass} placeholder="Why section title EN" value={siteContentForm.why_title_en} onChange={(event) => setSiteContentForm({ ...siteContentForm, why_title_en: event.target.value })} />
              <input className={inputClass} placeholder="Why section title AR" value={siteContentForm.why_title_ar} onChange={(event) => setSiteContentForm({ ...siteContentForm, why_title_ar: event.target.value })} />
            </div>
            <button className="w-fit rounded-2xl bg-forest-500 px-6 py-3 font-bold text-white">Save Main Page Content</button>
          </form>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white/5 p-6">
          <h2 className="text-2xl font-black">{t("admin.fleetTitle")}</h2>
          <p className="mt-2 text-sm text-white/60">{t("admin.fleetSubtitle")}</p>
          {fleetMessage && (
            <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${fleetMessage.type === "success" ? "bg-forest-500/15 text-forest-200" : "bg-red-500/15 text-red-200"}`}>
              {fleetMessage.text}
            </p>
          )}
          <form onSubmit={saveFleetUnit} className="mt-5 grid gap-3 md:grid-cols-4">
            <input className={inputClass} type="number" min={1} placeholder="Unit #" value={fleetForm.unit_number} onChange={(event) => setFleetForm({ ...fleetForm, unit_number: Number(event.target.value) })} />
            <input className={inputClass} placeholder="Name EN" value={fleetForm.name_en} onChange={(event) => setFleetForm({ ...fleetForm, name_en: event.target.value })} />
            <input className={inputClass} placeholder="Name AR" value={fleetForm.name_ar} onChange={(event) => setFleetForm({ ...fleetForm, name_ar: event.target.value })} />
            <label className="flex items-center gap-3 text-sm text-white/70">
              <input type="checkbox" checked={fleetForm.is_active} onChange={(event) => setFleetForm({ ...fleetForm, is_active: event.target.checked })} />
              Active in fleet
            </label>
            <div className="flex gap-3 md:col-span-4">
              <button className="rounded-2xl bg-forest-500 px-5 py-3 font-bold">{editingFleetId ? t("admin.save") : t("admin.addFleetUnit")}</button>
              {editingFleetId && (
                <button type="button" onClick={() => { setEditingFleetId(null); setFleetForm({ ...emptyFleetForm, unit_number: nextFleetUnitNumber(fleetUnits) }); }} className="rounded-2xl border border-white/10 px-5 py-3 font-bold">
                  Cancel
                </button>
              )}
            </div>
          </form>
          <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {fleetUnits.map((unit) => (
              <div key={unit.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
                <span>
                  #{unit.unit_number} · {unit.name_en}
                  {!unit.is_active && <span className="ms-2 rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-200">Inactive</span>}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditingFleetId(unit.id); setFleetForm({ unit_number: unit.unit_number, name_en: unit.name_en, name_ar: unit.name_ar, is_active: unit.is_active }); setFleetMessage(null); }} className="text-forest-400">{t("admin.edit")}</button>
                  <button type="button" onClick={() => deleteFleetUnit(unit)} className="text-red-300">{t("admin.delete")}</button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm font-bold text-forest-300">{t("admin.fleetCount", { count: fleetUnits.filter((unit) => unit.is_active).length })}</p>
        </section>

        <section className="mt-8 rounded-[2rem] bg-white/5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black">{t("admin.pathsTitle")}</h2>
              <p className="mt-2 max-w-3xl text-sm text-white/60">{t("admin.pathsSubtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              {routes.length > 0 && (
                <button type="button" onClick={deleteAllRoutes} className="rounded-2xl border border-red-300/30 px-5 py-3 font-bold text-red-200 hover:bg-red-500/10">
                  {t("admin.deleteAllPaths")}
                </button>
              )}
              <button type="button" onClick={startAddRoute} className="rounded-2xl bg-forest-500 px-5 py-3 font-bold text-white shadow-glow">
                {t("admin.addPath")}
              </button>
            </div>
          </div>

          {routeMessage && !routeFormOpen && (
            <div
              ref={routeMessage.type === "success" && lastSavedPath ? pathSaveBannerRef : undefined}
              className={`mt-4 rounded-2xl px-4 py-4 ${
                routeMessage.type === "success"
                  ? "border border-forest-400/30 bg-forest-500/15 text-forest-100"
                  : "border border-red-400/30 bg-red-500/15 text-red-200"
              }`}
            >
              {routeMessage.type === "success" && lastSavedPath ? (
                <>
                  <p className="text-lg font-black text-forest-300">
                    {lastSavedPath.action === "created" ? t("admin.pathCreatedTitle") : t("admin.pathUpdatedTitle")}
                  </p>
                  <p className="mt-2 text-sm text-white/90">{routeMessage.text}</p>
                  <p className="mt-2 text-xs text-white/60">
                    {t("admin.pathSaveDetails", {
                      id: lastSavedPath.id,
                      points: lastSavedPath.points,
                      status: lastSavedPath.action === "created" ? t("admin.pathStatusNew") : t("admin.pathStatusModified")
                    })}
                  </p>
                </>
              ) : (
                <p className="text-sm">{routeMessage.text}</p>
              )}
            </div>
          )}

          <div className="mt-6 overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-white/5 text-white/60">
                <tr>
                  <th className="p-3 text-start">#</th>
                  <th className="p-3 text-start">{t("admin.pathName")}</th>
                  <th className="p-3 text-start">{t("admin.pathRoute")}</th>
                  <th className="p-3 text-start">{t("booking.duration")}</th>
                  <th className="p-3 text-start">{t("booking.total")}</th>
                  <th className="p-3 text-start">{t("admin.showOnMainPage")}</th>
                  <th className="p-3 text-start">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {routes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-white/50">{t("admin.noPaths")}</td>
                  </tr>
                ) : (
                  routes.map((route) => (
                    <tr
                      key={route.id}
                      className={`border-t border-white/10 ${
                        lastSavedPath?.id === route.id
                          ? "bg-forest-500/20 ring-1 ring-inset ring-forest-400/40"
                          : viewingRouteId === route.id
                            ? "bg-forest-500/10"
                            : ""
                      }`}
                    >
                      <td className="p-3">
                        {route.id}
                        {lastSavedPath?.id === route.id && (
                          <span className={`mt-1 block rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            lastSavedPath.action === "created" ? "bg-forest-500 text-white" : "bg-sky-500/80 text-white"
                          }`}>
                            {lastSavedPath.action === "created" ? t("admin.pathBadgeNew") : t("admin.pathBadgeUpdated")}
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-white">{route.name_en}</p>
                        <p className="text-xs text-white/50">{route.name_ar}</p>
                        {route.is_popular && <span className="mt-1 inline-block rounded-full bg-forest-500/20 px-2 py-0.5 text-[11px] font-bold text-forest-200">{t("routes.popular")}</span>}
                      </td>
                      <td className="p-3 text-white/70">{route.start_location} → {route.end_location}</td>
                      <td className="p-3">{route.duration_minutes} {t("routes.minutes")}</td>
                      <td className="p-3">{route.price} {t("booking.omr")}</td>
                      <td className="p-3">
                        <label className="inline-flex items-center gap-2 text-sm text-white/80">
                          <input
                            type="checkbox"
                            checked={route.display_on_home}
                            onChange={(event) => toggleRouteDisplay(route, event.target.checked)}
                          />
                          {route.display_on_home ? t("admin.visible") : t("admin.hidden")}
                        </label>
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button type="button" onClick={() => startViewRoute(route.id)} className="rounded-full border border-white/10 px-3 py-1 text-xs font-bold text-white/80 hover:bg-white/10">
                            {t("admin.view")}
                          </button>
                          <button type="button" onClick={() => startEditRoute(route)} className="rounded-full border border-forest-400/30 px-3 py-1 text-xs font-bold text-forest-300 hover:bg-forest-500/10">
                            {t("admin.edit")}
                          </button>
                          <button type="button" onClick={() => deleteRoute(route)} className="rounded-full border border-red-300/30 px-3 py-1 text-xs font-bold text-red-200 hover:bg-red-500/10">
                            {t("admin.delete")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {viewingRoute && (
            <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-bold uppercase tracking-[0.2em] text-forest-400">{t("admin.viewPath")}</p>
                  <h3 className="mt-2 text-2xl font-black">{viewingRoute.name_en}</h3>
                  <p className="mt-1 text-white/60">{viewingRoute.description_en}</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => startEditRoute(viewingRoute)} className="rounded-2xl bg-forest-500 px-4 py-2 text-sm font-bold">{t("admin.edit")}</button>
                  <button type="button" onClick={() => setViewingRouteId(null)} className="rounded-2xl border border-white/10 px-4 py-2 text-sm font-bold">{t("admin.close")}</button>
                </div>
              </div>
              <div className="mt-5">
                <RealMapRoutePreview route={viewingRoute} className="h-80" title={viewingRoute.name_en} />
              </div>
            </div>
          )}

          {routeFormOpen && (
            <div className="mt-6 rounded-2xl border border-forest-400/20 bg-forest-500/5 p-5">
              <h3 className="text-xl font-black">{editingRouteId ? t("admin.editPath") : t("admin.addPath")}</h3>
              {routeMessage && (
                <p className={`mt-4 rounded-2xl px-4 py-3 text-sm ${routeMessage.type === "success" ? "bg-forest-500/15 text-forest-200" : "bg-red-500/15 text-red-200"}`}>
                  {routeMessage.text}
                </p>
              )}
              <form onSubmit={saveRoute} className="mt-5 grid gap-3">
                <input className={inputClass} placeholder="Path name EN" required value={routeForm.name_en} onChange={(event) => setRouteForm({ ...routeForm, name_en: event.target.value })} />
                <input className={inputClass} placeholder="Path name AR" required value={routeForm.name_ar} onChange={(event) => setRouteForm({ ...routeForm, name_ar: event.target.value })} />
                <textarea className={inputClass} placeholder="Description EN" value={routeForm.description_en} onChange={(event) => setRouteForm({ ...routeForm, description_en: event.target.value })} />
                <textarea className={inputClass} placeholder="Description AR" value={routeForm.description_ar} onChange={(event) => setRouteForm({ ...routeForm, description_ar: event.target.value })} />
                <div className="grid gap-3 md:grid-cols-2">
                  <input className={inputClass} type="number" min={1} placeholder="Duration minutes" value={routeForm.duration_minutes} onChange={(event) => setRouteForm({ ...routeForm, duration_minutes: Number(event.target.value) })} />
                  <input className={inputClass} type="number" min={0} step="0.1" placeholder="Path price (OMR)" value={routeForm.price} onChange={(event) => setRouteForm({ ...routeForm, price: Number(event.target.value) })} />
                </div>
                <input className={inputClass} placeholder="Image URL" value={routeForm.image_url} onChange={(event) => setRouteForm({ ...routeForm, image_url: event.target.value })} />

                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="mb-3 font-bold text-forest-400">{t("admin.drawPath")}</p>
                  <p className="mb-4 text-sm text-white/60">{t("admin.drawPathHelp")}</p>
                  <div className="mb-4 flex flex-wrap gap-2">
                    {locationPresets.map((preset) => (
                      <button key={preset.label} type="button" onClick={() => setRouteForm({ ...routeForm, ...preset })} className="rounded-full border border-white/10 px-3 py-2 text-xs font-bold text-white/80 hover:bg-white/10">
                        {preset.label}
                      </button>
                    ))}
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input className={inputClass} placeholder="Start location name" value={routeForm.start_location} onChange={(event) => setRouteForm({ ...routeForm, start_location: event.target.value })} />
                    <input className={inputClass} placeholder="End location name" value={routeForm.end_location} onChange={(event) => setRouteForm({ ...routeForm, end_location: event.target.value })} />
                  </div>
                  <div className="mt-4">
                    <RealMapPathPicker
                      value={routeForm}
                      onChange={(nextRoute) => setRouteForm((current) => ({ ...current, ...nextRoute }))}
                      onRegisterFlush={(flush) => {
                        flushPathEditsRef.current = flush;
                      }}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 text-sm text-white/70">
                  <input type="checkbox" checked={routeForm.is_popular} onChange={(event) => setRouteForm({ ...routeForm, is_popular: event.target.checked })} />
                  {t("admin.markPopular")}
                </label>
                <label className="flex items-center gap-3 text-sm text-white/70">
                  <input type="checkbox" checked={routeForm.display_on_home} onChange={(event) => setRouteForm({ ...routeForm, display_on_home: event.target.checked })} />
                  {t("admin.showOnMainPage")}
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button type="submit" disabled={routeSaving} className="rounded-2xl bg-forest-500 px-5 py-3 font-bold disabled:opacity-60">
                    {routeSaving ? t("admin.pathSaving") : editingRouteId ? t("admin.savePath") : t("admin.createPath")}
                  </button>
                  <button type="button" onClick={closeRouteForm} className="rounded-2xl border border-white/10 px-5 py-3 font-bold">{t("admin.cancel")}</button>
                  {routeSaving && <span className="text-sm font-semibold text-forest-300">{t("admin.pathSavingWait")}</span>}
                </div>
              </form>
            </div>
          )}
        </section>

        <section className="mt-8 rounded-[2rem] bg-white/5 p-6">
          <h2 className="text-2xl font-black">{editingVehicleId ? "Edit Vehicle" : t("admin.addVehicle")}</h2>
            <form onSubmit={saveVehicle} className="mt-5 grid gap-3">
              <input className={inputClass} placeholder="Name EN" value={vehicleForm.name_en} onChange={(event) => setVehicleForm({ ...vehicleForm, name_en: event.target.value })} />
              <input className={inputClass} placeholder="Name AR" value={vehicleForm.name_ar} onChange={(event) => setVehicleForm({ ...vehicleForm, name_ar: event.target.value })} />
              <select className={inputClass} value={vehicleForm.type} onChange={(event) => setVehicleForm({ ...vehicleForm, type: event.target.value })}>
                {vehicleTypes.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <input className={inputClass} type="number" placeholder="Seats" value={vehicleForm.seats} onChange={(event) => setVehicleForm({ ...vehicleForm, seats: Number(event.target.value) })} />
              <input className={inputClass} type="number" placeholder="Price/hour" value={vehicleForm.price_per_hour} onChange={(event) => setVehicleForm({ ...vehicleForm, price_per_hour: Number(event.target.value) })} />
              <input className={inputClass} placeholder="Image URL" value={vehicleForm.image_url} onChange={(event) => setVehicleForm({ ...vehicleForm, image_url: event.target.value })} />
              <label className="flex items-center gap-3 text-sm text-white/70">
                <input type="checkbox" checked={vehicleForm.is_available} onChange={(event) => setVehicleForm({ ...vehicleForm, is_available: event.target.checked })} />
                Available for booking
              </label>
              <label className="flex items-center gap-3 text-sm text-white/70">
                <input type="checkbox" checked={vehicleForm.display_on_home} onChange={(event) => setVehicleForm({ ...vehicleForm, display_on_home: event.target.checked })} />
                Display this buggy/bike in the web application
              </label>
              <div className="flex gap-3">
                <button className="rounded-2xl bg-forest-500 px-5 py-3 font-bold">{editingVehicleId ? t("admin.save") : t("admin.addVehicle")}</button>
                {editingVehicleId && (
                  <button type="button" onClick={() => { setEditingVehicleId(null); setVehicleForm(emptyVehicleForm); }} className="rounded-2xl border border-white/10 px-5 py-3 font-bold">
                    Cancel
                  </button>
                )}
              </div>
            </form>
            <div className="mt-5 space-y-2">
              {vehicles.map((vehicle) => (
                <div key={vehicle.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white/5 p-3">
                  <span>
                    {vehicle.name_en} · {vehicleTypes.find(([value]) => value === vehicle.type)?.[1] || vehicle.type} · {vehicle.price_per_hour} {t("booking.omr")}/hr
                    {!vehicle.display_on_home && <span className="ms-2 rounded-full bg-yellow-500/20 px-2 py-1 text-xs text-yellow-200">Hidden</span>}
                  </span>
                  <div className="flex gap-3">
                    <button onClick={() => { setEditingVehicleId(vehicle.id); setVehicleForm(vehicle); }} className="text-forest-400">Edit</button>
                    <button onClick={() => deleteItem(`/api/admin/vehicles/${vehicle.id}`)} className="text-red-300">{t("admin.delete")}</button>
                  </div>
                </div>
              ))}
            </div>
        </section>
      </div>
    </main>
  );
}
