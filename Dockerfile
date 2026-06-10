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

# Limita o heap V8 do processo Node principal — sem isso o heap cresce sem
# pressão de GC até bem além de 1GB em processos longos, inflando o uso de
# RAM (e custo) no Railway de forma contínua e sem releases periódicos.
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "dist/entry/start-monitor.js"]
