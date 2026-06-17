import { Router } from "express";
import { listActiveDoctors } from "../services/appointment.service";

export const doctorsRouter = Router();

doctorsRouter.get("/", async (_req, res, next) => {
  try {
    const doctors = await listActiveDoctors();
    res.json(doctors);
  } catch (error) {
    next(error);
  }
});
