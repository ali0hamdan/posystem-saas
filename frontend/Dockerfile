FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL
ARG VITE_BYPASS_LICENSE=false
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_BYPASS_LICENSE=$VITE_BYPASS_LICENSE
# Skip Electron binary download — not needed for the web build
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package*.json .npmrc ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build

FROM nginx:alpine AS runner
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
