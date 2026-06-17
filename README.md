# Everest

Проект для клиники **Эверест Мед**: лендинг онлайн-записи на услуги ([book.everestmed.ru](https://book.everestmed.ru)), **online-booking-api** (расписание и слоты), **SalesMan CRM** с интеграцией через **n8n**. На сервере развёртывается в `/opt/everest/`.

Подробная архитектура, API, Метрика, UTM и настройка Nginx Proxy Manager — в [docs/technical-doc.md](docs/technical-doc.md).

## Стек

| Компонент | Описание |
|-----------|----------|
| **landing** | React SPA (`landing/app/`) + Nginx, reverse proxy `/api/*` → booking-api, Яндекс.Метрика и UTM |
| **booking-api** | Node.js 20 + Express + Prisma — расписание, слоты, записи ([online-booking-api/](online-booking-api/)) |
| **booking-db** | PostgreSQL 16 — база онлайн-записи (только `everest-net`) |
| **crm** | [SalesMan CRM](https://github.com/vladandreevg/salesmancrm), кастомный образ ([crm/Dockerfile](crm/Dockerfile)) |
| **db** | MySQL 8.0 — база CRM (только `everest-net`) |
| **Снаружи** | Nginx Proxy Manager (SSL), n8n (webhook) |

## Архитектура записи

```
Браузер → book.everestmed.ru (landing nginx)
              ↓ /api/*
         booking-api → PostgreSQL
              ↓ N8N_BOOKING_WEBHOOK
            n8n → SalesMan CRM
```

Booking API **не публикует порты** наружу. Доступ только через nginx лендинга (same-origin).

## Структура репозитория

```
├── docker-compose.yml
├── online-booking-api/     # REST API онлайн-записи
├── crm/
├── landing/
│   ├── app/                # React SPA (онлайн-запись)
│   ├── Dockerfile
│   └── nginx.conf
├── salesmancrm/
├── .env.example
└── docs/technical-doc.md
```

## Требования

- Docker и Docker Compose
- Сеть Docker **nginx-proxy-manager_default** (Nginx Proxy Manager)
- Внутренняя сеть **everest-net**

## Быстрый старт

1. Склонировать CRM:

   ```bash
   git clone https://github.com/vladandreevg/salesmancrm.git salesmancrm
   ```

2. Скопировать и заполнить `.env`:

   ```bash
   cp .env.example .env
   ```

   Обязательно: `BOOKING_POSTGRES_PASSWORD`, `BOOKING_DATABASE_URL`, `N8N_BOOKING_WEBHOOK`, `YANDEX_METRIKA_ID`, параметры MySQL.

3. Сборка и запуск:

   ```bash
   docker compose build
   docker compose up -d
   ```

4. Seed базы записи (первый запуск):

   ```bash
   docker compose exec booking-api npx prisma db seed
   ```

5. Проверка:

   - Лендинг: `http://<host>:8081`
   - API через proxy: `curl http://<host>:8081/api/doctors`
   - CRM: `http://<host>:8082/_install/`

6. NPM: один proxy host на `book.everestmed.ru` → `landing:8081` (отдельный домен для API **не нужен**).

## Миграции booking-api

Миграции применяются автоматически при старте контейнера (`prisma migrate deploy`).

Ручной запуск:

```bash
docker compose exec booking-api npx prisma migrate deploy
docker compose exec booking-api npx prisma db seed
```

## Примеры API (через landing proxy)

```bash
curl http://localhost:8081/api/doctors
curl http://localhost:8081/api/services
curl "http://localhost:8081/api/slots?doctorId=1&serviceId=1&date=2026-07-01"

curl -X POST http://localhost:8081/api/appointments \
  -H "Content-Type: application/json" \
  -d '{"clientName":"Тест","phone":"+79991234567","doctorId":1,"serviceId":1,"date":"2026-07-01","time":"09:00"}'
```

## Порядок деплоя

1. Обновить код на сервере (`git pull`)
2. Заполнить `.env` (в т.ч. `N8N_BOOKING_WEBHOOK`)
3. `docker compose up -d --build`
4. `docker compose exec booking-api npx prisma db seed` (если первый запуск)
5. Настроить n8n workflow на новый webhook
6. Smoke-test: запись через book.everestmed.ru → PostgreSQL → n8n → CRM

## Переменные окружения

См. [.env.example](.env.example).

## Что не коммитить

- `.env`
- `salesmancrm/files/`
- `online-booking-api/node_modules/`, `dist/`
- `*.log`, `logs/`

См. [.gitignore](.gitignore).
