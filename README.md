# 🏡 家游汇 · 家庭旅游推荐与攻略选择

面向家庭的旅游网页应用：**43 个精选国内目的地**，由 AI 大模型根据「出行时段 + 出发地/目的地 + 同行人 + 其他需求」生成**逐日行程规划**与**出行打包清单**，内置**长辈模式**（大字体 / 高对比 / 大按钮 / 语音朗读）。

- 纯原生实现，**零依赖**，无需 `npm install`
- 已上线：**https://familytravelhublz.top** （阿里云 2 核 2G + Cloudflare 隧道，24 小时在线，电脑可关机）
- 43 城真实地点照片（340+ 张本地图片，按城市分目录）
- 无 AI Key 时自动降级为内置规则引擎，开箱即用

---

## 快速开始（本地开发）

```bash
# 启动（需要 Node.js 18+）
node server.js
```

访问 http://localhost:3000 即可。

## 功能

| 功能 | 说明 |
| --- | --- |
| AI 行程规划 | 选项式表单（去返日期 / 天数 / 交通 / 忌食 / 预算 / 节奏 / 返回目的地等），AI 生成逐日详细行程（含交通、人均费用、忌食提醒）；「其他需求」AI 严格遵循；**高铁/火车自动查询 12306 真实车次**（不编造班次票价）；表单草稿自动保存，切页不丢 |
| 热门目的地 | 43 个国内家庭游目的地，真实照片、特色亮点、**15 天天气预报**、当地美食（辣度 / 适合人群标签）、适老提示 |
| AI 出行清单 | 目的地 + 出行月份 + 天数 + 同行人数 + 兴趣；支持「📦 简略 / 🧳 超详细（懒人配套：防晒→清洁乳、湿巾→纸巾…）」模式 + 用户要求填写框 |
| AI 旅行攻略 | 目的地详情一键生成家庭攻略 |
| 平台热度 | 按**当月**动态排名的热门目的地 |
| 老年人模式 | 一键切换：字体放大、高对比、大按钮、语音朗读 |

## 接入 DeepSeek（AI 主理人）

**服务器内置 Key（推荐，Key 只属于你，不入 git）：**
- 服务器终端：`node tools/set-key.js sk-你的key`
- 清除：`node tools/set-key.js --clear`
- Key 写入 `config.local.json`（已被 `.gitignore` 排除），浏览器不保存

**浏览器本地 Key（可选）：**
- 页面「⚙️ 设置 → AI 设置」输入 Key，仅保存在该浏览器 localStorage

> 支持 OpenAI 兼容协议的其他模型（OpenAI / 通义千问 / Moonshot 等），也可用环境变量 `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL`。
> 未配置 Key 或调用失败时自动使用内置规则引擎（`data/packing-db.json` / `lib/planner.js`）。

## 邀请码 / 访问口令

- 启用 / 修改（**仅站长**，通过服务器终端）：
  ```bash
  node tools/set-passcode.js 你的口令
  # 或直接改 /opt/jiayouhui/config.local.json 中的 access.passcode（立即生效）
  ```
- 用户端只能输入邀请码进入，**无法修改**（安全考虑，客户端已移除修改入口）

## 部署（阿里云）

- 一键脚本：`deploy/server-setup.sh`（装 Node → pm2 → 拉代码 → 填 Key/口令 → Nginx + HTTPS）
- 进程管理：pm2（`ecosystem.config.js`，重启自启）
- 公网：Cloudflare 隧道或域名直连；详细步骤见 **阿里云服务器部署指南.md** 与 **运维手册.md**

## 项目结构

```
家庭旅游篇/
├── server.js              # 零依赖 Node 服务器（静态页 + REST API）
├── config.json            # 端口 / AI / 图片域名等配置
├── config.local.json      # 【不入 git】服务端 Key / 口令
├── package.json
├── data/
│   ├── destinations.json  # 43 城目的地（照片、亮点、美食、天气坐标）
│   ├── packing-db.json    # 内置打包清单规则库
│   ├── cities.json        # 中国城市名单（384 城，输入提示/校验）
│   ├── weather-codes.json # 中国天气网城市代码
│   └── trending.json      # 本地趋势库（演示热度）
├── lib/
│   ├── ai.js              # OpenAI 兼容接口客户端
│   ├── planner.js         # 行程规划引擎（AI + 规则降级，含 12306 车次）
│   ├── recommend.js       # 出行清单引擎（AI + 规则降级，超详细配套）
│   ├── weather.js         # 15 天天气（中国天气网，Open-Meteo 备用）
│   ├── train.js           # 12306 真实车次查询
│   └── auth.js / collector.js
├── deploy/                # 阿里云一键部署脚本 + nginx 配置
├── tools/                 # set-key / set-passcode / 图片工具等
└── public/
    ├── index.html         # 首页（桌面版轮播 Hero + 3×2 精选）
    ├── destinations.html / plan.html / packing.html / hot.html / about.html
    ├── css/style.css
    ├── js/                # common / home / destinations / plan / packing / hot / detail
    └── images/            # 43 城本地真实照片（346 张）
```

## API 一览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/destinations` | 目的地列表 |
| GET | `/api/destinations/:id` | 目的地详情 |
| GET | `/api/images` | 全部实景照片（首页轮播用） |
| GET | `/api/cities` | 中国城市名单 |
| GET | `/api/weather?id=` | 15 天天气预报 |
| GET | `/api/hot-data` | 平台热门数据 |
| POST | `/api/recommend` | 生成出行打包清单（简略/超详细 + 用户要求） |
| POST | `/api/plan` | AI 主理人：生成逐日行程（含 12306 真实车次） |
| POST | `/api/chat` | AI 主理人：自由问答 |
| GET | `/api/health` | 健康检查 |

## 免责声明

本应用仅供学习与演示。出行信息、热度数据、天气与 AI 生成内容请以官方渠道和实际为准；火车/飞机班次与票价请以 12306 / 航司官方实时查询为准；请尊重第三方平台条款与图片版权。
