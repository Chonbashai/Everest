import { Appointment, AppointmentStatus, Prisma } from "@prisma/client";
import { config } from "../config";
import { prisma } from "../lib/prisma";
import {
  addMinutesToTime,
  getWeekdayFromDate,
  parseDateOnly,
  parseTimeToMinutes,
  rangesOverlap,
} from "../utils/time";

const ACTIVE_STATUSES: AppointmentStatus[] = [
  AppointmentStatus.PENDING,
  AppointmentStatus.CONFIRMED,
];

export function getPendingExpiryCutoff(): Date {
  return new Date(Date.now() - config.pendingExpiryMinutes * 60_000);
}

function isPendingStillActive(status: AppointmentStatus, createdAt: Date): boolean {
  if (status !== AppointmentStatus.PENDING) {
    return status === AppointmentStatus.CONFIRMED;
  }

  return createdAt >= getPendingExpiryCutoff();
}

export async function getAvailableSlots(
  doctorId: number,
  serviceId: number,
  date: string,
): Promise<string[]> {
  const doctor = await prisma.doctor.findFirst({
    where: { id: doctorId, active: true },
  });

  if (!doctor) {
    return [];
  }

  const service = await prisma.service.findFirst({
    where: { id: serviceId, active: true },
  });

  if (!service) {
    return [];
  }

  const weekday = getWeekdayFromDate(date);
  const schedule = await prisma.doctorSchedule.findFirst({
    where: { doctorId, weekday },
  });

  if (!schedule) {
    return [];
  }

  const appointmentDate = parseDateOnly(date);
  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId,
      appointmentDate,
      status: { in: ACTIVE_STATUSES },
    },
  });

  const blockingAppointments = appointments.filter((item: Appointment) =>
    isPendingStillActive(item.status, item.createdAt),
  );

  const scheduleStart = parseTimeToMinutes(schedule.startTime);
  const scheduleEnd = parseTimeToMinutes(schedule.endTime);
  const slotStep = 30;
  const available: string[] = [];

  for (
    let startMinutes = scheduleStart;
    startMinutes + service.durationMinutes <= scheduleEnd;
    startMinutes += slotStep
  ) {
    const endMinutes = startMinutes + service.durationMinutes;
    const overlaps = blockingAppointments.some((appointment: Appointment) => {
      const appointmentStart = parseTimeToMinutes(appointment.startTime);
      const appointmentEnd = parseTimeToMinutes(appointment.endTime);
      return rangesOverlap(startMinutes, endMinutes, appointmentStart, appointmentEnd);
    });

    if (!overlaps) {
      const hours = Math.floor(startMinutes / 60);
      const minutes = startMinutes % 60;
      available.push(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`,
      );
    }
  }

  return available;
}

export async function isSlotAvailable(
  doctorId: number,
  serviceId: number,
  date: string,
  time: string,
): Promise<boolean> {
  const slots = await getAvailableSlots(doctorId, serviceId, date);
  return slots.includes(time);
}

export function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

export function calculateEndTime(startTime: string, durationMinutes: number): string {
  return addMinutesToTime(startTime, durationMinutes);
}
