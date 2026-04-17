# Everest

Проект для клиники **Эверест Мед**: лендинг онлайн-записи на услуги ([book.everestmed.ru](https://book.everestmed.ru)) и **SalesMan CRM** с интеграцией через **n8n**. На сервере развёртывается в `/opt/everest/`.

Подробная архитектура, API, Метрика, UTM и настройка Nginx Proxy Manager — в [docs/technical-doc.md](docs/technical-doc.md).

## Стек

| Компонент | Описание |
|-----------|----------|
| **landing** | Nginx + статика (`landing/`), форма отправляет заявки в n8n через `fetch`, Яндекс.Метрика и UTM-метки |
| **crm** | [SalesMan CRM](https://github.com/vladandreevg/salesmancrm), образ `php:7.4-apache` |
| **db** | MySQL 8.0, только внутренняя сеть `everest-net` |
| **Снаружи** | Nginx Proxy Manager (SSL), n8n (webhook) |

## Структура репозитория

```
/opt/everest/   (или корень репозитория)
├── docker-compose.yml
├── .env.example          # шаблон переменных
├── .env                  # создаётся вручную на сервере, не в git
├── landing/
│   ├── index.html
│   ├── nginx.conf
│   └── config.template.js   # подстановка через envsubst → config.js
├── salesmancrm/          # git clone репозитория SalesMan
└── docs/
    └── technical-doc.md
```

## Требования

- Docker и Docker Compose
- Сеть Docker **nginx-proxy-manager_default** должна существовать (Nginx Proxy Manager). Контейнеры `landing` и `crm` подключаются к ней и к внутренней сети `everest-net`; **MySQL** только в `everest-net`.

## Быстрый старт

1. Склонировать CRM в каталог проекта:

   ```bash
   git clone https://github.com/vladandreevg/salesmancrm.git salesmancrm
   ```

2. Скопировать шаблон окружения и заполнить значения:

   ```bash
   cp .env.example .env
   ```

   Обязательно задайте `N8N_WEBHOOK_URL`, `YANDEX_METRIKA_ID`, параметры MySQL и при необходимости `SALESMAN_API_KEY` для n8n.

3. Запуск:

   ```bash
   docker compose up -d
   ```

4. Лендинг: `http://<host>:8081`  
   CRM (установка): `http://<host>:8082/_install/`

5. В Nginx Proxy Manager добавьте proxy host на домены (например `book.everestmed.ru` → сервис `landing`, порт **8081**; CRM → `crm`, порт **8082**) по [инструкции в документации](docs/technical-doc.md).

## Переменные окружения

См. [.env.example](.env.example). Чувствительные данные только в `.env` на сервере.

## Что не коммитить

- `.env`
- `salesmancrm/files/` (вложения CRM)
- `*.log`, `logs/`, временные и кэш-файлы

См. [.gitignore](.gitignore).
