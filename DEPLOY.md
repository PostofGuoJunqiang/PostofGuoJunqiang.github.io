# 分发与部署指南（纯本地架构）

本应用采用 **纯本地** 架构，分发极其简单：

- **前端** 是纯静态文件（HTML/CSS/JS + PWA 资源）。
- **大模型** 由用户的浏览器**直连**其自带的 API Key（BYOK），Key 只存在用户本机浏览器。
- **数据**（批改历史、好词本、设置）全部存在**用户自己的设备**：桌面端（Chromium 系安装的 PWA）写成用户自选文件夹里的 `history.json` / `vocab.json` / `settings.json`；移动端回退到浏览器 IndexedDB（同样只在本机）。
- **服务器端不存储任何用户数据**，因此不需要数据库、不需要中心存储。

> 结论：分发 = 把静态文件放到一个支持 **HTTPS** 的地方，然后把链接发给用户；他们用桌面/手机打开后"安装"即可，无需你维护任何后端。

---

## 一、GitHub Pages 部署（当前方案，免费）

本项目已配置 GitHub Actions（`.github/workflows/deploy.yml`），push 到 `main` 即自动构建并发布。

1. **建仓库**：在 GitHub 新建仓库，名称**必须**为 `<你的用户名>.github.io`（用户站点、根路径），选 **Public**。
2. **推送**：
   ```bash
   git remote add origin https://github.com/<你的用户名>/<你的用户名>.github.io.git
   git push -u origin main
   ```
3. **开启 Pages**：仓库 **Settings → Pages → Source** 选 **GitHub Actions**。约 1 分钟后上线。
4. **访问**：`https://<你的用户名>.github.io/`，桌面/手机共用，PWA 可装，数据全在本机。

> 每次改代码 `git push` 会自动重新部署。`build_dist.sh` 由 CI 自动调用，无需手动执行。

---

## 二、PWA 安装方式（桌面 / 移动）

- **桌面（Chrome / Edge）**：打开链接 → 地址栏"安装"图标，或侧边栏「＋ 安装到桌面」→ 生成独立窗口的桌面应用。
- **安卓（Chrome）**：菜单 → "安装应用" / "添加到主屏幕"。
- **iOS（Safari）**：分享 → "添加到主屏幕"。

> PWA 仅在 `https://`（或本地 `localhost`）下可安装；直接双击 `file://` 打开 HTML 不可用。

---

## 三、数据在哪里 / 安全说明

- 桌面端首次使用会弹"选择存档文件夹"，数据写入该文件夹的 JSON 文件，可随时备份/导出。
- 移动端数据存浏览器 IndexedDB（本机沙盒），卸载/清缓存会丢失（可先导出好词本 CSV）。
- 大模型 Key 仅存用户本机浏览器 `localStorage`，**不上传任何服务器**；批改请求由用户浏览器直接发往其填写的模型厂商接口。

---

## 四、关于 CORS（跨域）

部分大模型厂商（如 OpenAI）接口**不允许浏览器跨域直连**，会报 CORS 错误。应对：

1. **换用支持 CORS 的端点**（如 DeepSeek 等 OpenAI 兼容且允许跨域的），在「我的-模型设置」填对应 Base。
2. **可选中转代理**：若必须用被拦截的接口，可把本地 `server.py` 作为纯转发代理运行（只转发、不存数据，未纳入版本库），在「模型设置」把 Base 指向它。Key 仍由用户自己填、不落盘。

> 无论哪种，用户数据都只在本机。

---

## 五、本地联调（可选）

如需本地调试前端，可用根目录的 `server.py`（仅做静态服务 + 可选 CORS 中转，不存数据，未纳入版本库）：
```bash
python server.py     # http://localhost:8765
```
在「我的-模型设置」填自己的 Key 即可本地体验；`localhost` 下 PWA 也可安装。
