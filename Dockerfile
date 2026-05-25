FROM node:24-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN sed -i 's/\r$//' /entrypoint.sh && chmod +x /entrypoint.sh && \
    sed -i '/^user /d' /etc/nginx/nginx.conf && \
    mkdir -p /var/cache/nginx /var/log/nginx /var/run && \
    chmod -R 777 /var/cache/nginx /var/log/nginx /var/run /usr/share/nginx/html
EXPOSE 8080
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]