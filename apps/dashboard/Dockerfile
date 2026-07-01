FROM node:20-alpine AS build
WORKDIR /app

ARG VITE_ENGINE_URL=http://localhost:3005
ARG VITE_INSIGHT_URL=http://localhost:3006
ARG VITE_DEFAULT_API_KEY=dev-secret-key-change-me

ENV VITE_ENGINE_URL=$VITE_ENGINE_URL
ENV VITE_INSIGHT_URL=$VITE_INSIGHT_URL
ENV VITE_DEFAULT_API_KEY=$VITE_DEFAULT_API_KEY

COPY package.json package-lock.json ./
COPY apps/dashboard/package.json apps/dashboard/package.json
COPY packages/sdk/package.json packages/sdk/package.json
COPY packages/bridge/package.json packages/bridge/package.json
COPY packages/connect/package.json packages/connect/package.json

RUN npm install --workspace=@apkaya/dashboard --workspace=@apkaya/sdk --workspace=@apkaya/bridge --workspace=@apkaya/connect

COPY apps/dashboard apps/dashboard
COPY packages/sdk packages/sdk
COPY packages/bridge packages/bridge
COPY packages/connect packages/connect

RUN npm run build --workspace=@apkaya/dashboard

FROM nginx:alpine
COPY apps/dashboard/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/dashboard/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
