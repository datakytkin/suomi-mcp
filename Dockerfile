# Datasilta Gateway – pitkään elävä Node.js + Express -prosessi (SSE).
# Sopii Fly.io / Cloud Run (CPU always-on) / Hetzner-kontti -ympäristöihin.
# EI serverlessille: SSE vaatii pitkäikäiset yhteydet.

# ---- build ----
FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- runtime ----
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Konttiympäristö asettaa yleensä PORT:n; oletus 3000.
ENV PORT=3000
EXPOSE 3000

# Ei health-throttlausta: pidä prosessi elossa, SSE-yhteydet auki.
CMD ["node", "dist/gateway.js"]
