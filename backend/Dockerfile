# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# API de Artani — Express 5 + Prisma 7 sobre Node 24 (ESM).
#
# El cliente de Prisma se genera en src/generated/prisma (fuera del control de
# versiones), por lo que `prisma generate` debe ejecutarse SIEMPRE antes del
# empaquetado. tsup deja como externas todas las dependencias de producción, de
# modo que la imagen final necesita dist/ más node_modules de producción.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=24-alpine

# --- Etapa 1: dependencias completas (incluye devDependencies) --------------
FROM node:${NODE_VERSION} AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
# pnpm-workspace.yaml declara `allowBuilds`: sin él, pnpm 11 aborta la
# instalación porque prisma y esbuild traen scripts de compilación.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# --- Etapa 2: compilación ---------------------------------------------------
FROM node:${NODE_VERSION} AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json tsup.config.ts prisma.config.ts ./
COPY prisma ./prisma
COPY src ./src

# `prisma generate` no se conecta a la base de datos, pero prisma.config.ts
# resuelve env("DATABASE_URL"); este marcador de posición solo existe durante la
# compilación y NO es una credencial: la cadena real llega por entorno en tiempo
# de ejecución.
ARG PRISMA_PLACEHOLDER_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN DATABASE_URL="${PRISMA_PLACEHOLDER_URL}" pnpm generate \
    && pnpm build

# --- Etapa 3: dependencias solo de producción -------------------------------
FROM node:${NODE_VERSION} AS prod-deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
# pnpm-workspace.yaml declara `allowBuilds`: sin él, pnpm 11 aborta la
# instalación porque prisma y esbuild traen scripts de compilación.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod

# --- Etapa 4: imagen de ejecución -------------------------------------------
FROM node:${NODE_VERSION} AS runtime
ENV NODE_ENV=production
WORKDIR /app

# `dist/index.js` es ESM: package.json aporta el "type": "module" que Node exige.
COPY --chown=node:node package.json ./
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/dist ./dist

# Fotografías, certificados PDF y códigos QR se escriben en cwd/uploads.
# El volumen de Compose se monta aquí; el directorio debe existir y pertenecer
# al usuario sin privilegios antes de cambiar de usuario.
RUN mkdir -p /app/uploads && chown -R node:node /app/uploads

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]

# --- Etapa alternativa: ejecutor de migraciones ------------------------------
# Conserva el CLI de Prisma, el esquema y las migraciones versionadas. No se usa
# en el servicio principal: solo la invoca el servicio `migrate` de Compose,
# bajo demanda (ver README.deploy.md).
FROM builder AS migrator
ENV NODE_ENV=production
WORKDIR /app
CMD ["pnpm", "exec", "prisma", "migrate", "deploy"]
