export type FleetUnit = {
  id: number;
  unit_number: number;
  name_en: string;
  name_ar: string;
  is_active: boolean;
  created_at: string;
};

export type FleetUnitAvailability = FleetUnit & {
  is_available: boolean;
};

export type SlotAvailability = {
  time: string;
  total_bikes: number;
  booked: number;
  available: number;
};

export type AvailabilityBoard = {
  date: string;
  total_bikes: number;
  slots: SlotAvailability[];
  updated_at: string;
};

export type FleetAvailabilityResponse = {
  date: string;
  time: string;
  total_bikes: number;
  booked: number;
  available: number;
  units: FleetUnitAvailability[];
};

export type Vehicle = {
  id: number;
  name_en: string;
  name_ar: string;
  type: string;
  seats: number;
  price_per_hour: number;
  image_url: string;
  is_available: boolean;
  display_on_home: boolean;
};

export type RouteExperience = {
  id: number;
  name_en: string;
  name_ar: string;
  description_en: string;
  description_ar: string;
  duration_minutes: number;
  price: number;
  image_url: string;
  start_location: string;
  end_location: string;
  start_lat: number;
  start_lng: number;
  end_lat: number;
  end_lng: number;
  path_points: string;
  is_popular: boolean;
  display_on_home: boolean;
};

export type BookingPayload = {
  customer_name: string;
  phone: string;
  email: string;
  nationality: string;
  hotel_location: string;
  date: string;
  time: string;
  vehicle_id: number;
  route_id: number;
  fleet_unit_id: number;
  passengers: number;
  total_price: number;
  payment_method: string;
  notes?: string;
};

export type SiteContent = {
  id: number;
  hero_badge_en: string;
  hero_badge_ar: string;
  hero_title_en: string;
  hero_title_ar: string;
  hero_subtitle_en: string;
  hero_subtitle_ar: string;
  hero_cta_en: string;
  hero_cta_ar: string;
  hero_secondary_en: string;
  hero_secondary_ar: string;
  hero_note_en: string;
  hero_note_ar: string;
  hero_background_url: string;
  hero_side_image_url: string;
  vehicles_title_en: string;
  vehicles_title_ar: string;
  vehicles_subtitle_en: string;
  vehicles_subtitle_ar: string;
  routes_title_en: string;
  routes_title_ar: string;
  routes_subtitle_en: string;
  routes_subtitle_ar: string;
  why_title_en: string;
  why_title_ar: string;
  why_image_url: string;
  transfer_title_en: string;
  transfer_title_ar: string;
  transfer_bank_name_en: string;
  transfer_bank_name_ar: string;
  transfer_account_name_en: string;
  transfer_account_name_ar: string;
  transfer_account_number: string;
  transfer_iban: string;
  transfer_mobile_wallet_en: string;
  transfer_mobile_wallet_ar: string;
  transfer_mobile_number: string;
  transfer_notes_en: string;
  transfer_notes_ar: string;
  transfer_show_title: boolean;
  transfer_show_bank_name: boolean;
  transfer_show_account_name: boolean;
  transfer_show_account_number: boolean;
  transfer_show_iban: boolean;
  transfer_show_mobile_wallet: boolean;
  transfer_show_mobile_number: boolean;
  transfer_show_notes: boolean;
};

export type PaymentTransferInfo = Pick<
  SiteContent,
  | "transfer_title_en"
  | "transfer_title_ar"
  | "transfer_bank_name_en"
  | "transfer_bank_name_ar"
  | "transfer_account_name_en"
  | "transfer_account_name_ar"
  | "transfer_account_number"
  | "transfer_iban"
  | "transfer_mobile_wallet_en"
  | "transfer_mobile_wallet_ar"
  | "transfer_mobile_number"
  | "transfer_notes_en"
  | "transfer_notes_ar"
  | "transfer_show_title"
  | "transfer_show_bank_name"
  | "transfer_show_account_name"
  | "transfer_show_account_number"
  | "transfer_show_iban"
  | "transfer_show_mobile_wallet"
  | "transfer_show_mobile_number"
  | "transfer_show_notes"
>;

export const BUGGY_PRICE_1_PASSENGER = 24;
export const BUGGY_PRICE_PER_PASSENGER_2 = 15;

export function calculateBuggyPrice(passengers: number) {
  if (passengers === 1) return BUGGY_PRICE_1_PASSENGER;
  if (passengers === 2) return BUGGY_PRICE_PER_PASSENGER_2 * 2;
  return 0;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function parseResponseError(response: Response) {
  const text = await response.text();
  try {
    const json = JSON.parse(text) as { detail?: string | Array<{ msg?: string; loc?: (string | number)[] }> };
    if (typeof json.detail === "string") return json.detail;
    if (Array.isArray(json.detail)) {
      return json.detail
        .map((item) => {
          const field = item.loc?.slice(-1)[0] ?? "field";
          return `${field}: ${item.msg ?? "invalid value"}`;
        })
        .join("; ");
    }
  } catch {
    // fall through to raw text
  }
  return text || `Request failed (${response.status})`;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { headers: optionHeaders, ...restOptions } = options;
  const response = await fetch(`${API_BASE}${path}`, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...(optionHeaders || {})
    }
  });

  if (!response.ok) {
    throw new Error(await parseResponseError(response));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return undefined as T;
  }

  return response.json();
}

export function isAdminAuthError(message: string) {
  return /invalid token|token expired|not authenticated|credentials|admin not found/i.test(message);
}

export function clearAdminToken() {
  localStorage.removeItem("khareef-admin-token");
}

export const ADMIN_TOKEN_KEY = "khareef-admin-token";

export const api = {
  getVehicles: () => request<Vehicle[]>("/api/vehicles"),
  getRoutes: () => request<RouteExperience[]>("/api/routes"),
  getFleet: () => request<FleetUnit[]>("/api/fleet"),
  getTimeSlots: () => request<{ slots: string[] }>("/api/time-slots"),
  getAvailabilityBoard: (date: string) => request<AvailabilityBoard>(`/api/availability/board?date=${encodeURIComponent(date)}`),
  getFleetAvailability: (date: string, time: string) =>
    request<FleetAvailabilityResponse>(`/api/availability/fleet?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`),
  getSiteContent: () => request<SiteContent>("/api/site-content"),
  checkAvailability: (params: URLSearchParams) =>
    request<{ available: boolean; available_count: number; total_bikes: number; message: string }>(`/api/availability?${params.toString()}`),
  createBooking: (payload: BookingPayload) =>
    request<BookingPayload & { id: number; booking_number: string; booking_status: string; payment_status: string }>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  adminLogin: (username: string, password: string) =>
    request<{ access_token: string; token_type: string }>("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  adminGet: <T>(path: string, token: string) =>
    request<T>(path, { headers: { Authorization: `Bearer ${token}` } }),
  adminSend: <T>(path: string, token: string, method: string, body?: unknown) =>
    request<T>(path, {
      method,
      headers: { Authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined
    })
};
