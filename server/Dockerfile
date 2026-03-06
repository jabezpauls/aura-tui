FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY src/ src/

ENV PORT=8765

EXPOSE 8765

CMD ["npx", "tsx", "src/index.ts"]
