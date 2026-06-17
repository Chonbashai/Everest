import { Router } from "express";
import { createAppointmentSchema } from "../dto/appointments.dto";
import { createAppointment } from "../services/appointment.service";

export const appointmentsRouter = Router();

appointmentsRouter.post("/", async (req, res, next) => {
  try {
    const body = createAppointmentSchema.parse(req.body);
    const appointment = await createAppointment(body);
    res.status(201).json(appointment);
  } catch (error) {
    next(error);
  }
});
