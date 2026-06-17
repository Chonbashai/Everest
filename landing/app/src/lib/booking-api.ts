export type Doctor = {
  id: number;
  name: string;
  specialization: string;
  cabinet: string | null;
};

export type Service = {
  id: number;
  title: string;
  category: string;
  durationMinutes: number;
  price: number | null;
};

export type Slot = {
  time: string;
};

export type UtmParams = {
  source: string;
  medium: string;
  campaign: string;
  content: string;
  term: string;
};

export type CreateAppointmentPayload = {
  clientName: string;
  phone: string;
  doctorId: number;
  serviceId: number;
  date: string;
  time: string;
  comment?: string;
  utmSource: string;
  utmMedium: string;
  utmCampaign: string;
  utmContent: string;
  utmTerm: string;
};

async function parseError(response: Response): Promise<string> {
  const data = await response.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : "Ошибка запроса";
}

export async function fetchDoctors(): Promise<Doctor[]> {
  const response = await fetch("/api/doctors");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchServices(): Promise<Service[]> {
  const response = await fetch("/api/services");
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  return response.json();
}

export async function fetchSlots(
  doctorId: number,
  serviceId: number,
  date: string,
): Promise<Slot[]> {
  const params = new URLSearchParams({
    doctorId: String(doctorId),
    serviceId: String(serviceId),
    date,
  });
  const response = await fetch(`/api/slots?${params.toString()}`);
  if (!response.ok) {
    throw new Error(await parseError(response));
  }
  const data = await response.json();
  return data.slots ?? [];
}

export async function createAppointment(
  payload: CreateAppointmentPayload,
): Promise<void> {
  const response = await fetch("/api/appointments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (response.status === 409) {
    throw new Error("SLOT_TAKEN");
  }

  if (!response.ok) {
    throw new Error(await parseError(response));
  }
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d+]/g, "").trim();
}

export function getUtmParams(): UtmParams {
  const params = new URLSearchParams(window.location.search);
  const keys = ["source", "medium", "campaign", "content", "term"] as const;
  const utm = {} as UtmParams;

  keys.forEach((key) => {
    const current = params.get(`utm_${key}`);
    if (current) {
      localStorage.setItem(`utm_${key}`, current);
    }
    utm[key] = localStorage.getItem(`utm_${key}`) || "direct";
  });

  return utm;
}

export function reachBookingGoal(): void {
  const metrikaId = window.APP_CONFIG?.YANDEX_METRIKA_ID;
  if (window.ym && metrikaId) {
    window.ym(Number(metrikaId), "reachGoal", "booking_success");
  }
}

declare global {
  interface Window {
    APP_CONFIG?: {
      YANDEX_METRIKA_ID?: string;
    };
    ym?: (id: number, method: string, goal?: string) => void;
  }
}
