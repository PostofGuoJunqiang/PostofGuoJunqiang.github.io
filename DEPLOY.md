# 分发与部署指南（纯本地架构）

本应用采用 **纯本地** 架构，分发极其简单：

- **前端** 是纯静态文件（HTML/CSS/JS + PWA 资源）。
- **大模型** 由用户的浏览器**直连**其自带的 API Key（BYOK），Key 只存在用户本机浏览器。
- **数据**（批改历史、好词本、设置）全部存在**用户自己的设备**：桌面端（Chromium 系安装的 PWA）写成用户自选文件夹里的 `history.json` / `vocab.json` / `settings.json`；移动端回退到浏览器 IndexedDB（同样只在本机）。
- **服务器端不存储任何用户数据**，因此不需要数据库、不需要中心存储。

> 结论：分发 = 把静态文件放到一个支持 **HTTPS** 的地方，然后把链接发给用户；他们用桌面/手机打开后“安装”即可，无需你维护任何后端。

---

## 一、最简分发：静态托管（推荐）

只要能托管静态文件 + 提供 HTTPS 即可，任选其一：

- GitHub Pages / Netlify / Vercel / Cloudflare Pages
- 国内：腾讯云静态网站托管 / 阿里云 OSS 静态页 / 字节 Ball? 等
- 内网：一台能开 HTTPS 的任意静态服务器

操作步骤（以 Netlify / Cloudflare Pages 为例）：
1. 把仓库里这些文件/目录原样上传：`index.html`、`css/`、`js/`、`manifest.webmanifest`、`sw.js`、`icon.svg`、`icon-192.png`、`icon-512.png`。
2. 开启 HTTPS（平台默认提供，自定义域名后在平台绑 DNS）。
3. 访问 `https://你的域名`，桌面 Chrome/Edge 会出现“安装到桌面”，安卓 Chrome 可“安装”，iOS Safari 用“分享 → 添加到主屏幕”。

无需 Docker、无需数据库、无需服务器代码。

---

## 二、自建托管：Caddy（静态 + 自动 HTTPS）

适用于你有一台公网服务器、想用自己的域名。

1. 把整个项目目录上传到服务器，例如 `/srv/pigai`。
2. 安装 Caddy，运行：`caddy run --config /srv/pigai/Caddyfile`（已在本仓库提供）。
3. Caddy 会自动向 Let's Encrypt 申请证书并托管静态站。
4. 浏览器访问 `https://你的域名` 即可安装使用。

Caddyfile 只做“静态文件 + TLS”，不运行任何后端逻辑。

---

## 三、容器化：Docker（静态 + nginx）

适合放进已有的容器平台/编排：

```bash
docker build -t pigai-app .
docker run -d --name pigai -p 8080:80 pigai-app
# 在容器前用 Caddy 或云负载均衡做 TLS 终止（PWA 需要 https）
```

镜像仅含 nginx 提供静态文件，不含任何后端、不挂载数据卷。

---

## 四、PWA 安装方式（桌面 / 移动）

- **桌面（Windows / macOS / Linux，Chrome 或 Edge）**
  1. 用浏览器打开 `https://你的域名`；
  2. 地址栏右侧出现“安装”图标，或侧边栏点「＋ 安装到桌面」；
  3. 安装后即是独立窗口的桌面应用，并生成桌面快捷方式。
- **安卓（Chrome）**：菜单 → “安装应用” / “添加到主屏幕”。
- **iOS（Safari）**：分享 → “添加到主屏幕”。

> 提示：PWA 仅在 `https://`（或本地 `localhost`）下可安装；直接双击 `file://` 打开 HTML 不可用，这是设计使然。

---

## 五、数据在哪里 / 安全说明

- 桌面端首次使用（首次批改或首次收藏）会弹出“选择存档文件夹”，选定后所有数据写入该文件夹的 JSON 文件，可被用户随时备份/导出。
- 移动端数据存于浏览器 IndexedDB（本机沙盒），卸载站点/清缓存会丢失（可先导出好词本 CSV）。
- 大模型 Key 仅存用户本机浏览器 `localStorage`，**不上传任何服务器**；批改请求由用户浏览器直接发往其填写的模型厂商接口。
- 本仓库自带的 `server.py` 已不再是运行必需项；它现在仅作为“可选的 CORS 中转代理”保留（见下）。

---

## 六、关于 CORS（跨域）的注意事项

部分大模型厂商（如 OpenAI）的接口**不允许浏览器跨域直连**。此时浏览器直连会报 CORS 错误。两种应对：

1. **换用允许浏览器跨域的厂商/端点**（如 DeepSeek 等 OpenAI 兼容端点中支持 CORS 的），在「我的-模型设置」填对应 Base 即可。
2. **可选中转代理**：若必须用被 CORS 拦截的接口，可把 `server.py` 作为纯转发代理运行（它只把带 Key 的请求转发给厂商、不存任何数据），并在「模型设置」里把 Base 指向该代理地址。此时 Key 仍由用户自己填、不落盘；代理仅做转发。

> 无论哪种方式，用户数据都只在本机，符合“数据本地 + 方便安全”的目标。

---

## 七、绑定你自己的域名（Netlify / Cloudflare Pages）

两家都提供免费 HTTPS + 自定义域名，且本项目是纯静态、无需构建，部署只需一条命令。

### 准备：重建发布目录
`dist/` 是本仓库的“干净发布包”（只含前端静态资源，已剔除 `.workbuddy` / `server.py` 等开发文件）。每次改完代码后重建：
```bash
bash build_dist.sh      # Windows 用 Git Bash / WSL 运行
```

### 方案 1：Netlify（最省心，推荐）
1. 安装并登录：`npm i -g netlify-cli && netlify login`
2. 部署：`netlify deploy --prod --dir dist`
3. 打开 Netlify 控制台 → 该站点 → **Domain management** → **Add a custom domain**，填入你的域名（如 `pigai.example.com` 或根域 `example.com`）。
4. 按提示去域名注册商处把 DNS 改到 Netlify 提供的值（要么整域 Nameserver 指向 Netlify，要么加 CNAME/A 记录）。
5. 等几分钟，Netlify **自动签发 TLS 证书**。访问你的域名即可「安装到桌面 / 添加到主屏幕」。

> 配置已写在 `netlify.toml`（发布目录 = dist，并让 `sw.js` 不缓存以便 PWA 更新）。

### 方案 2：Cloudflare Pages
前提：你的域名 DNS 托管在 Cloudflare。
1. 安装并登录：`npm i -g wrangler && wrangler login`
2. 部署：`wrangler pages deploy dist`
3. Cloudflare Pages 控制台 → 该站点 → **自定义域** → 添加你的域名，Cloudflare 自动签发证书。

> 配置已写在 `wrangler.toml`（`pages_build_output_dir = "dist"`）。

### 绑定后验证
- 打开 `https://你的域名`，地址栏应出现“安装”图标；
- 桌面端首次批改会弹“选择存档文件夹”，数据写在他本机 JSON；
- 若浏览器直连大模型报 CORS，见第六节改用 CORS 友好的端点或可选中转代理。

> 注：DNS / 域名注册商侧的操作需要你自己的账号登录，无法由本工具代劳；代码与部署配置已就绪，到手即可一条命令上线。

---

## 八、本地联调（开发用）

```bash
cd 本项目目录
python server.py          # 默认 http://localhost:8765（仅本地调试前端用）
```
浏览器开 `http://localhost:8765`，在「我的-模型设置」填自己的 Key 即可本地体验；`localhost` 下 PWA 也可安装。
