#!/usr/bin/env bash
# 重建干净的静态发布目录 dist/（剔除 .workbuddy / server.py / gen_icons.py / test-smoke.js 等开发文件）
set -e
cd "$(dirname "$0")"

rm -rf dist
mkdir -p dist/css dist/js

cp index.html            dist/
cp css/style.css        dist/css/
cp js/store.js          dist/js/
cp js/llm.js            dist/js/
cp js/app.js            dist/js/
cp js/standards.js      dist/js/
cp js/daily.js          dist/js/
cp manifest.webmanifest dist/
cp sw.js                dist/
cp icon.svg             dist/
cp icon-192.png         dist/
cp icon-512.png         dist/

echo "✓ dist/ 已生成，可直接交给 GitHub Pages 部署"
