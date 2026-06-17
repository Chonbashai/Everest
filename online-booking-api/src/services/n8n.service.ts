import { config } from "../config";
import { logger } from "../lib/logger";

export interface N8nBookingPayload {
  appointmentId: number;
  clientName: string;
  phone: string;
  doctorName: string;
  serviceName: string;
  appointmentDate: string;
  startTime: string;
  comment: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
}

export async function sendBookingWebhook(
  payload: N8nBookingPayload,
  onError: (message: string) => Promise<void>,
): Promise<void> {
  if (!config.n8nBookingWebhook) {
    logger.warn({ appointmentId: payload.appointmentId }, "N8N_BOOKING_WEBHOOK is not configured");
    return;
  }

  try {
    const response = await fetch(config.n8nBookingWebhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = `n8n webhook failed with status ${response.status}: ${errorText}`;
      logger.error({ appointmentId: payload.appointmentId, status: response.status }, message);
      await onError(message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown n8n webhook error";
    logger.error({ appointmentId: payload.appointmentId, err: error }, message);
    await onError(message);
  }
}
