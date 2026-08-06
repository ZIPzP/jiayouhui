# 🏡 家游汇 · 家庭旅游推荐与攻略选择

面向家庭的旅游网页应用：聚合平台热门旅游数据、由 AI 大模型根据**出行时段 + 目的地 + 同行人**生成个性化**出行打包清单**与**旅行攻略**，内置**老年人模式**（大字体 / 高对比 / 大按钮 / 语音朗读）。

- 纯原生实现，**零依赖**，无需 `npm install`
- 无 AI Key 时自动降级为内置规则引擎，开箱即用
- 真实地点照片（Unsplash 免费授权）作为页面背景与景点配图，失败时自动显示本地占位卡片

---

## 快速开始

```bash
# 启动（需要 Node.js 18+）
node server.js
```

打开浏览器访问 **http://localhost:3000** 即可。

> 也可以直接双击 `启动.bat`（可选，见下文）。当前已在后台启动的服务可通过 `Ctrl+C` 或任务管理器结束 `node server.js` 进程。

## 功能

| 功能 | 说明 |
| --- | --- |
| AI 行程规划 | 选项式表单（去返日期/天数/交通/忌食/预算/节奏等），AI 生成含价格估算、交通安排、忌食提醒的逐日详细行程；底部还有 AI 主理人自由问答 |
| 热门目的地 | 12 个国内家庭游目的地，真实地点照片、特色亮点、适老提示 |
| AI 出行清单 | 选择目的地 + 出行月份 + 天数 + 同行人数（老人/成人/儿童）+ 兴趣，生成打包清单，可按类勾选、打印 |
| AI 旅行攻略 | 目的地详情页一键生成家庭攻略（行程、玩法、美食、注意事项） |
| 平台热度 | 数据采集器聚合各平台热门目的地（内置本地趋势库，可扩展真实数据源） |
| 老年人模式 | 一键切换：字体放大、高对比、大按钮、语音朗读目的地介绍/攻略/清单 |

## 接入 DeepSeek（AI 主理人）

> ⚠️ **不要把 API Key 发到对话/聊天里**（会泄露）。请把 Key 粘贴到页面右上角「⚙️ AI 设置」的 Key 输入框，它只保存在你浏览器本地（localStorage）；或填入 `config.json`。

**方式一：页面一键配置（推荐）**
1. 点击右上角「⚙️ AI 设置」
2. 点击「🚀 DeepSeek」按钮（自动填入接口地址与模型）
3. 粘贴你的 DeepSeek API Key，点「保存设置」

配置后，AI 主理人即可用于：**行程规划**（含价格估算、交通安排、忌食提醒）与**自由问答**。

**方式二：服务端内置 Key（隐私模式，推荐）** —— Key 只属于你，只在服务器上
- 在设置弹窗输入 Key 后点「🔒 内置到服务器」，Key 写入 `config.local.json`（已被 `.gitignore` 排除，**不会提交到 git**），浏览器本地 Key 自动清除
- 或命令行：`node tools/set-key.js sk-你的key`；清除：`node tools/set-key.js --clear`
- 服务端 Key 一旦存在，会**优先于**浏览器 Key：别人即使拿到你的网页代码，也看不到 Key；浏览器里也不再保存 Key

**方式三：修改 `config.json`**（默认已配置为 DeepSeek）
```json
{
  "ai": {
    "apiKey": "sk-xxxx",
    "baseUrl": "https://api.deepseek.com/v1",
    "model": "deepseek-chat"
  }
}
```
> ⚠️ 注意：不要把 Key 填进 `config.json` 后提交到 git！请用方式二（`config.local.json`）或环境变量 `AI_API_KEY` 保存密钥。

**其他模型**（兼容 OpenAI 协议，在设置面板一键切换）：OpenAI `gpt-4o-mini`、通义千问 `qwen-plus`、Moonshot `moonshot-v1-8k` 等。也可使用环境变量：`AI_API_KEY`、`AI_BASE_URL`、`AI_MODEL`。

> 未配置 Key 或调用失败时，系统会自动使用内置规则引擎（`data/packing-db.json` / `lib/planner.js`）并给出提示，页面不会报错。

## AI 主理人 · 行程规划

页面新增「行程规划」模块（导航「行程规划」），面向不想打字/想快速出方案的用户：

- **按钮式选项**：目的地、出发城市、去程/返程日期、行程天数（选日期自动计算）、交通方式（飞机/高铁/自驾/大巴）、同行人数、**忌食**（不吃辣/素食/清真/过敏等）、预算档位、游玩节奏、住宿偏好、兴趣偏好
- **自由填写**：「其他需求」文本框可补充任意要求（如"想坐竹筏看日出"、"老人腿脚不便"）
- **AI 生成内容**：逐日详细行程（上午/下午/晚上安排）、去程/返程/当地交通安排、人均费用估算、忌食用餐提醒、适老提示，可打印/朗读
- **AI 主理人问答**：行程规划区底部可自由提问（如"带老人孩子去成都怎么安排？"），AI 直接回答

> 说明：交通班次与票价、费用为 AI 参考建议，请以 12306 / 航司 / 官方渠道为准。

## 平台热门数据采集器

- 内置数据源：`data/trending.json`（本地趋势库，演示数据）
- 扩展方式：在 `config.json` 的 `collector.sources` 中配置**通用 HTTP 数据源**，返回 `{ "items": [{ "name", "heat", "trend", "reason" }] }` 或同结构数组即可聚合展示：

