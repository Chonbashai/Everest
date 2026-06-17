import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const doctors = [
  { name: "Иванова", specialization: "Косметолог", cabinet: "101" },
  { name: "Петрова", specialization: "Массажист", cabinet: "102" },
  { name: "Сидорова", specialization: "Косметолог", cabinet: "103" },
];

const services = [
  { title: "Фотоэпиляция", category: "Косметология", durationMinutes: 60, price: 3500, doctorPercent: 30 },
  { title: "Массаж", category: "Массаж", durationMinutes: 60, price: 3000, doctorPercent: 40 },
  { title: "Чистка лица", category: "Косметология", durationMinutes: 90, price: 4500, doctorPercent: 35 },
  { title: "Прокол ушей", category: "Прокол", durationMinutes: 30, price: 1500, doctorPercent: 25 },
  { title: "Консультация косметолога", category: "Косметология", durationMinutes: 30, price: 2000, doctorPercent: 20 },
];

async function main() {
  await prisma.appointment.deleteMany();
  await prisma.doctorSchedule.deleteMany();
  await prisma.doctor.deleteMany();
  await prisma.service.deleteMany();

  for (const service of services) {
    await prisma.service.create({ data: service });
  }

  for (const doctor of doctors) {
    const created = await prisma.doctor.create({ data: doctor });

    for (const weekday of [1, 2, 3, 4, 5]) {
      await prisma.doctorSchedule.create({
        data: {
          doctorId: created.id,
          weekday,
          startTime: "09:00",
          endTime: "18:00",
        },
      });
    }
  }

  console.log("Seed completed: 3 doctors, 5 services, Mon-Fri 09:00-18:00 schedules.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
