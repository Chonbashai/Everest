import { createApp } from "./app";
import { config } from "./config";
import { logger } from "./lib/logger";
import { expirePendingAppointments, startPendingExpiryJob } from "./services/appointment.service";

const app = createApp();

void expirePendingAppointments().catch((error) => {
  logger.error({ err: error }, "Initial pending expiry cleanup failed");
});

const expiryJob = startPendingExpiryJob();

const server = app.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      pendingExpiryMinutes: config.pendingExpiryMinutes,
    },
    "Online booking API started",
  );
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  clearInterval(expiryJob);
  server.close(() => {
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
