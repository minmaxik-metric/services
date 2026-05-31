# syntax=docker/dockerfile:1.7
ARG NODE_VERSION=24-alpine

FROM node:${NODE_VERSION} AS deps
WORKDIR /app
ENV YARN_CACHE_FOLDER=/tmp/.yarn-cache
COPY package.json yarn.lock ./
RUN corepack enable && yarn install --frozen-lockfile

FROM deps AS build
WORKDIR /app
ARG VITE_GATEWAY_URL
ENV VITE_GATEWAY_URL=${VITE_GATEWAY_URL}
COPY . .
RUN yarn build

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
	CMD wget -q --spider http://127.0.0.1/ || exit 1
