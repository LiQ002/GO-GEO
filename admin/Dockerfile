FROM registry.gbicom.com:8443/node/node:26.5.0-slim AS builder
WORKDIR /app

FROM builder AS admin-builder
COPY ./package.json ./package-lock.json  ./
RUN npm config set registry https://registry.npmmirror.com && npm install
COPY . .
RUN npm run build

FROM registry.gbicom.com:8443/base/openresty:1.31-alpine-fat
COPY --from=admin-builder /app/dist /usr/local/openresty/nginx/html/admin

COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
