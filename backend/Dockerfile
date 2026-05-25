FROM node:20-alpine AS builder
WORKDIR /app
# build tools needed to compile bcrypt native binding
RUN apk add --no-cache python3 make g++
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN node_modules/.bin/prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# Prisma query and migration engines require OpenSSL on Alpine
RUN apk add --no-cache openssl
COPY package*.json .npmrc ./
# --ignore-scripts is safe — bcrypt and Prisma engine binaries are copied from builder
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# copy pre-compiled bcrypt native binding from builder
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt
COPY prisma ./prisma

# Create non-root user and fix ownership of all app files before switching
RUN addgroup -S appgroup && adduser -S appuser -G appgroup \
    && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000
CMD ["/bin/sh", "-c", "i=0; until node_modules/.bin/prisma migrate deploy; do i=$((i+1)); if [ $i -ge 5 ]; then echo 'Migrations failed after 5 attempts'; exit 1; fi; echo \"Migration attempt $i failed, retrying in 15s...\"; sleep 15; done && exec node dist/main"]
