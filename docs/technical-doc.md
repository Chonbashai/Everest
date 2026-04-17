
# Техническая документация: Посадочная страница + CRM для клиники "Эверест"

**(VPS Beget, Docker, NPM, n8n)**

---

## API Overview

### Purpose

Интеграция обеспечивает автоматическую связь между посадочной страницей для записи на услуги клиники "Эверест" и CRM "Профессиональное управление продажами" (SalesMan CRM). Новая заявка с лендинга поступает в CRM, формируя карточки клиентов, сделки и события в календаре. Инфраструктура целиком работает на Docker-контейнерах в рамках текущей архитектуры VPS, с маршрутизацией через Nginx Proxy Manager и обработкой логики интеграции с помощью n8n.

---

### Architecture

* **API style:** REST (`/api/v2/`).
* **Base URLs:**
  * CRM: `http://crm.yourdomain.ru/`
  * Лендинг: `http://book.yourdomain.ru/`
  * Все внешние запросы проходят через **Nginx Proxy Manager** (NPM).

Инфраструктурная схема:

| Компонент | Контейнер/порт | Доступ | Назначение |
| --- | --- | --- | --- |
| Nginx Proxy Manager | :80, :443, :81 | 217.114.14.124:80/443/81 | SSL-прокси, админ-панель |
| Лендинг | :8081 (внутр:80) | Только через NPM | Обработка форм, statics, POST на n8n или PHP |
| CRM | :8082 (внутр:80) | Только через NPM | SalesMan CRM, API |
| MySQL | intern :3306 | Внутри docker-network | База для CRM |
| n8n | :5678 | 217.114.14.124:5678 | Интеграционная логика, Webhook-поток записей |

**Внешний поток:**  

Браузер → DNS → Nginx Proxy Manager (SSL/TLS) → (внешний домен, напр. book.everestmed.ru) → internal landing (8081)  

CRM через crm.everestmed.ru → internal crm (8082)

Сеть Docker

Все контейнеры должны находиться в одной пользовательской сети (например, `everest-net`), для seamless-проксификации со стороны NPM.

---

### Core Capabilities

* Онлайн-приём заявок с лендинга (форма: имя, телефон, услуга, дата, время)
* Передача данных в CRM: поиск/создание клиента → сделка → календарное дело/шахматка
* Учёт и отчёты в единой CRM-базе
* Интеграция с Telegram для мгновенных уведомлений через workflow n8n (без программирования)

---

## Authentication

### Methods

* **CRM API Key**
* Генерация: SalesMan CRM → Настройки → API → сгенерировать токен
* Ключ прописывается ТОЛЬКО в `.env` на сервере или в секрете n8n

**Пример заголовка:**

```
Authorization: Bearer ваш\_ключ

```

API-ключ не должен быть доступен с фронтенда!

---

### Token Management

* Выпускается вручную, бессрочный
* При утраченной безопасности — регенерация через CRM
* Всегда храните вне публичного репозитория

---

## Endpoints

**Полные параметры API и форматы — в предыдущих разделах. Используйте** `/api/v2/clients`**,** `/api/v2/deals`**,** `/api/v2/tasks` **для поиска/создания сущностей (см. Endpoints выше).**

---

## Code Examples

(См. разделы выше: формы, JS, curl, пример PHP-прокси.)

---

## Webhooks & Events

### Интеграция через n8n (РЕКОМЕНДУЕМЫЙ ПОДХОД)

Архитектурный поток

1. **Форма на лендинге** отправляет POST-запрос на вебхук n8n:  

  `http://217.114.14.124:5678/webhook/everest-booking`
2. **n8n workflow** последовательно:
  * Проверяет наличие клиента по телефону через HTTP Request
  * Если клиент найден: использует id; если не найден — создаёт клиента
  * Создаёт сделку («Запись на …»)
  * Добавляет календарное дело/визит
  * Отправляет оповещение в Telegram
3. n8n визуально администрируется через Web UI:  

  `http://217.114.14.124:5678` (в браузере)

**Преимущества n8n:**

* Нет никакого кода; вся логика редактируется в визуальном редакторе
* Можно масштабировать заказные сценарии (например, Email, SMS, доп. CRM)
* Мгновенное обновление бизнес-логики без остановки контейнеров

Альтернатива: Если нужно, можно использовать PHP-прокси как описано ранее, но n8n предпочтительнее.

---

### Настройка n8n Workflow

1. Перейдите в интерфейс n8n по адресу: `http://217.114.14.124:5678`
2. Создайте новый Workflow, дайте ему имя, включите Active
3. Ветвление:
  * **Webhook Trigger** (POST, URL: `/webhook/everest-booking`)
  * **HTTP Request**: GET в CRM `/api/v2/clients?search={{ $json["phone"] }}`
  * **IF Node**: найден/не найден клиент
  * **HTTP Request**: POST в CRM `/api/v2/clients` (если не найден)
  * **HTTP Request**: POST в CRM `/api/v2/deals` с client_id
  * **HTTP Request**: POST в CRM `/api/v2/tasks` с deal_id и временем
  * **Telegram Node**: короткое описание заявки для админа (бот подключается к чату)
