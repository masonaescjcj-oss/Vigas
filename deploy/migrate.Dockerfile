# One-shot job: apply migrations and seed catalogue/content.
FROM node:22-slim
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile --filter @vigas/db...
CMD ["sh", "-c", "pnpm db:migrate && pnpm db:seed"]
