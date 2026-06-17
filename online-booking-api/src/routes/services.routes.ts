import { Router } from "express";
import { listActiveServices } from "../services/appointment.service";

export const servicesRouter = Router();

servicesRouter.get("/", async (_req, res, next) => {
  try {
    const services = await listActiveServices();
    res.json(services);
  } catch (error) {
    next(error);
  }
});