4. Все HTTP запросы к API CRM снабжены заголовком `Authorization: Bearer ...` (API-ключ подставить в Credentials из .env)
5. Финальный шаг: ответить 200 OK заявителю.

---

## Настройка Nginx Proxy Manager

Пошаговая инструкция по добавлению новых proxy host:

1. Зайдите в NPM: `http://217.114.14.124:81` (используйте admin/pwd — смените по необходимости)
2. Нажмите “Add Proxy Host”
3. В поле **Domain Names** — укажите ваш внешний домен (например, `book.everestmed.ru` для лендинга, `crm.everestmed.ru` для CRM)
4. В **Scheme**: http
5. В **Forward Hostname / IP**: название соответствующего контейнера (landing или crm)  

  (Контейнеры внутри docker сети видны по имени сервиса: `landing`, `crm`)
6. В **Forward Port**:
  * 8081 для landing
  * 8082 для CRM
7. Включите SSL (Let’s Encrypt), поставьте галочку на Force SSL, http2 и HSTS (рекомендуется)
8. Сохраните, перезапустите через NPM, дождитесь сертификата

---

## Аналитика: UTM-метки и Яндекс.Метрика

### Зачем это нужно

Владелец клиники видит общий трафик сайта everestmed.ru, но не видит какой источник даёт реальные записи. UTM-метки и цели в Метрике решают две задачи одновременно: для владельца клиники — прозрачность откуда приходят клиенты; для Bloom — возможность доказать ценность своей работы и точно считать конверсии для расчёта своего процента от каждой записи.

### Установка Яндекс.Метрики на лендинг

1. Зайти на metrika.yandex.ru, нажать "Добавить счётчик"
2. Название: "Эверест — Запись", адрес сайта: book.everestmed.ru
3. Включить опции: Вебвизор, Карта кликов, Аналитика форм — они покажут как пользователи взаимодействуют с формой записи
4. Скопировать код счётчика и вставить в index.html лендинга перед закрывающим тегом :

```html
<!-- Яндекс.Метрика -->
<script type="text/javascript">
   (function(m,e,t,r,i,k,a){m\[i\]=m\[i\]||function(){(m\[i\].a=m\[i\].a||\[\]).push(arguments)};
   m\[i\].l=1\*new Date();
   for (var j = 0; j < document.scripts.length; j++) {if (document.scripts\[j\].src === r) { return; }}
   k=e.createElement(t),a=e.getElementsByTagName(t)\[0\],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
   ym(XXXXXXXX, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true,
        webvisor:true
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/XXXXXXXX" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Яндекс.Метрика -->

```

Заменить XXXXXXXX на реальный номер счётчика из Метрики.

### Настройка цели в Метрике

1. В Яндекс.Метрике перейти в Настройки → Цели → Добавить цель
2. Тип: JavaScript-событие
3. Название: "Успешная запись"
4. Идентификатор: booking_success
5. В JS-коде лендинга, в блоке успешной отправки формы (после проверки json.success), добавить:

```javascript
// Передаём цель в Яндекс.Метрику
ym(XXXXXXXX, 'reachGoal', 'booking_success');

```

Теперь каждая успешная запись будет фиксироваться как конверсия в Метрике.

### UTM-метки для отслеживания источников

Попросить владельца клиники поставить кнопки "Записаться" на все страницы услуг со следующими ссылками:

Главная страница сайта everestmed.ru:

```
https://book.everestmed.ru/?utm_source=everestmed&utm_medium=website&utm_campaign=organic&utm_content=button_header

```

Страница косметологии:

```
https://book.everestmed.ru/?utm_source=everestmed&utm_medium=website&utm_campaign=organic&utm_content=kosmetologiya

```

Страница фотоэпиляции:

```
https://book.everestmed.ru/?utm_source=everestmed&utm_medium=website&utm_campaign=organic&utm_content=fotoepilyaciya

```

Страница массажа:

```
https://book.everestmed.ru/?utm_source=everestmed&utm_medium=website&utm_campaign=organic&utm_content=massazh

```

Страница прокола ушей:

```
https://book.everestmed.ru/?utm_source=everestmed&utm_medium=website&utm_campaign=organic&utm_content=prokol_ushey

```

Страница удаления новообразований:

```
https://book.everestmed.ru/?utm_source=everestmed&utm_medium=website&utm_campaign=organic&utm_content=novoobrazovania

```

### Передача UTM-меток в CRM

Лендинг при загрузке читает UTM-параметры из URL, сохраняет в localStorage и передаёт вместе с данными формы в n8n webhook. В n8n эти данные добавляются в поле "Источник" или "Комментарий" сделки. Таким образом в каждой карточке CRM видно с какой страницы пришёл клиент.

JavaScript-код для добавления в лендинг (выполняется при загрузке страницы):

```javascript
// Читаем и сохраняем UTM-параметры
function getUTMParams() {
  const params = new URLSearchParams(window.location.search);
  const utmKeys = \['source', 'medium', 'campaign', 'content'\];
  const utm = {};
  utmKeys.forEach(key => {
    const val = params.get('utm\_' + key);
    if (val) localStorage.setItem('utm\_' + key, val);
    utm\[key\] = localStorage.getItem('utm\_' + key) || 'direct';
  });
  return utm;
}

```

