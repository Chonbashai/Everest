import { z } from "zod";

export const slotsQuerySchema = z.object({
  doctorId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
});

export type SlotsQueryDto = z.infer<typeof slotsQuerySchema>;

export const createAppointmentSchema = z.object({
  clientName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(10).max(20),
  doctorId: z.coerce.number().int().positive(),
  serviceId: z.coerce.number().int().positive(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  time: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "time must be HH:mm"),
  comment: z.string().trim().max(500).optional(),
  utmSource: z.string().trim().max(100).optional(),
  utmMedium: z.string().trim().max(100).optional(),
  utmCampaign: z.string().trim().max(100).optional(),
  utmContent: z.string().trim().max(100).optional(),
  utmTerm: z.string().trim().max(100).optional(),
});

export type CreateAppointmentDto = z.infer<typeof createAppointmentSchema>;