```json
{
  "collector": {
    "enabled": ["local-trends", "my-source"],
    "sources": {
      "my-source": {
        "label": "我的数据源",
        "url": "https://your-api.example.com/trending",
        "headers": { "Authorization": "Bearer xxx" }
      }
    }
  }
}
```

**版权与合规说明**：直接抓取微博/小红书/抖音等平台用户页面通常违反其服务条款并涉及版权问题，本项目不提供此类爬取。建议使用官方开放平台接口（需申请授权）、自建爬虫服务或与平台签约的数据服务，在 `lib/collector.js` 中按需扩展。

## 图片说明

- 每个目的地的封面 / 画廊 / 亮点共 7 张照片已**下载到本地** `public/images/<目的地>/`（真实、与目的地匹配的 Unsplash 免费商用授权照片）
- 图片数据在 `data/destinations.json` 中指向本地路径（如 `/images/guilin/cover.jpg`），加载快、离线可用
- 若某张图片缺失或断网，前端会自动切换为「目的地渐变占位卡片」（含 emoji 与地名），不影响页面美观

### 重新抓取/更新图片

图片抓取分两步：

1. **搜索并生成映射**：用浏览器打开 `https://unsplash.com/s/photos/<关键词>`（如 `guilin li river`），提取照片 URL 与 alt 描述，整理到 `tools/unsplash-map.json`（已内置 12 个目的地的精选映射）
2. **下载到本地**（需要联网）：
   ```bash
   node tools/download-images.js
   ```
   并发下载 + 断点续传，失败会自动跳过，重复运行安全；下载成功后自动更新 `data/destinations.json` 为本地路径。

- 图片来源追溯见 `public/images/CREDITS.md`（原图地址与内容描述）
- 另外提供 `tools/fetch-images.js`（Wikimedia Commons 官方 API 方案，CC 授权更严格；注意大陆网络可能无法访问 Wikimedia）
- 建议正式上线前按需替换为你自己的授权照片：编辑 `data/destinations.json` 中对应字段即可

## 项目结构

```
家庭旅游篇/
├── server.js              # 零依赖 Node 服务器（静态页 + REST API）
├── config.json            # 端口 / AI / 数据源配置
├── package.json
├── data/
│   ├── destinations.json  # 目的地数据（照片、亮点、适老信息）
│   ├── packing-db.json    # 内置打包清单规则库（季节/人群/目的地）
│   └── trending.json      # 本地趋势库（演示热度数据）
├── lib/
│   ├── ai.js              # OpenAI 兼容接口客户端
│   ├── recommend.js       # 推荐引擎（AI + 规则降级）
│   └── collector.js       # 平台热度数据采集器
├── tools/
│   ├── unsplash-map.json  # 图片选择映射（目的地 -> 真实照片 URL）
│   ├── download-images.js # 下载图片到 public/images 并更新数据
│   ├── fetch-images.js    # （可选）Wikimedia Commons 抓取方案
│   └── set-key.js         # 服务端内置 DeepSeek Key（node tools/set-key.js sk-xxx）
├── config.local.json      # 【不入 git】服务端内置 Key 等本地敏感配置
└── .gitignore             # 已排除 config.local.json / node_modules 等
└── public/
    ├── index.html         # 单页应用
    ├── css/style.css
    ├── js/app.js
    └── images/            # 本地真实地点照片（每个目的地 7 张）
```

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/destinations` | 目的地列表 |
| GET | `/api/destinations/:id` | 目的地详情 |
| GET | `/api/hot-data` | 平台热门数据 |
| POST | `/api/recommend` | 生成出行打包清单 |
| POST | /api/ai-guide | 生成目的地攻略 |
| POST | /api/plan | AI 主理人：生成逐日详细行程规划 |
| POST | /api/chat | AI 主理人：自由问答 |
| GET | `/api/health` | 健康检查 |

## 后续可扩展方向

- [ ] 接入真实平台数据源（官方 API / 自建爬虫服务）
- [ ] 目的地收藏、行程规划（多日行程表）
- [ ] 天气实时查询联动打包清单
- [ ] 多语言、深色模式
- [ ] 用户登录与家庭档案（慢性病、过敏等健康档案）
- [ ] 部署到服务器 / 小程序

## 邀请码（让邀请的用户使用你的 API）

在「⚙️ 设置」里可以：
- **🔑 设置邀请码**：把码发给邀请的朋友，只有输对邀请码的人才能进入网站，并使用你的 DeepSeek API（配额只被邀请的人消耗）
- **⬆️ 把本机 Key 内置到服务器**：一键把浏览器里已保存的 Key 搬进服务器（`config.local.json`，不入 git），所有用户（含手机端）共用，无需各自填 Key
- 邀请码/Key 的设置接口**仅限本机**访问，外部无法篡改

命令行方式同样可用：`node tools/set-passcode.js 你的邀请码` / `node tools/set-key.js sk-xxx`

## 访问口令（部署到公网时强烈建议启用）

- 启用：`node tools/set-passcode.js 你的口令`（口令写入 `config.local.json`，不入 git）
- 关闭：`node tools/set-passcode.js --clear`
- 启用后，打开网站需先输入口令；未带有效令牌访问 `/api/*` 会返回 401
- 部署到公网后务必启用，避免他人消耗你的 DeepSeek 配额；完整部署步骤见 **DEPLOY.md**

## 免责声明

本应用仅供学习与演示。出行信息、热度数据与 AI 生成内容请以官方渠道和实际为准；请尊重第三方平台条款与图片版权。