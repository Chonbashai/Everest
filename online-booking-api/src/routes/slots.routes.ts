import { Router } from "express";
import { slotsQuerySchema } from "../dto/appointments.dto";
import { getSlots } from "../services/appointment.service";

export const slotsRouter = Router();

slotsRouter.get("/", async (req, res, next) => {
  try {
    const query = slotsQuerySchema.parse(req.query);
    const slots = await getSlots(query.doctorId, query.serviceId, query.date);
    res.json({ slots });
  } catch (error) {
    next(error);
  }
});
