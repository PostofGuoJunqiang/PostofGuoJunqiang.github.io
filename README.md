# 英语考试作文智能批改工具 · 代码评审包

移动端原型（390×844 手机壳）· 备考学生自用 · 原生 HTML/CSS/JS + Python 标准库，零第三方运行时依赖。

## 文件结构

```
code-review/
├── index.html          页面骨架（HTML 结构 + 引入 css/js）
├── css/style.css       全部样式（设计规范：8/12/16 三档圆角、#F7F8FA 护眼底、四级文字色）
├── js/standards.js     官方评分标准数据（CET4/6、考研英一二 A/B、高中、雅思）
├── js/app.js           前端全部逻辑（约 800 行）
├── server.py           本地代理服务（Python 标准库，静态托管 + 3 个 API）
└── test-smoke.js       jsdom 冒烟测试（68 项断言，纯本机不联网）
```

## 运行方式

```bash
cd english-essay-app
GRADE_API_BASE=https://api.deepseek.com/chat/completions \
GRADE_API_KEY=sk-xxx GRADE_MODEL=deepseek-v4-flash \
python server.py
# 浏览器打开 http://localhost:8765
```

测试：`NODE_PATH=<jsdom安装路径> node test-smoke.js`（测试内部把多文件内联拼接后喂 jsdom）。

## 核心设计决策（评审时请结合这些背景）

1. **BYOK（自带 Key）**：使用者在自己的浏览器 localStorage 里填 API Key（DeepSeek/自定义 OpenAI 兼容端点），请求经 `/api/grade`、`/api/gloss`、`/api/translate`、`/api/topic-check` 时携带 `X-LLM-Key/Base/Model` 头，服务端**优先用请求 Key、未带则回退环境变量默认**。目的是分发时不暴露任何人的 Key。
2. **异步任务批改**：`POST /api/grade` 立即返回 taskId，后台线程调模型批改，前端轮询 `/api/tasks`（3s），任务状态与结果落盘 `data/tasks.json`（运行期生成，未随包）。
3. **提交前双校验**：① Key 格式（sk- 开头）前端拦截；② 填了题目时调 `/api/topic-check` 轻量判相关度（<0.4 二次确认），校验失败默认放行不阻塞。
4. **失败任务友好化**：后端错误经 `friendlyError()` 映射为中文文案，技术详情折叠展示，提供「重新批改」（用原 text 重提）与「去设置」。
5. **多文件分离**：曾为单文件 index.html（1500+ 行），已按 HTML/CSS/数据/逻辑拆分；`standards.js` 为评分标准单一数据源（server.py 内亦有同源硬编码）。
6. **评分标准页内折叠**：标准数据前端内置（零网络请求），CET 档位标注分数区间，当前档高亮。
7. **好词本复习信息**：收藏单词/句子时异步预取音标/释义/翻译（`/api/gloss`、`/api/translate`）存本地，离线可复习。

## 已知取舍（可重点关注）

- 前端单文件架构为原生实现，无构建、无框架、无类型检查，可维护性依赖人工纪律。
- `server.py` 与 `js/standards.js` 的评分标准数据为双源（逐字一致），改动需同步两处。
- 任务结果明文落盘 `data/tasks.json`（本机自用场景）。
- HTTP 服务无鉴权（定位：本机/局域网信任环境；Key 盗刷无意义因 BYOK 各自付费）。
