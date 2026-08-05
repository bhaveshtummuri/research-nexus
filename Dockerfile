# ---------------------------------------------------------------------------
# Multi-stage build for the Research Nexus API.
#
# The build stage keeps devDependencies (TypeScript, type packages); the runtime
# stage installs production dependencies only, so the shipped image carries no
# compiler and no test tooling.
# ---------------------------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Manifests are copied first so a dependency-free code change reuses the cached
# install layer.
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
COPY seed/package.json ./seed/
RUN npm ci --workspace server --include-workspace-root

COPY tsconfig.base.json ./
COPY server ./server
RUN npm run build --workspace server


FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY server/package.json ./server/
RUN npm ci --omit=dev --workspace server --include-workspace-root && npm cache clean --force

COPY --from=build /app/server/dist ./server/dist
# The schema files are read by the seed CLI, which can be run from this image.
COPY database ./database

# Run unprivileged; the node image already provides this user.
USER node

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/dist/server.js"]