// При отправке формы добавляем UTM к данным const utm = getUTMParams(); const formData = { name: form.name.value, phone: form.phone.value, service: form.service.value, date: form.date.value, time: form.time.value, utm_source: utm.source, utm_medium: utm.medium, utm_campaign: utm.campaign, utm_content: utm.content };

```

```

В n8n в узле создания сделки добавить поле comment или description:

```
Источник: {{ $json.utm_source }} / {{ $json.utm_content }}

```

### Отчёты в Метрике — что смотреть

| Отчёт | Путь в Метрике | Что показывает |
| --- | --- | --- |
| Источники трафика | Источники → Сводка | Откуда приходят посетители лендинга |
| Конверсии | Цели → booking_success | Сколько человек записалось |
| Вебвизор | Вебвизор | Как заполняют форму, где бросают |
| Устройства | Технологии → Устройства | Мобильные vs десктоп |
| Страницы входа | Источники → Сайты | С каких страниц everestmed.ru переходят |

### Ежемесячный отчёт для владельца клиники

Раз в месяц формировать два скриншота: отчёт из Яндекс.Метрики (количество визитов и конверсий) и отчёт из CRM (количество сделок за месяц по услугам). Отправлять другу как подтверждение работы системы. Это укрепляет доверие, обосновывает процент от записей и делает сотрудничество долгосрочным.

---

## SDKs, Rate Limits & Support (ДЕПЛОЙ на текущей инфраструктуре)

### Новый docker-compose.yml (с учётом портов и сети)

```yaml
version: '3.7'
services:
  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: salesman
      MYSQL_ROOT_PASSWORD: yourpassword
    volumes:
      - mysql_data:/var/lib/mysql
    networks:
      - everest-net

```

crm: image: php:7.4-apache volumes: - ./salesmancrm:/var/www/html depends_on: - db environment: DB_HOST: db DB_USER: root DB_PASS: yourpassword DB_NAME: salesman ports: - "8082:80" # Внешний порт 8082! networks: - everest-net

landing: image: nginx:alpine volumes: - ./landing:/usr/share/nginx/html - ./nginx.conf:/etc/nginx/conf.d/default.conf ports: - "8081:80" # Внешний порт 8081! networks: - everest-net

volumes: mysql_data:

networks: everest-net: external: true

```

```

### Пошаговый деплой

1. **SSH**:  

  Войти на сервер:  

  `ssh root@217.114.14.124`


2. **Структура**: 

  ```
  mkdir -p /opt/everest
  cd /opt/everest
  
```

3. **CRM**:  

  `git clone https://github.com/vladandreevg/salesmancrm.git salesmancrm`


4. **Landing**:  

  `mkdir landing`  

  (Добавьте туда index.html, favicon, styles, скрипты. В форму POST укажите адрес n8n webhook!)

5. **.env**: 

  ```
  SALESMAN_API_KEY=ваш\_ключ
  DB_PASS=yourpassword
  
```

6. **docker-compose.yml**:  

  (Скопируйте и проверьте секции портов как выше)


7. **Запуск**: 

  ```
  docker compose up -d
  
```

8. **Установка CRM**:  

  Откройте [http://217.114.14.124:8082/\_install/](http://217.114.14.124:8082/_install/) и пройдите все шаги.

9. **Генерация API-ключа**:  

  В SalesMan CRM (через браузер), API-ключ добавить в n8n credentials и .env.

10. **Настройка NPM**:  

  Через [http://217.114.14.124:81](http://217.114.14.124:81) создайте proxy для обоих сервисов как выше.


11. **n8n WORKFLOW**:  

  Конфигурируйте автоматический разбор заявок; итоговый маршрут webhook POST прописан в action формы на лендинге.

12. **Проверьте форму**:  

  Оставьте тестовую заявку — проверьте цепочку до календаря и Telegram.

---

## Rate Limits

| Tier | Requests/min | Burst | Notes |
| --- | --- | --- | --- |
| Landing API | 10 | 10 | Ограничение через n8n или Nginx |

---

## Support & Resources

* **CRM проект:** [github.com/vladandreevg/salesmancrm](https://github.com/vladandreevg/salesmancrm)
* **Wiki, Telegram:** [salesman.pro/docs/](https://salesman.pro/docs/), [@salesman_channel](https://t.me/salesman_channel)
* **Документация n8n:** [n8n.io/docs](https://docs.n8n.io/)
* **Nginx Proxy Manager:** [nginxproxymanager.com/guide](https://nginxproxymanager.com/guide/)

---

**Краткое резюме:**  

Используй Docerized структуры landing+CRM+DB, все сервисы спрятаны за Nginx Proxy Manager, интеграция бизнес-логики реализуется через визуальные workflow в n8n, портовая и сетевая схема учитывает всё уже работающее ПО, SSL и резервирование точек входа для интеграций и дальнейшего масштабирования.