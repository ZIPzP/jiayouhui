(() => {
  'use strict';
  /* 中英文案包（方案 B：主题/布局不变，只换文字）
     - 原文以中文为准，字典按「中文原文 -> English」精确匹配
     - 切换语言时自动遍历文本节点与属性，切回中文用缓存的原文还原
     - 新增动态内容由 MutationObserver 自动翻译，无需给每个元素打标记 */
  const LANG_KEY = 'jyh_lang';
  const DICT = {
 "家游汇": "Family Trip Hub",
 "🏡 家游汇": "🏡 Family Trip Hub",
 "家游汇 · 家庭旅游推荐与攻略": "Family Trip Hub · Family Travel Guides",
 "首页": "Home",
 "🏠 首页": "🏠 Home",
 "目的地": "Destinations",
 "🗺️ 目的地": "🗺️ Destinations",
 "行程规划": "Trip Planner",
 "🐱 行程规划": "🐱 Trip Planner",
 "出行清单": "Packing List",
 "🎒 出行清单": "🎒 Packing List",
 "平台热度": "Trending",
 "🔥 平台热度": "🔥 Trending",
 "🎲 抽取": "🎲 Lucky Draw",
 "⚙️ 设置": "⚙️ Settings",
 "长辈模式": "Senior Mode",
 "长辈模式（已开启）": "Senior Mode (on)",
 "🐱 AI 设置": "🐱 AI Settings",
 "📱 手机预览": "📱 Mobile Preview",
 "📖 关于": "📖 About",
 "开始规划": "Start Planning",
 "菜单": "Menu",
 "打开菜单": "Open menu",
 "备案图标": "Filing icon",
 "关闭": "Close",
 "回到顶部": "Back to top",
 "减少动态": "Reduce motion",
 "🏡 家游汇 · 让每一次家庭旅行都充满美好回忆": "🏡 Family Trip Hub · Make every family journey a good memory",
 "🏡 家游汇 · 家庭旅游推荐与攻略选择 — 仅供学习研究与技术交流，严禁商业用途；请遵守中国法律法规及 12306 官方相关规定，合理合规使用": "🏡 Family Trip Hub · Family travel recommendations and guides — for learning, research and technical exchange only; commercial use is strictly prohibited. Please comply with Chinese laws and 12306 official regulations.",
 "AI 驱动的家庭旅行助手": "AI-powered family travel assistant",
 "带上爸妈和孩子": "Bring your parents and kids",
 "一起去看世界": "to see the world together",
 "聚合平台热门数据 · AI 按出行时段生成打包清单与详细行程 · 长辈模式全程守护": "Popular-trip data · AI builds your packing list and detailed itinerary by travel time · Senior Mode included",
 "✈️ 快速生成我的出行清单": "✈️ Quick packing list",
 "出行月份": "Travel month",
 "天数": "Days",
 "2 天": "2 days",
 "3 天": "3 days",
 "4 天": "4 days",
 "5 天": "5 days",
 "7 天": "7 days",
 "👴 老人": "👴 Seniors",
 "🧑 成人": "🧑 Adults",
 "🧒 儿童": "🧒 Children",
 "生成清单": "Generate list",
 "AI 智能行程规划": "AI itinerary planning",
 "聚合平台热门数据，AI 按出行时段生成打包清单与详细行程。长辈模式全程守护，让每一次家庭旅行都安心无忧。": "Popular-trip data, AI-generated packing lists and detailed day-by-day itineraries by travel time. Senior Mode watches over the whole journey.",
 "免费开始规划": "Start planning free",
 "查看目的地": "Browse destinations",
 "已帮助": "Helped",
 "家庭规划完美旅程": "families plan perfect trips",
 "AI 生成逐日详细行程": "AI writes every day in detail",
 "按时段智能推荐用品": "Smart packing by travel time",
 "全程贴心守护": "Care for the whole journey",
 "精选家庭目的地": "Featured family destinations",
 "点卡片查看详情；想去的城市不在列表？去「行程规划」自定义即可": "Tap a card for details. City not listed? Add it yourself in the Trip Planner.",
 "查看全部目的地 →": "View all destinations →",
 "🐱 去规划行程": "🐱 Plan a trip",
 "从这里开始": "Get started",
 "选日期、天数、交通、忌食、预算，AI 生成逐日详细行程": "Pick dates, days, transport, dietary needs and budget — AI writes the day-by-day plan",
 "按出行时段与同行人，AI 推荐该带的旅行用品": "AI suggests what to pack based on travel time and companions",
 "看看最近大家都在去哪些热门目的地": "See which destinations are trending right now",
 "🐱 AI 大模型设置": "🐱 AI Model Settings",
 "推荐 DeepSeek：点「🚀 DeepSeek」一键填入接口与模型，再粘贴你的 API Key。Key 仅保存在本地。": "Recommended: DeepSeek. Click 🚀 DeepSeek to fill in the endpoint and model, then paste your API Key. Your key is stored locally only.",
 "通义千问": "Qwen",
 "🔑 邀请码（解锁服务端 AI，用我的 Key）": "🔑 Invite code (unlock the server-side AI key)",
 "输入邀请码": "Enter invite code",
 "🔓 解锁服务端 AI": "🔓 Unlock server AI",
 "退出解锁（改用自带 Key）": "Leave unlocked mode (use my own key)",
 "接口地址 Base URL": "Base URL",
 "模型": "Model",
 "保存设置": "Save settings",
 "📱 手机预览 · 390px": "📱 Mobile preview · 390px",
 "✕ 关闭": "✕ Close",
 "👴 长辈模式已开启：字体放大、对比增强、支持语音朗读": "👴 Senior Mode on: larger text, higher contrast, voice reading",
 "已退出长辈模式": "Senior Mode off",
 "当前浏览器不支持语音朗读": "This browser does not support voice reading",
 "✅ 图片已保存": "✅ Image saved",
 "当前浏览器暂不支持截图，请用「打印 / 存为 PDF」": "Screenshots aren’t supported in this browser — use Print / Save as PDF",
 "保存图片失败，请用「打印 / 存为 PDF」": "Couldn’t save the image — use Print / Save as PDF",
 "✅ 已导出 1 张拼图（三列并排，放大后左右滑动看）": "✅ Exported as one image (3 columns side by side — zoom in and swipe)",
 "导出失败，请用「打印 / 存为 PDF」": "Export failed — use Print / Save as PDF",
 "✅ Word 已导出，可用 Word / WPS 打开": "✅ Word file exported — open it in Word or WPS",
 "家游汇.png": "FamilyTripHub.png",
 "北京": "Beijing",
 "杭州": "Hangzhou",
 "三亚": "Sanya",
 "成都": "Chengdu",
 "桂林": "Guilin",
 "西安": "Xi’an",
 "张家界": "Zhangjiajie",
 "青岛": "Qingdao",
 "丽江": "Lijiang",
 "上海": "Shanghai",
 "大理": "Dali",
 "重庆": "Chongqing",
 "泉州": "Quanzhou",
 "威海": "Weihai",
 "大同": "Datong",
 "恩施": "Enshi",
 "腾冲": "Tengchong",
 "景德镇": "Jingdezhen",
 "柳州": "Liuzhou",
 "平遥": "Pingyao",
 "湖州": "Huzhou",
 "乐山": "Leshan",
 "漳州": "Zhangzhou",
 "北海": "Beihai",
 "厦门": "Xiamen",
 "大连": "Dalian",
 "广州": "Guangzhou",
 "南京": "Nanjing",
 "苏州": "Suzhou",
 "天津": "Tianjin",
 "哈尔滨": "Harbin",
 "长沙": "Changsha",
 "武汉": "Wuhan",
 "福州": "Fuzhou",
 "舟山": "Zhoushan",
 "汕头": "Shantou",
 "烟台": "Yantai",
 "万宁": "Wanning",
 "秦皇岛": "Qinhuangdao",
 "扬州": "Yangzhou",
 "绍兴": "Shaoxing",
 "凤凰": "Fenghuang",
 "香格里拉": "Shangri-La",
 "九寨沟": "Jiuzhaigou",
 "历史": "History",
 "文化": "Culture",
 "亲子": "Family-friendly",
 "老人友好": "Senior-friendly",
 "自然": "Nature",
 "休闲": "Relaxing",
 "美食": "Food",
 "海滨": "Seaside",
 "摄影": "Photography",
 "探险": "Adventure",
 "古城": "Old town",
 "都市": "City",
 "夜景": "Night views",
 "温泉": "Hot springs",
 "春·秋 最佳": "Best in spring · autumn",
 "冬·春·秋 最佳": "Best in winter · spring · autumn",
 "春·秋·冬 最佳": "Best in spring · autumn · winter",
 "春·秋·夏 最佳": "Best in spring · autumn · summer",
 "夏·秋 最佳": "Best in summer · autumn",
 "春·夏·秋 最佳": "Best in spring · summer · autumn",
 "冬·夏·秋 最佳": "Best in winter · summer · autumn",
 "秋·春·夏 最佳": "Best in autumn · spring · summer",
 "登长城、逛故宫，带爸妈孩子一起触摸千年古都": "Walk the Great Wall and the Forbidden City — a thousand years of history for all ages",
 "西湖边慢慢走，茶园里喝杯龙井，最温柔的江南时光": "Stroll by West Lake and sip Longjing tea — the gentlest side of Jiangnan",
 "冬天带爸妈去三亚晒晒太阳，温暖一整个春节": "Escape winter with your parents — warm sun all through Spring Festival",
 "看滚滚熊猫、吃地道火锅，慢生活天花板": "Giant pandas and real hotpot — the ultimate slow-living city",
 "桂林山水甲天下，泛舟漓江看水墨丹青": "The finest karst scenery in China — drift down the Li River",
 "十三朝古都，从兵马俑到回民街，历史与美食的盛宴": "Thirteen dynasties, from the Terracotta Army to Muslim Quarter street food",
 "悬浮山原型地，《阿凡达》同款奇峰秘境": "The floating mountains that inspired Avatar",
 "红瓦绿树碧海蓝天，啤酒与海风的老城浪漫": "Red roofs, green trees, blue sea — beer, sea breeze and old-town charm",
 "古城慢时光，雪山与纳西文化的温柔相遇": "Slow days in the old town, with snow mountains and Naxi culture",
 "外滩夜景与石库门风情，现代都市的全家漫游": "The Bund at night and shikumen lanes — a modern city for the whole family",
 "苍山洱海间，风花雪月里的家庭慢旅": "Between Cangshan Mountain and Erhai Lake — a slow family escape",
 "8D 魔幻山城，火锅与夜景的双重烟火": "An 8-D mountain city of hotpot and dazzling night views",
 "海上丝绸之路起点，古厝与闽南美食的慢生活": "The starting point of the Maritime Silk Road — old lanes and Minnan food",
 "干净的海滨小城，环海路骑行与海鲜大餐": "A clean little seaside town — coastal cycling and fresh seafood",
 "云冈石窟与悬空寺，北魏古都的低调宝藏": "Yungang Grottoes and the Hanging Temple — a quiet Northern Wei treasure",
 "恩施大峡谷与屏山峡谷，藏在鄂西的山水秘境": "Grand Canyon and Pingshan — hidden wonders of western Hubei",
 "火山热海泡温泉，银杏村的金色童话": "Volcano hot springs and the golden ginkgo village",
 "千年瓷都，亲手做一件属于自己的瓷器": "A thousand years of porcelain — make your own piece",
 "螺蛳粉故乡+柳江山水，好吃又好玩": "Home of luosifen with Liujiang river scenery",
 "保存最完整的明清古城，穿越回晋商时代": "The best-preserved Ming-Qing walled city — back to the age of Shanxi merchants",
 "南浔古镇与安吉竹海，江南的小众清静": "Nanxun old town and Anji bamboo forest — quiet corners of Jiangnan",
 "乐山大佛与峨眉金顶，佛国山水": "The Leshan Giant Buddha and Mount Emei’s golden summit",
 "福建土楼与东山岛，客家文化与海岛风情": "Fujian tulou and Dongshan Island — Hakka culture and island life",
 "银滩+涠洲岛，人少景美的平价海滨": "Silver Beach and Weizhou Island — quiet, affordable coast",
 "文艺海滨与鼓浪屿，都市里的慢生活": "Artsy seaside and Gulangyu — slow living in the city",
 "北方明珠，滨海路与欧式老城的夏日": "The pearl of the north — coastal road and old European-style town",
 "食在广州，骑楼老街与早茶的烟火": "Eat in Guangzhou — arcade streets and morning tea",
 "六朝古都，梧桐大道与金陵往事": "Six dynasties of history, plane-tree avenues and old Jinling",
 "园林之城，小桥流水的江南诗意": "A city of gardens — bridges, canals and Jiangnan poetry",
 "洋楼与相声，海河畔的津味儿": "European villas, crosstalk comedy and Tianjin flavour by the Haihe",
 "冰雪之都，中央大街与索菲亚教堂": "Ice and snow — Central Street and Saint Sophia Cathedral",
 "夜生活与湘菜，橘子洲头的青春": "Nightlife and Hunan cuisine, young energy at Orange Isle",
 "江城过早与樱花，江湖气的大武汉": "River-city breakfasts and cherry blossoms — big Wuhan energy",
 "有福之州，三坊七巷与闽都古韵": "The blessed city — Three Lanes and Seven Alleys",
 "千岛之城，普陀山与海鲜渔港": "A city of islands — Mount Putuo and fishing harbours",
 "潮汕美食与骑楼，海边的工夫茶": "Chaoshan food, arcade streets and seaside gongfu tea",
 "仙境海岸，葡萄庄园与海岛": "Fairyland coast — vineyards and islands",
 "冲浪小镇，日月湾的青春海风": "A surf town — young sea breeze at Riyue Bay",
 "山海关与北戴河，长城入海处": "Shanhaiguan and Beidaihe — where the Great Wall meets the sea",
 "烟花三月下扬州，早茶与园林": "Sailing to Yangzhou in March — morning tea and classical gardens",
 "乌篷船与水乡，鲁迅笔下的故乡": "Wupeng boats and waterways — Lu Xun’s hometown",
 "沱江边的边城，吊脚楼与苗寨": "A riverside border town of stilt houses and Miao villages",
 "心中的日月，雪山草甸与藏地秘境": "The sun and moon in your heart — snow peaks and Tibetan meadows",
 "翠海叠瀑彩林雪峰，带爸妈孩子走进童话世界": "Turquoise lakes, waterfalls, autumn forests and snow peaks — a fairytale for all ages",
 "热门家庭目的地": "Popular family destinations",
 "真实地点照片 · 精选适合全家出行的目的地": "Real photos · hand-picked destinations for the whole family",
 "平台热门目的地": "Trending destinations",
 "全部": "All",
 "查看详情 →": "View details →",
 "上一张": "Previous",
 "下一张": "Next",
 "目的地详情": "Destination details",
 "抽取结果": "Draw result",
 "邀请码": "Invite code",
 "进入": "Enter",
 "风景轮播": "Scenery carousel",
 "如 杭州/拉萨": "e.g. Hangzhou / Lhasa",
 "家庭旅行推荐与攻略 · 请输入邀请码": "Family travel guides · Enter invite code",
 "综合热度": "Overall heat",
 "本地趋势库": "local trend library",
 "🏔️ 雪山": "🏔️ Snow mountains",
 "历史文化研学，春秋最佳、盛夏较热": "History and culture study trips — best in spring and autumn, hot in midsummer",
 "奇峰避暑，夏季云雾最美": "Strange peaks for summer escapes — mistiest in summer",
 "西湖+茶园，春秋最宜、梅雨季偏湿": "West Lake and tea fields — best in spring and autumn, damp in the plum-rain season",
 "熊猫+美食休闲，全年均衡、春秋最旺": "Pandas and food — good all year, busiest in spring and autumn",
 "古都文化+汉服，春秋最舒服": "Ancient capital culture and hanfu — most comfortable in spring and autumn",
 "环洱海慢生活，春秋最宜、冬季温暖": "Slow life around Erhai Lake — best in spring and autumn, mild in winter",
 "海滨避暑，6-9 月最旺": "Seaside summer escape — busiest from June to September",
 "古城+雪山，春秋最宜、冬季温暖": "Old town and snow mountains — best in spring and autumn, mild in winter",
 "8D夜景+火锅，春秋最宜、夏季火炉较热": "8-D night views and hotpot — best in spring and autumn, a furnace in summer",
 "冬季避寒热门，暑期为淡季": "A winter warm-up favourite — low season in midsummer",
 "AI 设置": "AI Settings",
 "手机预览": "Mobile preview",
 "长辈模式已开启": "Senior Mode is on",
 "抽取热门家庭目的地": "Draw a popular family destination",
 "不知道去哪玩？点一下，让缘分帮你决定下一站全家之旅": "Can’t decide where to go? Tap and let fate pick your family’s next trip",
 "🎲 开始抽取": "🎲 Start drawing",
 "🕘 最近抽到": "🕘 Recently drawn",
 "🎲 再抽一次": "🎲 Draw again",
 "📖 查看完整攻略": "📖 View full guide",
 "关于家游汇": "About Family Trip Hub",
 "🐱 AI 大模型": "🐱 AI models",
 "接入 DeepSeek 等大模型，根据「目的地 + 出行时段 + 同行人 + 忌食/预算」生成个性化行程与打包清单；未配置 Key 时自动使用内置规则引擎。": "Connects to DeepSeek and other LLMs to generate personalised itineraries and packing lists from your destination, travel time, companions, dietary needs and budget. Without an API key it falls back to the built-in rule engine.",
 "📍 自定义目的地": "📍 Custom destinations",
 "不局限于内置城市列表：在「行程规划」中输入任意城市，AI 照样为你规划。": "Not limited to the built-in list — type any city in the Trip Planner and AI will plan it.",
 "👴 老年人模式": "👴 Senior Mode",
 "一键切换大字体、高对比、大按钮，并支持语音朗读，让长辈看得清、听得懂。": "One tap for larger text, higher contrast, bigger buttons and voice reading — easy for older travellers to see and hear.",
 "🔒 隐私安全": "🔒 Privacy and security",
 "API Key 可内置到服务器本地配置（不入 git），支持访问口令门禁，公网部署时保护你的配额。": "API keys can live in the server’s local config (never committed to git), with an optional access passcode to protect your quota on public deployments.",
 "免责声明": "Disclaimer",
 "本项目仅供学习、研究与技术交流，严禁用于任何商业用途。": "This project is for learning, research and technical exchange only. Commercial use is strictly prohibited.",
 "本项目不存储、不篡改、不传播任何 12306 官方数据，仅作为官方公开接口的智能聚合与转发。": "This project does not store, alter or redistribute any official 12306 data; it only aggregates and forwards publicly available official endpoints.",
 "使用本项目造成的任何后果（包括但不限于账号封禁、数据异常、法律风险等）均由使用者本人承担，项目作者不承担任何责任。": "Any consequences of using this project (including but not limited to account bans, data anomalies or legal risks) are borne solely by the user; the author accepts no responsibility.",
 "请遵守中国法律法规及 12306 官方相关规定，合理合规使用。": "Please comply with Chinese laws and 12306’s official rules, and use this project responsibly.",
 "AI 主理人 · 行程规划": "AI Planner · Trip Planner",
 "输入城市名会自动提示补全；出发城市和目的地必填。AI 自动生成含价格估算、交通安排、忌食提醒的逐日详细行程；页面下方还能直接向 AI 主理人提问": "Type a city name for suggestions; departure city and destination are required. AI generates a detailed day-by-day itinerary with cost estimates, transport and dietary notes — and you can chat with the AI planner below.",
 "出发城市": "Departure city",
 "返回目的地（可选）": "Return destination (optional)",
 "去程日期": "Departure date",
 "返程日期": "Return date",
 "行程天数": "Trip length",
 "交通方式": "Transport",
 "✈️ 飞机": "✈️ Flight",
 "🚄 高铁": "🚄 High-speed rail",
 "🚗 自驾": "🚗 Self-driving",
 "🚌 大巴": "🚌 Coach",
 "❓ 未定": "❓ Not decided",
 "交通出行时间": "Time of day",
 "🌅 上午": "🌅 Morning",
 "☀️ 中午": "☀️ Midday",
 "🌇 下午": "🌇 Afternoon",
 "同行人数": "Travellers",
 "忌食 / 饮食（可多选）": "Dietary needs (multi-select)",
 "🌶️ 不吃辣": "🌶️ No spicy food",
 "🥬 素食": "🥬 Vegetarian",
 "🕌 清真": "🕌 Halal",
 "🦐 海鲜过敏": "🦐 Seafood allergy",
 "🥜 坚果过敏": "🥜 Nut allergy",
 "🥛 乳糖不耐": "🥛 Lactose intolerant",
 "✅ 无特别忌口": "✅ No restrictions",
 "预算档位": "Budget level",
 "💰 经济型": "💰 Budget",
 "💳 舒适型": "💳 Comfort",
 "💎 豪华型": "💎 Luxury",
 "游玩节奏": "Pace",
 "🐢 轻松慢游": "🐢 Relaxed",
 "🚶 标准": "🚶 Standard",
 "⚡ 紧凑": "⚡ Packed",
 "住宿偏好": "Accommodation",
 "🏨 连锁酒店": "🏨 Chain hotel",
 "🏡 民宿": "🏡 Guesthouse",
 "🏰 高档酒店": "🏰 Upscale hotel",
 "🤷 无要求": "🤷 No preference",
 "兴趣偏好（可多选）": "Interests (multi-select)",
 "🏞️ 自然风光": "🏞️ Nature",
 "🏯 历史人文": "🏯 History & culture",
 "🏛️ 博物馆": "🏛️ Museums",
 "🌊 海滨玩水": "🌊 Beaches",
 "🏘️ 古城老街": "🏘️ Old towns",
 "🌃 夜景": "🌃 Night views",
 "🎡 亲子乐园": "🎡 Theme parks",
 "其他需求（自由填写，可选）": "Other requests (optional, free text)",
 "🕘 历史生成记录": "🕘 Recent plans",
 "🐱 生成完整行程规划": "🐱 Generate full itinerary",
 "点击「生成完整行程规划」": "Tap “Generate full itinerary”",
 "AI 主理人会为你安排逐日行程、交通、餐厅与费用估算": "AI will plan each day, plus transport, restaurants and cost estimates",
 "💬 AI 主理人问答": "💬 Ask the AI planner",
 "演示模式": "Demo mode",
 "发送": "Send",
 "如 北京/上海": "e.g. Beijing / Shanghai",
 "不填默认返回出发城市": "Leave blank to return to your departure city",
 "如：想坐竹筏看日出、老人腿脚不便需要少走路、预算不含购物……": "e.g. bamboo rafting at sunrise, limited walking for elderly parents, budget excludes shopping…",
 "输入你的问题，回车发送…": "Ask a question, press Enter to send…",
 "🖨️ 打印 / 存为 PDF": "🖨️ Print / Save as PDF",
 "📷 保存为图片": "📷 Save as image",
 "✂️ 三等分拼图": "✂️ 3-column image",
 "📝 导出 Word": "📝 Export Word",
 "出行打包清单": "Packing list",
 "选择目的地与出行时段，AI 为你和家人量身推荐该带的旅行用品": "Pick a destination and travel time — AI tailors the packing list for you and your family",
 "出行月份（AI 据此判断季节与天气）": "Travel month (AI uses it for season and weather)",
 "详细程度": "Detail level",
 "📦 简略（精选必备）": "📦 Simple (essentials)",
 "🧳 超详细（懒人攻略：防晒会补清洁乳、湿巾配纸巾…）": "🧳 Detailed (sunscreen comes with cleanser, wipes with tissues…)",
 "用户要求（可选，会结合需求生成）": "Your requests (optional)",
 "🐱 生成打包清单": "🐱 Generate packing list",
 "📋 演示模式（内置规则引擎）。配置 DeepSeek Key 后启用大模型。": "📋 Demo mode (built-in rules). Add a DeepSeek key to enable the LLM.",
 "点击「生成打包清单」": "Tap “Generate packing list”",
 "AI 会根据出行时段、目的地和同行人给出建议": "AI suggests items based on travel time, destination and companions",
 "如：带老人要多带膏药；给孩子多带零食；我要拍照带三脚架……": "e.g. extra pain patches for elderly parents, more snacks for kids, a tripod for photography…",
 "自然风光": "Nature",
 "博物馆": "Museums",
 "海滨玩水": "Beaches",
 "古城老街": "Old towns",
 "清空": "Clear",
 "📋 演示模式：未配置 AI Key，将使用内置规划引擎（点右上角 ⚙️ AI 设置 接入 DeepSeek）": "📋 Demo mode: no AI key yet — using the built-in planning engine",
 "你好呀，我是「家游汇」的 AI 主理人 🏡 可以问我任何家庭旅行问题，比如「带老人孩子去西安怎么安排 5 天？」": "Hi! I’m the Family Trip Hub AI planner 🏡 Ask me anything about family travel — e.g. “How should we plan 5 days in Xi’an with elderly parents and kids?”",
 "口令错误，请重试": "Wrong passcode, please try again",
 "📋 内置规划引擎": "📋 Built-in planner",
 "📋 内置规则引擎": "📋 Built-in rules engine",
 "🚄 12306 实时车次与票价": "🚄 Live 12306 trains and fares",
 "🚄 交通安排": "🚄 Transport plan",
 "去程：": "Outbound: ",
 "返程：": "Return: ",
 "当地：": "Local: ",
 "💰 费用估算（人均）": "💰 Cost estimate (per person)",
 "🥢 忌食与用餐提醒": "🥢 Dietary notes",
 "💡 出行提醒": "💡 Travel tips",
 "💡 出行贴士": "💡 Travel tips",
 "数据来自 12306 实时官方查询，请以 12306 实际为准": "Live data from the official 12306 service — always confirm with 12306",
 "必带": "Must-have",
 "建议": "Suggested",
 "可选": "Optional",
 "证件财务": "Documents & money",
 "电子设备": "Electronics",
 "药品健康": "Medicine & health",
 "衣物鞋帽": "Clothing & shoes",
 "洗护防晒": "Toiletries & sun care",
 "出行装备": "Travel gear",
 "🌤️ 天气": "🌤️ Weather",
 "📦 简略": "📦 Simple",
 "🧳 超详细": "🧳 Detailed",
 "🔊 朗读行程": "🔊 Read itinerary aloud",
 "🔊 朗读清单": "🔊 Read list aloud",
 "连锁酒店": "Chain hotel",
 "民宿": "Guesthouse",
 "高档酒店": "Upscale hotel",
 "无要求": "No preference",
 "所在省份": "Province",
 "最佳季节": "Best season",
 "建议天数": "Suggested length",
 "气候特点": "Climate",
 "👴 适老提示：": "👴 Senior-friendly:",
 "✨ 特色亮点": "✨ Highlights",
 "🍜 当地美食": "🍜 Local food",
 "🎒 生成这份目的地的出行清单": "🎒 Build a packing list for this destination",
 "🐱 AI 生成攻略": "🐱 AI travel guide",
 "📷 更多照片": "📷 More photos",
 "春": "Spring",
 "夏": "Summer",
 "秋": "Autumn",
 "冬": "Winter",
 "晴": "Sunny",
 "多云": "Cloudy",
 "阴": "Overcast",
 "小雨": "Light rain",
 "中雨": "Moderate rain",
 "大雨": "Heavy rain",
 "暴雨": "Rainstorm",
 "雷阵雨": "Thunderstorms",
 "阵雨": "Showers",
 "小雪": "Light snow",
 "中雪": "Moderate snow",
 "大雪": "Heavy snow",
 "雨夹雪": "Sleet",
 "雾": "Fog",
 "霾": "Haze",
 "大风": "Strong wind",
 "冰雹": "Hail",
 "浮尘": "Dust",
 "扬沙": "Sand",
 "河北": "Hebei",
 "山西": "Shanxi",
 "辽宁": "Liaoning",
 "吉林": "Jilin",
 "黑龙江": "Heilongjiang",
 "江苏": "Jiangsu",
 "浙江": "Zhejiang",
 "安徽": "Anhui",
 "福建": "Fujian",
 "江西": "Jiangxi",
 "山东": "Shandong",
 "河南": "Henan",
 "湖北": "Hubei",
 "湖南": "Hunan",
 "广东": "Guangdong",
 "广西": "Guangxi",
 "海南": "Hainan",
 "四川": "Sichuan",
 "贵州": "Guizhou",
 "云南": "Yunnan",
 "西藏": "Tibet",
 "陕西": "Shaanxi",
 "甘肃": "Gansu",
 "青海": "Qinghai",
 "宁夏": "Ningxia",
 "新疆": "Xinjiang",
 "内蒙古": "Inner Mongolia",
 "香港": "Hong Kong",
 "澳门": "Macau",
 "台湾": "Taiwan",
 "出行天数": "Trip length",
 "出行日期": "Travel dates",
 "出行人数": "Travellers",
 "🔊 朗读": "🔊 Read aloud",
 "🔊 朗读介绍": "🔊 Read the introduction",
 "AI 主理人正在后台生成行程…": "The AI planner is building your itinerary in the background…",
 "你可以放心切到别的页面/标签页，回来会自动恢复显示结果": "Feel free to switch pages or tabs — the result will be restored when you return.",
 "（当前为演示模式，未配置 AI Key）我是「家游汇」AI 主理人 🐱 配置 DeepSeek API Key 后，我可以帮你规划详细行程、推荐餐厅、估算费用、安排交通。你也可以直接使用页面上方的「行程规划」按钮式表单生成完整方案。": "(Demo mode — no AI key configured.) I’m the Family Trip Hub AI planner 🐱 Add a DeepSeek API key and I can plan detailed itineraries, recommend restaurants, estimate costs and arrange transport. You can also use the Trip Planner form above to generate a full plan.",
 "生成失败：": "Generation failed: ",
 "✨ 必去亮点": "✨ Must-see highlights"
};
  // 上下文词典：同一个中文在不同位置用不同英文（如表单里的「目的地」用单数）
  const CTX = { 'form-label': { '目的地': 'Destination' } };
  const ATTRS = ['placeholder', 'title', 'aria-label', 'alt'];
  const SKIP_TAGS = /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA|CODE)$/;
  let lang = 'zh';
  try { lang = localStorage.getItem(LANG_KEY) === 'en' ? 'en' : 'zh'; } catch (e) { /* 忽略 */ }
  const textCache = new WeakMap();  // textNode -> 原文
  const attrCache = new WeakMap();  // element -> { attr: 原文 }
  const titleCache = { zh: null };

  // 动态句式（含变量）：如「查看 北京 详情」
  const PATTERNS = [
    [/^查看 (.+) 详情$/, (m) => 'View ' + (DICT[m[1]] || m[1]) + ' details'],
    [/^(\d+)月$/, (m) => ['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m[1]) - 1]],
    [/^(\d+) 天$/, (m) => m[1] + ' days'],
    [/^(\d+) 晚$/, (m) => m[1] + ' nights'],
    [/^🐱 AI 主理人生成 · (.+)$/, (m) => '🐱 AI generated · ' + m[1]],
    [/^历时(.+)$/, (m) => 'Duration ' + m[1]],
    [/^合计：(.+)$/, (m) => 'Total: ' + m[1]],
    [/^🏨 (.+)$/, (m) => '🏨 ' + (DICT[m[1]] || m[1])],
    [/^💰 人均约 (.+)$/, (m) => '💰 About ¥' + m[1] + ' per person'],
    [/^(\d+)-(\d+) 天$/, (m) => m[1] + '–' + m[2] + ' days'],
    [/^🌤️ 未来 (\d+) 天天气（(.+)）$/, (m) => '🌤️ Next ' + m[1] + '-day weather (' + (DICT[m[2]] || m[2]) + ')'],
    [/^周([一二三四五六日])$/, (m) => ({ '一': 'Mon', '二': 'Tue', '三': 'Wed', '四': 'Thu', '五': 'Fri', '六': 'Sat', '日': 'Sun' }[m[1]])],
    [/^(.+)转(.+)$/, (m) => { const p1 = DICT[m[1]], p2 = DICT[m[2]]; return (p1 && p2) ? p1 + ' → ' + p2 : null; }],
    [/^([春夏秋冬](、[春夏秋冬])+)$/, (m) => m[1].split('、').map((x) => DICT[x] || x).join(', ')],
    [/^(\d+)月(\d+)日 周([一二三四五六日])，(.+)$/, (m) => ['January','February','March','April','May','June','July','August','September','October','November','December'][Number(m[1]) - 1] + ' ' + m[2] + ' (' + m[4] + ')'],
    [/^本月热度 (\d+)$/, (m) => 'This month: ' + m[1]],
    [/^(\d+)月热门榜 · 更新于 (.+) · 数据源：(.+)$/, (m) => 'Top picks for month ' + m[1] + ' · updated ' + m[2] + ' · source: ' + (DICT[m[3]] || m[3])],
    [/^(\d+)月热门榜 · 更新于 (.+)$/, (m) => 'Top picks for month ' + m[1] + ' · updated ' + m[2]],
    [/^共 (\d+) 个热门家庭目的地 · 每个都适合全家出行$/, (m) => m[1] + ' popular family destinations · all great for the whole family'],
    [/^查看更多目的地（还有 (\d+) 个）$/, (m) => 'View more destinations (' + m[1] + ' more)']
  ];
  // 精确匹配；再尝试「emoji/符号前缀 + 词干」复用，如「🏯 北京」复用「北京」
  function lookup(s) {
    const k = String(s).trim();
    if (!k) return null;
    if (Object.prototype.hasOwnProperty.call(DICT, k)) return { pre: '', en: DICT[k] };
    const m = k.match(/^([^\p{L}\p{N}]+)(.+)$/u);
    if (m && Object.prototype.hasOwnProperty.call(DICT, m[2])) return { pre: m[1], en: DICT[m[2]] };
    // 组合串：如「历史 · 文化 · 亲子」逐段翻译后重新拼接
    // 顿号列表：如「沙虫粥、蟹仔粉、烤生蚝」逐项翻译
    if (k.includes('、')) {
      const parts = k.split('、');
      const en2 = parts.map((x) => DICT[x.trim()] || null);
      if (en2.length > 1 && en2.every(Boolean)) return { pre: '', en: en2.join(', ') };
    }
    if (k.includes(' · ')) {
      const parts = k.split(' · ');
      const en = parts.map((x) => DICT[x.trim()] || null);
      if (en.every(Boolean)) return { pre: '', en: en.join(' · ') };
    }
    for (const [re, fn] of PATTERNS) { const mm = k.match(re); if (mm) { const v = fn(mm); if (v) return { pre: '', en: v }; } }
    return null;
  }
  const hit = (s) => { const r = lookup(s); return r ? r.pre + r.en : null; };

  function trText(node) {
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    if (!textCache.has(node)) textCache.set(node, raw);
    const orig = textCache.get(node);
    const pel = node.parentElement;
    const ctxMap = pel && pel.classList && pel.classList.contains('form-label') ? CTX['form-label'] : null;
    const en = (ctxMap && ctxMap[orig.trim()]) || hit(orig);
    if (!en) return;
    const lead = (orig.match(/^\s*/) || [''])[0];
    const tail = (orig.match(/\s*$/) || [''])[0];
    const next = lang === 'en' ? lead + en + tail : orig;
    if (node.nodeValue !== next) node.nodeValue = next;
  }

  function trAttrs(el) {
    if (!el.hasAttribute) return;
    let map = attrCache.get(el);
    if (!map) { map = {}; attrCache.set(el, map); }
    for (const a of ATTRS) {
      if (!el.hasAttribute(a)) continue;
      if (map[a] === undefined) map[a] = el.getAttribute(a);
      const orig = map[a];
      const en = hit(orig);
      if (!en) continue;
      const next = lang === 'en' ? en : orig;
      if (el.getAttribute(a) !== next) el.setAttribute(a, next);
    }
  }

  function walk(root) {
    if (!root) return;
    if (root.nodeType === 3) { trText(root); return; }
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    if (root.nodeType === 1) {
      if (SKIP_TAGS.test(root.tagName)) return;
      trAttrs(root);
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
      acceptNode(n) {
        if (n.nodeType === 1) return SKIP_TAGS.test(n.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    let n;
    while ((n = walker.nextNode())) {
      if (n.nodeType === 3) trText(n); else trAttrs(n);
    }
  }

  function applyTitle() {
    if (titleCache.zh === null) titleCache.zh = document.title;
    const en = hit(titleCache.zh);
    if (!en) return;
    document.title = lang === 'en' ? en : titleCache.zh;
  }

  function updateSwitch() {
    const btn = document.getElementById('langSwitch');
    if (!btn) return;
    btn.textContent = lang === 'en' ? '🌏 中文' : '🌏 English';
    btn.title = lang === 'en' ? 'Switch to Chinese' : '切换到英文';
    btn.setAttribute('aria-label', btn.title);
  }

  function mountSwitch() {
    const actions = document.querySelector('.nav-actions');
    if (!actions || document.getElementById('langSwitch')) return;
    const btn = document.createElement('button');
    btn.id = 'langSwitch';
    btn.type = 'button';
    btn.className = 'btn btn-ghost btn-lang';
    btn.addEventListener('click', () => setLang(lang === 'en' ? 'zh' : 'en'));
    actions.insertBefore(btn, actions.firstChild);
    updateSwitch();
  }

  function setLang(next) {
    const target = next === 'en' ? 'en' : 'zh';
    if (target === lang) { updateSwitch(); return; }
    lang = target;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* 忽略 */ }
    // 重新加载：i18n.js 在 common.js 之前执行，能保证「先翻译、再逐字拆字」，
    // 同时页面里由 JS 动态生成的中文内容（结果卡片/提示等）也会一起换成新语言
    location.reload();
  }

  function boot() {
    document.documentElement.classList.toggle('lang-en', lang === 'en');
    document.documentElement.setAttribute('lang', lang === 'en' ? 'en' : 'zh-CN');
    mountSwitch();
    if (lang === 'en') { walk(document.body); applyTitle(); updateSwitch(); }
    // 英文模式：拉取目的地数据翻译表（亮点/适老说明等）并并入字典，再重扫一遍
    if (lang === "en") {
      fetch("/api/dest-i18n").then((r) => (r.ok ? r.json() : null)).then((j) => {
        if (!j || !j.map) return;
        let added = 0;
        Object.keys(j.map).forEach((k) => { if (!Object.prototype.hasOwnProperty.call(DICT, k)) { DICT[k] = j.map[k]; added++; } });
        if (added) { walk(document.body); applyTitle(); }
      }).catch(() => {});
    }
    if ('MutationObserver' in window) {
      let pend = false;
      let queue = [];
      const mo = new MutationObserver((muts) => {
        if (lang !== 'en') return;
        // 累积所有新增节点（rAF 等待期间的变更不能丢，否则动态生成的月份/卡片不会被翻译）
        for (const m of muts) for (const n of m.addedNodes) queue.push(n);
        if (pend) return;
        pend = true;
        requestAnimationFrame(() => {
          pend = false;
          const batch = queue; queue = [];
          for (const n of batch) walk(n);
        });
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  window.i18n = {
    get lang() { return lang; },
    setLang,
    apply: () => walk(document.body),
    /** JS 里需要中文->英文时用它：t('首页') */
    t: (s) => (lang === 'en' && hit(s)) || s
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
