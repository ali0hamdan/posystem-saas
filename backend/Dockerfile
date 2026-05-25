FROM node:20-alpine AS builder
WORKDIR /app
# build tools needed to compile bcrypt native binding
RUN apk add --no-cache python3 make g++
COPY package*.json .npmrc ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json .npmrc ./
# --ignore-scripts is safe here — bcrypt binding is copied from builder
RUN npm ci --omit=dev --ignore-scripts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
# copy pre-compiled bcrypt native binding from builder
COPY --from=builder /app/node_modules/bcrypt ./node_modules/bcrypt
COPY prisma ./prisma

RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
