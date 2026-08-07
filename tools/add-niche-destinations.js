'use strict';
/** 追加 12 个小众目的地到 destinations.json（图片后续由抓取脚本填充） */
const fs = require('fs');
const path = require('path');
const FILE = path.join(__dirname, '..', 'data', 'destinations.json');

const NEW = [
  { id: 'quanzhou', name: '泉州', enName: 'Quanzhou', province: '福建', emoji: '🏮', accent: '#b45309',
    tagline: '海上丝绸之路起点，古厝与闽南美食的慢生活', tags: ['古城', '美食', '文化', '老人友好'],
    bestSeasons: ['春', '秋', '冬'], suggestDays: '2-3 天', climate: '亚热带海洋性季风，四季温润，冬无严寒',
    cover: '', gallery: [], elderlyFriendly: '市区平缓，开元寺、西街步行友好；海鲜街市注意肠胃。',
    packingNote: '春秋带薄外套，冬季轻便保暖；美食街步行多，穿舒适鞋。',
    description: '泉州是"宋元中国的世界海洋商贸中心"，红砖古厝、千年开元寺、簪花渔村，还有满街地道的闽南小吃，节奏慢、人情暖，很适合陪父母慢慢逛。',
    highlights: [
      { title: '开元寺·东西双塔', text: '千年古刹与宋代石塔，庭院清幽，适合长辈礼佛散步。', image: '' },
      { title: '西街美食', text: '面线糊、土笋冻、润饼……一条街吃遍闽南味。', image: '' },
      { title: '蟳埔村', text: '簪花围、蚵壳厝，体验"头上花园"的渔村浪漫。', image: '' } ] },
  { id: 'weihai', name: '威海', enName: 'Weihai', province: '山东', emoji: '🌊', accent: '#2b6cb0',
    tagline: '干净的海滨小城，环海路骑行与海鲜大餐', tags: ['海滨', '亲子', '休闲'],
    bestSeasons: ['夏', '秋'], suggestDays: '3 天', climate: '海洋性气候，夏季凉爽，是避暑胜地',
    cover: '', gallery: [], elderlyFriendly: '环海路平缓、可骑行，海边风大注意防风。',
    packingNote: '夏季防晒+薄外套，泳衣按需；吃海鲜备肠胃药。',
    description: '威海人少景美，海水干净。刘公岛看历史、环海路吹海风、浴场挖沙赶海，节奏轻松，是全家人度夏的好去处。',
    highlights: [
      { title: '刘公岛', text: '甲午故地，岛上绿树成荫，乘船半小时即达。', image: '' },
      { title: '环海路', text: '沿海慢行或骑行，一路海天一色，随手都是明信片。', image: '' },
      { title: '国际海水浴场', text: '沙细水清，傍晚看落日，孩子挖沙玩水正合适。', image: '' } ] },
  { id: 'datong', name: '大同', enName: 'Datong', province: '山西', emoji: '🏛️', accent: '#7c3aed',
    tagline: '云冈石窟与悬空寺，北魏古都的低调宝藏', tags: ['历史', '文化', '老人友好'],
    bestSeasons: ['春', '秋'], suggestDays: '2-3 天', climate: '温带大陆性气候，四季分明，春秋最宜',
    cover: '', gallery: [], elderlyFriendly: '云冈石窟、悬空寺均有游览车/索道，减少步行。',
    packingNote: '春秋备外套防风沙；古建多台阶，穿防滑鞋。',
    description: '大同是北魏古都，云冈石窟的千年石刻、悬空寺的奇险、古城墙的厚重，游客不多、物价实在，适合喜欢历史文化的一家人。',
    highlights: [
      { title: '云冈石窟', text: '世界文化遗产，5.9 万尊造像气势恢宏，有电瓶车代步。', image: '' },
      { title: '悬空寺', text: '建于悬崖上的千年寺庙，登临需走台阶，远观亦震撼。', image: '' },
      { title: '大同古城墙', text: '可骑行或电瓶车环城，傍晚看古城灯火。', image: '' } ] },
  { id: 'enshi', name: '恩施', enName: 'Enshi', province: '湖北', emoji: '🏞️', accent: '#059669',
    tagline: '恩施大峡谷与屏山峡谷，藏在鄂西的山水秘境', tags: ['自然', '探险', '摄影'],
    bestSeasons: ['春', '夏', '秋'], suggestDays: '3-4 天', climate: '亚热带山地气候，夏季凉爽，云雾多',
    cover: '', gallery: [], elderlyFriendly: '大峡谷台阶较多，腿脚不便的长辈建议只走精华段或乘观光电梯。',
    packingNote: '防滑鞋、雨衣、驱蚊液必备；山地温差大带薄外套。',
    description: '恩施把"仙本那"般的屏山峡谷、奇绝的大峡谷和土家女儿城装进一座城，是摄影与探险爱好者的心头好。',
    highlights: [
      { title: '恩施大峡谷', text: '绝壁栈道、一炷香，云海翻涌时如同仙境。', image: '' },
      { title: '屏山峡谷', text: '"悬浮船"网红打卡地，清澈见底的翡翠水。', image: '' },
      { title: '土家女儿城', text: '土家风情街市，晚上有民俗表演，老少皆宜。', image: '' } ] },
  { id: 'tengchong', name: '腾冲', enName: 'Tengchong', province: '云南', emoji: '♨️', accent: '#dc2626',
    tagline: '火山热海泡温泉，银杏村的金色童话', tags: ['自然', '温泉', '休闲', '老人友好'],
    bestSeasons: ['春', '秋', '冬'], suggestDays: '3 天', climate: '高原季风气候，四季如春，冬暖夏凉',
    cover: '', gallery: [], elderlyFriendly: '热海温泉、和顺古镇节奏舒缓，特别适合陪长辈放松。',
    packingNote: '泡温泉带泳衣；高原紫外线强备防晒；早晚温差大加外套。',
    description: '腾冲有火山热海的地热奇观、秋天满村金黄的银杏、安静的和顺古镇，还有边境侨乡的慢时光，是"带爸妈泡汤放空"的理想地。',
    highlights: [
      { title: '热海温泉', text: '大滚锅地热蒸腾，泡汤祛寒，长辈最爱。', image: '' },
      { title: '银杏村', text: '11 月满村银杏金黄，拍照超出片。', image: '' },
      { title: '和顺古镇', text: '图书馆、洗衣亭、老宅水田，田园牧歌般清净。', image: '' } ] },
  { id: 'jingdezhen', name: '景德镇', enName: 'Jingdezhen', province: '江西', emoji: '🏺', accent: '#0d9488',
    tagline: '千年瓷都，亲手做一件属于自己的瓷器', tags: ['文化', '亲子', '古城'],
    bestSeasons: ['春', '秋'], suggestDays: '2-3 天', climate: '亚热带季风气候，春秋最宜',
    cover: '', gallery: [], elderlyFriendly: '古窑、陶溪川以室内为主，步道平缓。',
    packingNote: '体验陶艺备围裙/换洗衣物；春秋带薄外套。',
    description: '在景德镇，全家可以一起拉坯、画瓷、烧窑，带走一件独一无二的"家传瓷器"；古窑民俗区和陶溪川的夜景各有味道。',
    highlights: [
      { title: '古窑民俗博览区', text: '看非遗匠人现场制瓷，感受千年窑火。', image: '' },
      { title: '陶溪川', text: '老厂房改造的文创街区，夜晚灯火很有氛围。', image: '' },
      { title: '御窑厂', text: '明清皇家瓷厂遗址，博物馆里藏着历代瓷器精品。', image: '' } ] },
  { id: 'liuzhou', name: '柳州', enName: 'Liuzhou', province: '广西', emoji: '🍜', accent: '#ea580c',
    tagline: '螺蛳粉故乡+柳江山水，好吃又好玩', tags: ['美食', '自然', '休闲'],
    bestSeasons: ['春', '秋', '冬'], suggestDays: '2-3 天', climate: '亚热带季风气候，冬无严寒',
    cover: '', gallery: [], elderlyFriendly: '柳江夜游、公园平缓；螺蛳粉辣度可选不辣。',
    packingNote: '体验螺蛳粉备换洗衣物；山水景区备防滑鞋。',
    description: '柳州不止有螺蛳粉：百里柳江十里画廊、程阳八寨的侗族风雨桥，还有满城紫荆花，好吃好玩还便宜。',
    highlights: [
      { title: '螺蛳粉街', text: '来柳州必须来一碗正宗的，本地小店最地道。', image: '' },
      { title: '百里柳江', text: '乘船夜游柳江，看蟠龙山瀑布灯光秀。', image: '' },
      { title: '程阳八寨', text: '侗族风雨桥与鼓楼，山水田园间的民族风情。', image: '' } ] },
  { id: 'pingyao', name: '平遥', enName: 'Pingyao', province: '山西', emoji: '🏯', accent: '#92400e',
    tagline: '保存最完整的明清古城，穿越回晋商时代', tags: ['古城', '历史', '老人友好'],
    bestSeasons: ['春', '秋'], suggestDays: '2-3 天', climate: '温带大陆性气候，四季分明',
    cover: '', gallery: [], elderlyFriendly: '古城以平缓步行为主，可坐电瓶车代步；石板路注意防滑。',
    packingNote: '春秋带外套防风沙；古城步行多穿舒适鞋。',
    description: '平遥古城完整保留明清格局，城墙、票号、镖局、县衙一应俱全，仿佛时光倒流，适合带长辈怀旧、带孩子开眼界。',
    highlights: [
      { title: '平遥古城墙', text: '登墙俯瞰整座古城，黄昏时分最有味道。', image: '' },
      { title: '日升昌票号', text: '中国第一家票号，看晋商如何"汇通天下"。', image: '' },
      { title: '双林寺', text: '城外彩塑艺术宝库，两千余尊造像栩栩如生。', image: '' } ] },
  { id: 'huzhou', name: '湖州', enName: 'Huzhou', province: '浙江', emoji: '🎋', accent: '#65a30d',
    tagline: '南浔古镇与安吉竹海，江南的小众清静', tags: ['自然', '亲子', '休闲'],
    bestSeasons: ['春', '夏', '秋'], suggestDays: '2-3 天', climate: '亚热带季风气候，四季分明',
    cover: '', gallery: [], elderlyFriendly: '古镇平缓、竹海有接驳车，整体轻松。',
    packingNote: '夏季防晒防蚊；竹海山区备薄外套。',
    description: '相比乌镇西塘，南浔更清净；安吉的万顷竹海、莫干山的绿意，让湖州成为江南"避人潮"的宝藏地。',
    highlights: [
      { title: '南浔古镇', text: '中西合璧的江南水乡，人少景美，摇橹船慢游。', image: '' },
      { title: '安吉竹海', text: '《卧虎藏龙》取景地，竹海步道清凉洗肺。', image: '' },
      { title: '莫干山', text: '竹林民宿与山间绿道，亲子骑行正合适。', image: '' } ] },
  { id: 'leshan', name: '乐山', enName: 'Leshan', province: '四川', emoji: '🗿', accent: '#b91c1c',
    tagline: '乐山大佛与峨眉金顶，佛国山水', tags: ['历史', '自然', '老人友好'],
    bestSeasons: ['春', '秋'], suggestDays: '2-3 天', climate: '亚热带湿润气候，春秋最宜',
    cover: '', gallery: [], elderlyFriendly: '大佛有游船观景路线，免爬栈道；峨眉山可坐索道。',
    packingNote: '峨眉金顶海拔高备外套；登山防滑鞋、雨具。',
    description: '乐山大佛"佛是一座山"，游船远观最震撼；登峨眉金顶看云海日出，还有嘉阳小火车穿越油菜花田，一条线满足全家。',
    highlights: [
      { title: '乐山大佛', text: '乘船看大佛全貌最省力，气势震撼。', image: '' },
      { title: '峨眉山', text: '索道+金顶，云海日出美如仙境（注意高反与保暖）。', image: '' },
      { title: '嘉阳小火车', text: '蒸汽小火车穿越油菜花田，童趣满满。', image: '' } ] },
  { id: 'zhangzhou', name: '漳州', enName: 'Zhangzhou', province: '福建', emoji: '🏠', accent: '#a16207',
    tagline: '福建土楼与东山岛，客家文化与海岛风情', tags: ['古城', '海滨', '亲子'],
    bestSeasons: ['春', '秋', '冬'], suggestDays: '3 天', climate: '亚热带海洋性气候，冬暖夏凉',
    cover: '', gallery: [], elderlyFriendly: '土楼景区有观光车；海岛路况良好，节奏可慢。',
    packingNote: '海边防晒、泳衣按需；土楼景区备舒适鞋。',
    description: '漳州把《大鱼海棠》同款土楼群、马銮湾的碧海和骑楼老街装在一起，游客不多，很适合慢节奏家庭游。',
    highlights: [
      { title: '南靖土楼', text: '四菜一汤、云水谣，客家圆楼的震撼与温情。', image: '' },
      { title: '东山岛', text: '风动石、南门湾，海风与彩色渔村。', image: '' },
      { title: '漳州古城', text: '骑楼老街与闽南小吃，烟火气十足。', image: '' } ] },
  { id: 'beihai', name: '北海', enName: 'Beihai', province: '广西', emoji: '🏖️', accent: '#0891b2',
    tagline: '银滩+涠洲岛，人少景美的平价海滨', tags: ['海滨', '亲子', '休闲'],
    bestSeasons: ['春', '秋', '冬'], suggestDays: '3-4 天', climate: '亚热带海洋性气候，冬季温暖避寒',
    cover: '', gallery: [], elderlyFriendly: '银滩平缓、老街好逛，冬天带爸妈避寒很合适。',
    packingNote: '防晒、泳衣、沙滩鞋；上岛船程约1小时备晕船药。',
    description: '北海银滩"滩长平、沙细白"，冬季依然温暖；涠洲岛的火山地貌与玻璃海更是宝藏，性价比极高的海滨度假地。',
    highlights: [
      { title: '银滩', text: '平缓细腻的"天下第一滩"，挖沙玩水一整天。', image: '' },
      { title: '涠洲岛', text: '火山岩海岸与清澈海水，环岛看日出日落。', image: '' },
      { title: '北海老街', text: '百年骑楼老街，虾饼与糖水的老城味道。', image: '' } ] }
];

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
const existing = new Set(data.destinations.map((d) => d.id));
let added = 0;
for (const d of NEW) {
  if (existing.has(d.id)) continue;
  data.destinations.push(d);
  added++;
}
fs.writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
console.log('新增目的地: ' + added + ' 个，总数: ' + data.destinations.length);