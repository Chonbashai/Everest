FROM php:7.4-apache

# OS packages and build deps for mysqli, gd, imap, imagick
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        $PHPIZE_DEPS \
        libfreetype6-dev \
        libjpeg62-turbo-dev \
        libpng-dev \
        libzip-dev \
        libc-client2007e-dev \
        libkrb5-dev \
        libssl-dev \
        libmagickwand-dev \
    ; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-configure imap --with-kerberos --with-imap-ssl; \
    docker-php-ext-install -j"$(nproc)" mysqli gd imap; \
    printf '\n' | pecl install imagick; \
    docker-php-ext-enable imagick; \
    apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false \
        -o APT::AutoRemove::SuggestsImportant=false $PHPIZE_DEPS; \
    rm -rf /var/lib/apt/lists/*

RUN printf '%s\n' \
    'date.timezone = Europe/Moscow' \
    'short_open_tag = On' \
    > /usr/local/etc/php/conf.d/everest-crm.ini

RUN a2enmod rewrite headers

WORKDIR /var/www/html
