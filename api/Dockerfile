FROM node:22.12.0-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY api ./api
COPY web ./web
RUN npm run build:api
CMD ["npm","start"]
