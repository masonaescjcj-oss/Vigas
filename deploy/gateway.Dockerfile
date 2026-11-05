# Vigas API gateway — build from the repo root:
#   docker build -f deploy/gateway.Dockerfile -t vigas-gateway .
FROM node:22-slim AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @vigas/gateway... && pnpm --filter @vigas/gateway build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /repo/apps/gateway/package.json ./package.json
COPY --from=build /repo/apps/gateway/dist ./dist
# Workspace packages are bundled into dist; install only the npm runtime dependencies.
RUN node -e "const p=require('./package.json');for(const k of Object.keys(p.dependencies))if(k.startsWith('@vigas/'))delete p.dependencies[k];delete p.devDependencies;require('fs').writeFileSync('package.json',JSON.stringify(p))" \
 && npm install --omit=dev --no-audit --no-fund
USER node
EXPOSE 8787
CMD ["node", "dist/server.js"]
