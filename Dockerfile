# Playwright pré-instalado com Chromium e todas as dependências do sistema
FROM mcr.microsoft.com/playwright:v1.52.0-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Valores padrão — sobrescreva com variáveis de ambiente no Railway
ENV HEADLESS=true
ENV SCRAPE_INTERVAL_SECONDS=120
ENV SCRAPE_MAX_CATEGORIES=30

CMD ["node", "src/entry/start-monitor.js"]
