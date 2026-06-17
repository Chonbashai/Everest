import express from "express";
import pinoHttp from "pino-http";
import { logger } from "./lib/logger";
import { errorHandler } from "./middleware/errorHandler";
import { appointmentsRouter } from "./routes/appointments.routes";
import { doctorsRouter } from "./routes/doctors.routes";
import { healthRouter } from "./routes/health.routes";
import { servicesRouter } from "./routes/services.routes";
import { slotsRouter } from "./routes/slots.routes";

export function createApp() {
  const app = express();

  app.use(express.json({ limit: "32kb" }));
  app.use(
    pinoHttp({
      logger,
      autoLogging: {
        ignore: (req) => req.url === "/health",
      },
    }),
  );

  app.use(healthRouter);
  app.use("/api/doctors", doctorsRouter);
  app.use("/api/services", servicesRouter);
  app.use("/api/slots", slotsRouter);
  app.use("/api/appointments", appointmentsRouter);

  app.use(errorHandler);

  return app;
}
