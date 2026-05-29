# Playwright pré-instalado com Chromium e todas as dependências do sistema
FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Valores padrão — sobrescreva com variáveis de ambiente no Railway
ENV HEADLESS=true
ENV SCRAPE_INTERVAL_SECONDS=180
ENV FAST_SCRAPE_INTERVAL_SECONDS=60
ENV SCRAPE_MAX_CATEGORIES=30

CMD ["node_modules/.bin/tsx", "src/entry/start-monitor.ts"]
