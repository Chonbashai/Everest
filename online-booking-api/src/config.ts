export const config = {
  port: Number(process.env.PORT ?? 3000),
  timezone: process.env.TIMEZONE ?? "Europe/Moscow",
  n8nBookingWebhook: process.env.N8N_BOOKING_WEBHOOK ?? "",
  pendingExpiryMinutes: Number(process.env.PENDING_EXPIRY_MINUTES ?? 15),
  expiryCleanupIntervalMs: Number(process.env.EXPIRY_CLEANUP_INTERVAL_MS ?? 60_000),
};
