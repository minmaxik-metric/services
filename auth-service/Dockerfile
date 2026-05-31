# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ENV YARN_CACHE_FOLDER=/tmp/.yarn-cache
RUN apk add --no-cache libc6-compat openssl
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

FROM deps AS build
WORKDIR /app
ENV DATABASE_URI=postgresql://postgres:postgres@localhost:5432/postgres
COPY . .
RUN yarn prisma generate
RUN yarn build

FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
ENV NODE_ENV=production
ENV YARN_CACHE_FOLDER=/tmp/.yarn-cache
RUN apk add --no-cache libc6-compat openssl
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile --production=true && yarn cache clean

FROM node:${NODE_VERSION} AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache tini libc6-compat openssl \
	&& mkdir -p /var/log/services/auth \
	&& chown -R node:node /app /var/log/services
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/package.json ./package.json
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/prisma ./prisma
COPY --from=build --chown=node:node /app/prisma.config.ts ./prisma.config.ts
USER node
EXPOSE 50051 9101
ENTRYPOINT ["tini", "--"]
CMD ["node", "dist/src/main"]
