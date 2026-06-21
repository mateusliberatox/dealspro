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
# SCRAPE_PAGES=2: raspa posições 1-40 de cada categoria. O CSSDeals não ordena
# por "mais novo primeiro", então itens novos na posição 21-40 ficavam invisíveis
# por horas. Compensado por BATCH_SIZE=3 (default no código) e throttle de
# last_seen_at em 60min para manter Disk IO/CPU estáveis.
ENV SCRAPE_PAGES=2
ENV FAST_CATEGORY_IDS=18,11

# Limita o heap V8 do processo Node principal — sem isso o heap cresce sem
# pressão de GC até bem além de 1GB em processos longos, inflando o uso de
# RAM (e custo) no Railway de forma contínua e sem releases periódicos.
ENV NODE_OPTIONS="--max-old-space-size=512"

CMD ["node", "dist/entry/start-monitor.js"]
