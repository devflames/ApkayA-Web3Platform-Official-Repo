FROM node:20-alpine AS base
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev --omit=optional --legacy-peer-deps || npm install

COPY tsconfig.json ./
COPY migrations ./migrations
COPY src ./src

RUN npm install --include=dev && npm run build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY --from=base /app/migrations ./migrations
COPY --from=base /app/package.json ./package.json

EXPOSE 3005
CMD ["node", "dist/index.js"]
