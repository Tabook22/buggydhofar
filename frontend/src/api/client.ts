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
  national_id: string;
  nationality: string;
  hotel_location: string;
  date: string;
  time: string;
  vehicle_id: number;
  route_id: number;
  fleet_unit_ids: number[];
  passengers: number;
  booking_mode: BookingMode;
  group_type?: GroupType | null;
  total_price: number;
  payment_method: string;
  waiver_accepted: boolean;
  waiver_language: string;
  notes?: string;
  promo_code?: string;
};

export type PromoCode = {
  id: number;
  code: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  created_at: string;
};

export type PromoValidatePayload = {
  code: string;
  passengers: number;
  booking_mode: BookingMode;
};

export type MediaAssetCategory = "gallery" | "hero" | "routes" | "testimonials" | "general";

export type MediaAsset = {
  id: number;
  category: MediaAssetCategory;
  media_kind: "image" | "video";
  url: string;
  thumbnail_url: string | null;
  title_en: string | null;
  title_ar: string | null;
  instagram_url: string | null;
  sort_order: number;
  is_active: boolean;
  show_on_home_gallery: boolean;
  created_at: string;
};

export type PromoValidateResult = {
  valid: boolean;
  code: string;
  discount_type: "fixed" | "percent";
  discount_value: number;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_price: number;
  message?: string | null;
};

export type AmwalSmartBoxConfig = {
  booking_id: number;
  booking_number: string;
  script_url: string;
  mid: string;
  tid: string;
  currency_id: number;
  amount_trxn: string;
  merchant_reference: string;
  language_id: string;
  payment_view_type: number;
  trx_date_time: string;
  session_token: string;
  contact_info_type: number;
  return_url: string;
  cancel_url: string;
  ignore_receipt: string;
  secure_hash: string;
  primary_color: string;
};

export type AmwalPaymentResult = {
  success: boolean;
  payment_status: string;
  booking_status: string;
  message: string;
};

export type BookingLookupPayload = {
  booking_number?: string;
  email?: string;
  phone?: string;
};

export type BookingLookupResult = {
  booking_number: string;
  customer_name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  route_name_en: string | null;
  route_name_ar: string | null;
  fleet_unit_numbers: number[];
  bike_count: number;
  booking_mode: string;
  group_type: string | null;
  passengers: number;
  total_price: number;
  payment_method: string;
  payment_status: string;
  booking_status: string;
  check_in_url: string | null;
  checked_in_at: string | null;
  created_at: string;
};

export type BookingResult = {
  id: number;
  booking_number: string;
  customer_name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  vehicle_id: number;
  route_id: number;
  fleet_unit_ids: number[];
  fleet_unit_numbers: number[];
  bike_count: number;
  passengers: number;
  booking_mode: string;
  group_type?: string | null;
  subtotal: number | null;
  tax_amount: number | null;
  discount_amount?: number | null;
  promo_code?: string | null;
  total_price: number;
  payment_method: string;
  payment_status: string;
  booking_status: string;
  check_in_token: string | null;
  check_in_url: string | null;
  checked_in_at: string | null;
  notes?: string | null;
};

