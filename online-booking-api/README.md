# online-booking-api

REST API онлайн-записи для клиники «Эверест Мед».

## Стек

- Node.js 20, TypeScript (strict)
- Express
- Prisma + PostgreSQL 16
- Pino (логи)
- Zod (DTO / validation)

## Архитектура доступа

- Сервис **не публикует порты** наружу — только сеть `everest-net`.
- Браузер обращается к API через same-origin прокси лендинга: `/api/*` → `booking-api:3000/api/*`.
- CORS **не используется**.

## Переменные окружения

См. [.env.example](.env.example).

| Переменная | Описание |
|------------|----------|
| `DATABASE_URL` | PostgreSQL connection string |
| `PORT` | Порт внутри контейнера (3000) |
| `N8N_BOOKING_WEBHOOK` | URL webhook n8n для новых записей |
| `TIMEZONE` | Часовой пояс (Europe/Moscow) |
| `PENDING_EXPIRY_MINUTES` | Автоотмена PENDING через N минут (по умолчанию 15) |

## Запуск в Docker (рекомендуется)

Из корня репозитория:

```bash
docker compose up -d --build booking-db booking-api landing
docker compose exec booking-api npx prisma db seed
```

Проверка API **только через landing proxy**:

```bash
curl http://localhost:8081/api/doctors
curl "http://localhost:8081/api/slots?doctorId=1&serviceId=1&date=2026-07-01"
```

Healthcheck внутри контейнера:

```bash
docker compose exec booking-api curl -f http://localhost:3000/health
```

## Локальная разработка

```bash
cd online-booking-api
cp .env.example .env
npm install
npx prisma generate
npx prisma migrate deploy
npm run prisma:seed
npm run dev
```

## API

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/health` | Healthcheck |
| GET | `/api/doctors` | Активные врачи |
| GET | `/api/services` | Активные услуги |
| GET | `/api/slots?doctorId=&serviceId=&date=` | Свободные слоты |
| POST | `/api/appointments` | Создание записи |

### POST /api/appointments

```json
{
  "clientName": "Анна",
  "phone": "+79991234567",
  "doctorId": 1,
  "serviceId": 2,
  "date": "2026-07-01",
  "time": "11:00",
  "comment": "Первый визит",
  "utmSource": "everestmed",
  "utmMedium": "website",
  "utmCampaign": "organic",
  "utmContent": "button",
  "utmTerm": "direct"
}
```

**409 Conflict:** `{ "error": "Slot already booked" }`

## Защита от двойного бронирования

Partial unique index в PostgreSQL:

```sql
UNIQUE (doctorId, appointmentDate, startTime)
WHERE status IN ('PENDING', 'CONFIRMED')
```

`CANCELLED` и `COMPLETED` не блокируют слот.

## Временная бронь (PENDING)

- Новая запись создаётся со статусом `PENDING`.
- Слот блокируется на **15 минут** (настраивается через `PENDING_EXPIRY_MINUTES`).
- Фоновая задача в API каждую минуту переводит просроченные `PENDING` → `CANCELLED`.
- Дополнительно можно настроить n8n Cron для мониторинга.

## Миграции и seed

```bash
npx prisma migrate deploy
npx prisma db seed
```

Seed: 3 врача (Иванова, Петрова, Сидорова), 5 услуг, график пн–пт 09:00–18:00.
