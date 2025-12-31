# Simple production-ready container using Apache + PHP
FROM php:8.2-apache

# Install SQLite extensions for PDO
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy app source
COPY . /var/www/html/
WORKDIR /var/www/html

# Ensure data dir exists and writable by Apache
RUN mkdir -p /var/www/html/data \
    && chown -R www-data:www-data /var/www/html/data

# Default: use SQLite (disable JSON fallback)
ENV APP_USE_JSON=0

# Expose Apache on port 80
EXPOSE 80

# Apache is already the default CMD/entrypoint in this image