export type BookingCheckIn = {
  booking_id: number;
  booking_number: string;
  customer_name: string;
  phone: string;
  email: string;
  date: string;
  time: string;
  passengers: number;
  bike_count: number;
  fleet_unit_numbers: number[];
  route_name_en: string | null;
  route_name_ar: string | null;
  booking_mode?: string | null;
  group_type?: string | null;
  booking_status: string;
  payment_status: string;
  total_price: number;
  checked_in_at: string | null;
  check_in_url: string;
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
  hero_background_type: string;
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
  availability_live_en: string;
  availability_live_ar: string;
  availability_title_en: string;
  availability_title_ar: string;
  availability_subtitle_en: string;
  availability_subtitle_ar: string;
  site_name_en: string;
  site_name_ar: string;
  footer_text_en: string;
  footer_text_ar: string;
  nav_book_en: string;
  nav_book_ar: string;
  footer_admin_en: string;
  footer_admin_ar: string;
  how_title_en: string;
  how_title_ar: string;
  how_step1_title_en: string;
  how_step1_title_ar: string;
  how_step1_text_en: string;
  how_step1_text_ar: string;
  how_step2_title_en: string;
  how_step2_title_ar: string;
  how_step2_text_en: string;
  how_step2_text_ar: string;
  how_step3_title_en: string;
  how_step3_title_ar: string;
  how_step3_text_en: string;
  how_step3_text_ar: string;
  how_step4_title_en: string;
  how_step4_title_ar: string;
  how_step4_text_en: string;
  how_step4_text_ar: string;
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

export type BookingMode = "group" | "individual";

export type GroupType = "family" | "ladies" | "men" | "mix";

export const GROUP_TYPE_OPTIONS: GroupType[] = ["family", "ladies", "men", "mix"];

export function normalizeGroupType(value: unknown): GroupType | "" {
  if (typeof value === "string" && GROUP_TYPE_OPTIONS.includes(value as GroupType)) {
    return value as GroupType;
  }
  return "";
}

export function groupTypeLabel(type: GroupType | "" | null | undefined, language: string): string {
  if (!type) return "";
  const ar = language.startsWith("ar");
  const labels: Record<GroupType, { en: string; ar: string }> = {
    family: { en: "Family", ar: "عائلة" },
    ladies: { en: "Ladies", ar: "سيدات" },
    men: { en: "Men", ar: "رجال" },
    mix: { en: "General", ar: "عامة" }
  };
  return ar ? labels[type].ar : labels[type].en;
}

export function groupTypeDetailRow(
  booking: { booking_mode?: string | null; group_type?: string | null },
  t: (key: string) => string,
  language: string
): [string, string] | null {
  const type = normalizeGroupType(booking.group_type);
  if (booking.booking_mode === "individual" || !type) return null;
  return [t("booking.groupType"), groupTypeLabel(type, language)];
}

export const BUGGY_PRICE_1_PASSENGER = 20;
export const BUGGY_PRICE_PER_PASSENGER_2 = 15;
export const MAX_PASSENGERS_PER_BIKE = 2;
export const MAX_GROUP_PASSENGERS = 40;
export const TAX_RATE = 0.05;
export const TAX_PERCENT = 5;

export function normalizeBookingMode(mode: string | undefined): BookingMode {
  return mode === "individual" ? "individual" : "group";
}

export function bikesRequiredForPassengers(passengers: number, mode: BookingMode = "group") {
  const count = Math.max(passengers, 1);
  if (mode === "individual") return count;
  return Math.ceil(count / MAX_PASSENGERS_PER_BIKE);
}

export function calculateBuggyPrice(passengers: number) {
  if (passengers === 1) return BUGGY_PRICE_1_PASSENGER;
  if (passengers === 2) return BUGGY_PRICE_PER_PASSENGER_2 * 2;
  return 0;
}

export function calculateGroupPrice(totalPassengers: number) {
  return calculateBookingPrice(totalPassengers, "group");
}

export function calculateBookingPrice(totalPassengers: number, mode: BookingMode = "group") {
  if (mode === "individual") {
    return Math.max(totalPassengers, 0) * BUGGY_PRICE_1_PASSENGER;
  }
  let remaining = Math.max(totalPassengers, 0);
  let total = 0;
  while (remaining > 0) {
    const onBike = Math.min(MAX_PASSENGERS_PER_BIKE, remaining);
    total += calculateBuggyPrice(onBike);
    remaining -= onBike;
  }
  return total;
}

export function calculateSubtotal(totalPassengers: number, mode: BookingMode = "group") {
  return calculateBookingPrice(totalPassengers, mode);
}

export function calculateTax(subtotal: number) {
  return Math.round(subtotal * TAX_RATE * 100) / 100;
}

export function calculateTotalWithTax(subtotal: number) {
  return Math.round((subtotal + calculateTax(subtotal)) * 100) / 100;
}

export function calculateBookingTotal(totalPassengers: number, mode: BookingMode = "group") {
  const subtotal = calculateSubtotal(totalPassengers, mode);
  return calculateTotalWithTax(subtotal);
}

export function maxPassengersForAvailableBikes(availableBikes: number, mode: BookingMode) {
  if (availableBikes < 1) return 0;
  if (mode === "individual") return Math.min(MAX_GROUP_PASSENGERS, availableBikes);
  return Math.min(MAX_GROUP_PASSENGERS, availableBikes * MAX_PASSENGERS_PER_BIKE);
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
  localStorage.removeItem("khareef-admin-session");
}

export const ADMIN_TOKEN_KEY = "khareef-admin-token";
export const STAFF_TOKEN_KEY = "khareef-staff-token";

export type AdminModulePermissions = {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
};

export type AdminPermissions = {
  overview: AdminModulePermissions;
  bookings: AdminModulePermissions;
  promo: AdminModulePermissions;
  transfer: AdminModulePermissions;
  content: AdminModulePermissions;
  fleet: AdminModulePermissions;
  paths: AdminModulePermissions;
  vehicles: AdminModulePermissions;
  users: AdminModulePermissions;
};

export type AuthTokenResponse = {
  access_token: string;
  token_type: string;
  role: string;
  username: string;
  is_super_admin?: boolean;
  permissions?: AdminPermissions | null;
};

export type ContactPayload = {
  full_name: string;
  phone: string;
  email: string;
  message: string;
  website?: string;
};

export type ContactResponse = {
  status: string;
  message: string;
};

export function clearStaffToken() {
  localStorage.removeItem(STAFF_TOKEN_KEY);
}

export const api = {
  getVehicles: () => request<Vehicle[]>("/api/vehicles"),
  getRoutes: () => request<RouteExperience[]>("/api/routes"),
  getFleet: () => request<FleetUnit[]>("/api/fleet"),
  getTimeSlots: () => request<{ slots: string[] }>("/api/time-slots"),
  getAvailabilityBoard: (date: string) => request<AvailabilityBoard>(`/api/availability/board?date=${encodeURIComponent(date)}`),
  getFleetAvailability: (date: string, time: string) =>
    request<FleetAvailabilityResponse>(`/api/availability/fleet?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`),
  getSiteContent: () => request<SiteContent>("/api/site-content"),
  getGallery: () => request<MediaAsset[]>("/api/gallery"),
  checkAvailability: (params: URLSearchParams) =>
    request<{ available: boolean; available_count: number; total_bikes: number; message: string }>(`/api/availability?${params.toString()}`),
  createBooking: (payload: BookingPayload) =>
    request<BookingResult>("/api/bookings", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  validatePromoCode: (payload: PromoValidatePayload) =>
    request<PromoValidateResult>("/api/promo-codes/validate", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  submitContact: (payload: ContactPayload) =>
    request<ContactResponse>("/api/contact", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  getBookingConfirmation: (token: string) =>
    request<BookingResult>(`/api/bookings/confirmation/${encodeURIComponent(token)}`),
  lookupBooking: (payload: BookingLookupPayload) =>
    request<BookingLookupResult>("/api/bookings/lookup", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  initAmwalPayment: (bookingId: number, languageId: string) =>
    request<AmwalSmartBoxConfig>("/api/payments/amwal/init", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, language_id: languageId })
    }),
  completeAmwalPayment: (bookingId: number, callbackData: Record<string, unknown>) =>
    request<AmwalPaymentResult>("/api/payments/amwal/complete", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, ...callbackData })
    }),
  abandonAmwalPayment: (bookingId: number, checkInToken: string) =>
    request<{ cancelled: boolean; message: string }>("/api/payments/amwal/abandon", {
      method: "POST",
      body: JSON.stringify({ booking_id: bookingId, check_in_token: checkInToken })
    }),
  abandonAmwalPaymentKeepalive: (bookingId: number, checkInToken: string) => {
    const body = JSON.stringify({ booking_id: bookingId, check_in_token: checkInToken });
    const url = `${API_BASE}/api/payments/amwal/abandon`;
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(url, {
      method: "POST",
      body,
      headers: { "Content-Type": "application/json" },
      keepalive: true
    });
  },
  getCheckInBooking: (token: string) => request<BookingCheckIn>(`/api/check-in/${encodeURIComponent(token)}`),
  staffCheckIn: (token: string, staffToken: string) =>
    request<BookingCheckIn>(`/api/staff/check-in/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${staffToken}` }
    }),
  adminCheckIn: (token: string, adminToken: string) =>
    request<BookingCheckIn>(`/api/admin/check-in/${encodeURIComponent(token)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${adminToken}` }
    }),
  staffLogin: (username: string, password: string) =>
    request<AuthTokenResponse>("/api/staff/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  adminLogin: (username: string, password: string) =>
    request<AuthTokenResponse>("/api/admin/login", {
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
    }),
  adminUploadMedia: async (token: string, file: File, mediaKind: "image" | "video") => {
    const form = new FormData();
    form.append("file", file);
    const response = await fetch(`/api/admin/media/upload?media_kind=${encodeURIComponent(mediaKind)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: form
    });
    if (!response.ok) {
      if (response.status === 413) {
        throw new Error("413 Request Entity Too Large");
      }
      throw new Error(await parseResponseError(response));
    }
    return response.json() as Promise<{ url: string; filename: string; media_kind: string; content_type: string }>;
  }
};
