# Vigas website — build from the repo root:
#   docker build -f deploy/web.Dockerfile --build-arg NEXT_PUBLIC_SITE_URL=https://vigas.ai -t vigas-web .
FROM node:22-slim
WORKDIR /repo
RUN corepack enable
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_TELEMETRY_DISABLED=1
COPY . .
RUN pnpm install --frozen-lockfile --filter @vigas/web... --filter @vigas/db...
# Pages that read the database at build time need DATABASE_URL; pass it with --build-arg if so.
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL
RUN pnpm --filter @vigas/web build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["pnpm", "--filter", "@vigas/web", "start"]
