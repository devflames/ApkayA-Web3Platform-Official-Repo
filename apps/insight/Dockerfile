FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/engine/package.json apps/engine/package.json
COPY apps/insight/package.json apps/insight/package.json

RUN npm install --workspace=@apkaya/engine --workspace=@apkaya/insight

COPY apps/engine/tsconfig.json apps/engine/tsconfig.json
COPY apps/engine/migrations apps/engine/migrations
COPY apps/engine/src apps/engine/src
COPY apps/insight/tsconfig.json apps/insight/tsconfig.json
COPY apps/insight/migrations apps/insight/migrations
COPY apps/insight/src apps/insight/src

RUN npm run build --workspace=@apkaya/engine && npm run build --workspace=@apkaya/insight

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/engine/package.json apps/engine/package.json
COPY --from=build /app/apps/engine/dist apps/engine/dist
COPY --from=build /app/apps/insight/package.json apps/insight/package.json
COPY --from=build /app/apps/insight/dist apps/insight/dist
COPY --from=build /app/apps/insight/migrations apps/insight/migrations
COPY --from=build /app/package.json package.json

WORKDIR /app/apps/insight
EXPOSE 3006
CMD ["node", "dist/index.js"]
