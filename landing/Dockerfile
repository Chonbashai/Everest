FROM node:22-alpine AS build

WORKDIR /app

COPY app/package.json app/package-lock.json* ./
RUN npm install

COPY app/ ./
RUN npm run build

FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY config.template.js /usr/share/nginx/html/config.template.js
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["/bin/sh", "-c", "envsubst '$$N8N_WEBHOOK_URL $$YANDEX_METRIKA_ID' < /usr/share/nginx/html/config.template.js > /usr/share/nginx/html/config.js && exec nginx -g 'daemon off;'"]
