FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/shared/package.json packages/shared/package.json
COPY services/api/package.json services/api/package.json
RUN npm ci
COPY packages packages
COPY services/api services/api
COPY tsconfig.json .
RUN npm run build:api
ENV NODE_ENV=production
WORKDIR /app/services/api
EXPOSE 3001
CMD ["npm","start"]
