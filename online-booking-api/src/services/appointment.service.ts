import { AppointmentStatus } from "@prisma/client";
import { config } from "../config";
import { CreateAppointmentDto } from "../dto/appointments.dto";
import { ConflictError, NotFoundError, ValidationError } from "../errors/AppError";
import { logger } from "../lib/logger";
import { prisma } from "../lib/prisma";
import { isValidPhone, normalizePhone } from "../utils/phone";
import { parseDateOnly } from "../utils/time";
import { sendBookingWebhook } from "./n8n.service";
import {
  calculateEndTime,
  getAvailableSlots,
  isSlotAvailable,
  isUniqueConstraintViolation,
} from "./slot.service";

export async function listActiveDoctors() {
  return prisma.doctor.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      specialization: true,
      cabinet: true,
    },
  });
}

export async function listActiveServices() {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: { title: "asc" },
    select: {
      id: true,
      title: true,
      category: true,
      durationMinutes: true,
      price: true,
    },
  });
}

export async function getSlots(doctorId: number, serviceId: number, date: string) {
  const slots = await getAvailableSlots(doctorId, serviceId, date);
  return slots.map((time) => ({ time }));
}

export async function createAppointment(input: CreateAppointmentDto) {
  if (!isValidPhone(input.phone)) {
    throw new ValidationError("Invalid phone number");
  }

  const phone = normalizePhone(input.phone);
  const doctor = await prisma.doctor.findFirst({ where: { id: input.doctorId, active: true } });
  if (!doctor) {
    throw new NotFoundError("Doctor not found");
  }

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, active: true },
  });
  if (!service) {
    throw new NotFoundError("Service not found");
  }

  const slotAvailable = await isSlotAvailable(
    input.doctorId,
    input.serviceId,
    input.date,
    input.time,
  );

  if (!slotAvailable) {
    throw new ConflictError("Slot already booked");
  }

  const appointmentDate = parseDateOnly(input.date);
  const endTime = calculateEndTime(input.time, service.durationMinutes);

  try {
    const appointment = await prisma.appointment.create({
      data: {
        clientName: input.clientName,
        phone,
        doctorId: input.doctorId,
        serviceId: input.serviceId,
        appointmentDate,
        startTime: input.time,
        endTime,
        status: AppointmentStatus.PENDING,
        comment: input.comment ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        utmContent: input.utmContent ?? null,
        utmTerm: input.utmTerm ?? null,
      },
      include: {
        doctor: true,
        service: true,
      },
    });

    void sendBookingWebhook(
      {
        appointmentId: appointment.id,
        clientName: appointment.clientName,
        phone: appointment.phone,
        doctorName: appointment.doctor.name,
        serviceName: appointment.service.title,
        appointmentDate: input.date,
        startTime: appointment.startTime,
        comment: appointment.comment,
        utmSource: appointment.utmSource,
        utmMedium: appointment.utmMedium,
        utmCampaign: appointment.utmCampaign,
        utmContent: appointment.utmContent,
        utmTerm: appointment.utmTerm,
      },
      async (message) => {
        await prisma.appointment.update({
          where: { id: appointment.id },
          data: { webhookError: message },
        });
      },
    );

    return {
      id: appointment.id,
      status: appointment.status,
      clientName: appointment.clientName,
      phone: appointment.phone,
      doctorId: appointment.doctorId,
      serviceId: appointment.serviceId,
      appointmentDate: input.date,
      startTime: appointment.startTime,
      endTime: appointment.endTime,
      pendingExpiresInMinutes: config.pendingExpiryMinutes,
    };
  } catch (error) {
    if (isUniqueConstraintViolation(error)) {
      throw new ConflictError("Slot already booked");
    }

    throw error;
  }
}

export async function expirePendingAppointments(): Promise<number> {
  const cutoff = new Date(Date.now() - config.pendingExpiryMinutes * 60_000);

  const result = await prisma.appointment.updateMany({
    where: {
      status: AppointmentStatus.PENDING,
      createdAt: { lt: cutoff },
    },
    data: {
      status: AppointmentStatus.CANCELLED,
    },
  });

  if (result.count > 0) {
    logger.info({ count: result.count }, "Expired pending appointments cancelled");
  }

  return result.count;
}

export function startPendingExpiryJob(): NodeJS.Timeout {
  return setInterval(() => {
    void expirePendingAppointments().catch((error) => {
      logger.error({ err: error }, "Failed to expire pending appointments");
    });
  }, config.expiryCleanupIntervalMs);
}
