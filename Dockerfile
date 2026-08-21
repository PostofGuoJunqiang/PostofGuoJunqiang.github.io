# 批改台 · 静态站点镜像（不含后端，纯前端；数据全在用户本机）
#
# 说明：本应用无需任何服务器逻辑（大模型由浏览器直连、数据存用户本机），
# 因此镜像只是把静态文件交给 nginx 提供。HTTPS 由前置 Caddy / 云厂商提供
# （PWA 必须在 https 下才能“安装到桌面 / 添加到主屏幕”）。
#
# 构建：  docker build -t pigai-app .
# 运行：  docker run -d --name pigai -p 8080:80 pigai-app
#         （如需 HTTPS，在容器前放 Caddy 或云负载均衡做 TLS 终止）
# 数据：  无。用户数据只在本机浏览器/本地文件夹，镜像不挂载、不落盘。

FROM nginx:alpine

COPY index.html /usr/share/nginx/html/index.html
COPY css/        /usr/share/nginx/html/css/
COPY js/         /usr/share/nginx/html/js/
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY sw.js               /usr/share/nginx/html/sw.js
COPY icon.svg  icon-192.png  icon-512.png  /usr/share/nginx/html/

EXPOSE 80
