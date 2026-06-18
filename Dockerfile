FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

RUN chmod +x scripts/docker-entrypoint.sh

CMD ["./scripts/docker-entrypoint.sh"]
