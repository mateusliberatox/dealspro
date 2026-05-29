# Playwright pré-instalado com Chromium e todas as dependências do sistema
FROM mcr.microsoft.com/playwright:v1.59.1-noble

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Pré-compila TypeScript → JavaScript: remove tsx do runtime, poupa ~100MB RAM
RUN node_modules/.bin/tsc --project tsconfig.src.build.json

# Valores padrão — sobrescreva com variáveis de ambiente no Railway
ENV HEADLESS=true
ENV SCRAPE_INTERVAL_SECONDS=240
ENV FAST_SCRAPE_INTERVAL_SECONDS=60
ENV SCRAPE_MAX_CATEGORIES=15
ENV SCRAPE_PAGES=1
ENV FAST_CATEGORY_IDS=18,11

CMD ["node", "dist/entry/start-monitor.js"]
