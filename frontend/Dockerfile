# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Cliente de Artani — Vue 3 + Vite.
#
# La imagen final NO incluye servidor web: Caddy sirve los archivos estáticos.
# El contenedor solo publica el resultado del build en el volumen compartido y
# termina, de modo que el reverse proxy lo sirva directamente desde disco.
# ---------------------------------------------------------------------------

ARG NODE_VERSION=24-alpine

# --- Etapa 1: dependencias --------------------------------------------------
FROM node:${NODE_VERSION} AS deps
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# --- Etapa 2: build de producción -------------------------------------------
FROM node:${NODE_VERSION} AS builder
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `pnpm build` ejecuta la comprobación de tipos y el empaquetado en paralelo:
# un error de tipos detiene el despliegue antes de publicar nada.
RUN pnpm build

# --- Etapa 3: artefacto estático --------------------------------------------
# Imagen mínima que solo transporta el build. Al arrancar copia su contenido al
# volumen que Caddy monta como raíz del sitio y termina con éxito.
FROM alpine:3.21 AS runtime
WORKDIR /app
COPY --from=builder /app/dist ./dist

# `publicar` es el destino montado desde Compose (volumen `frontend_dist`).
ENV DESTINO=/publicar
CMD ["sh", "-c", "rm -rf \"$DESTINO\"/* && cp -a ./dist/. \"$DESTINO\"/ && echo \"Build del cliente publicado en $DESTINO\""]
