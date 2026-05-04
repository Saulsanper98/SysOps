FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache iputils
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/db/migrations ./src/db/migrations
# drizzle-kit push (npm run db:push) needs config + schema inside the image
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts
RUN mkdir -p src/db
COPY --from=builder /app/src/db/schema.ts ./src/db/schema.ts
RUN mkdir -p uploads

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "dist/index.js"]
