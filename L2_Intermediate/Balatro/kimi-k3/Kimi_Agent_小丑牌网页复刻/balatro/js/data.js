/* ============ Balatro Web — 静态数据 ============ */
'use strict';

const SUITS = {
  S: { key:'S', name:'黑桃', sym:'♠', color:'#5c72c4' },
  H: { key:'H', name:'红桃', sym:'♥', color:'#ff5a6e' },
  C: { key:'C', name:'梅花', sym:'♣', color:'#43b66a' },
  D: { key:'D', name:'方块', sym:'♦', color:'#ff8c3a' },
};
const SUIT_ORDER = ['S','H','C','D'];
const RANK_NAMES = {2:'2',3:'3',4:'4',5:'5',6:'6',7:'7',8:'8',9:'9',10:'10',11:'J',12:'Q',13:'K',14:'A'};

// 牌型基础数值 + 每级成长 + 对应星球
const POKER_HANDS = {
  flush_five:   { name:'同花五条',   chips:160, mult:16, uC:50, uM:3, planet:'eris',    secret:true },
  flush_house:  { name:'同花葫芦',   chips:140, mult:14, uC:40, uM:4, planet:'ceres',   secret:true },
  five_kind:    { name:'五条',       chips:120, mult:12, uC:35, uM:3, planet:'planet_x',secret:true },
  royal_flush:  { name:'皇家同花顺', chips:100, mult:8,  uC:40, uM:4, planet:'neptune' },
  straight_flush:{name:'同花顺',     chips:100, mult:8,  uC:40, uM:4, planet:'neptune' },
  four_kind:    { name:'四条',       chips:60,  mult:7,  uC:30, uM:3, planet:'mars' },
  full_house:   { name:'葫芦',       chips:40,  mult:4,  uC:25, uM:2, planet:'earth' },
  flush:        { name:'同花',       chips:35,  mult:4,  uC:15, uM:2, planet:'jupiter' },
  straight:     { name:'顺子',       chips:30,  mult:4,  uC:30, uM:3, planet:'saturn' },
  three_kind:   { name:'三条',       chips:30,  mult:3,  uC:20, uM:2, planet:'venus' },
  two_pair:     { name:'两对',       chips:20,  mult:2,  uC:20, uM:1, planet:'uranus' },
  pair:         { name:'对子',       chips:10,  mult:2,  uC:15, uM:1, planet:'mercury' },
  high_card:    { name:'高牌',       chips:5,   mult:1,  uC:10, uM:1, planet:'pluto' },
};
const HAND_ORDER = ['flush_five','flush_house','five_kind','royal_flush','straight_flush','four_kind','full_house','flush','straight','three_kind','two_pair','pair','high_card'];

const PLANETS = {
  pluto:    { name:'冥王星', hand:'high_card',     color:'#b98aff' },
  mercury:  { name:'水星',   hand:'pair',          color:'#ffd34e' },
  uranus:   { name:'天王星', hand:'two_pair',      color:'#7ee8d8' },
  venus:    { name:'金星',   hand:'three_kind',    color:'#ffb3d9' },
  saturn:   { name:'土星',   hand:'straight',      color:'#ffe3a8' },
  jupiter:  { name:'木星',   hand:'flush',         color:'#ff9d5e' },
  earth:    { name:'地球',   hand:'full_house',    color:'#7ec8ff' },
  mars:     { name:'火星',   hand:'four_kind',     color:'#ff6a5e' },
  neptune:  { name:'海王星', hand:'straight_flush',color:'#5e8cff' },
  planet_x: { name:'X行星',  hand:'five_kind',     color:'#e85eff', secret:true },
  ceres:    { name:'谷神星', hand:'flush_house',   color:'#8affd9', secret:true },
  eris:     { name:'阋神星', hand:'flush_five',    color:'#ff8ab0', secret:true },
};

const TAROTS = {
  fool:      { name:'愚人',     desc:'复制本局上一次使用的塔罗或星球牌', need:0 },
  magician:  { name:'魔术师',   desc:'将最多 2 张选定牌增强为<b>幸运牌</b>', need:2, enh:'lucky' },
  empress:   { name:'女皇',     desc:'将最多 2 张选定牌增强为<b>倍率牌</b>', need:2, enh:'mult' },
  hierophant:{ name:'教皇',     desc:'将最多 2 张选定牌增强为<b>奖励牌</b>', need:2, enh:'bonus' },
  lovers:    { name:'恋人',     desc:'将 1 张选定牌增强为<b>万能牌</b>', need:1, enh:'wild' },
  chariot:   { name:'战车',     desc:'将 1 张选定牌增强为<b>钢铁牌</b>', need:1, enh:'steel' },
  justice:   { name:'正义',     desc:'将 1 张选定牌增强为<b>玻璃牌</b>', need:1, enh:'glass' },
  devil:     { name:'恶魔',     desc:'将 1 张选定牌增强为<b>黄金牌</b>', need:1, enh:'gold' },
  tower:     { name:'高塔',     desc:'将 1 张选定牌增强为<b>石头牌</b>', need:1, enh:'stone' },
  strength:  { name:'力量',     desc:'最多 2 张选定牌点数 +1', need:2 },
  death:     { name:'死神',     desc:'选择 2 张牌，<b>左</b>牌变为<b>右</b>牌的复制', need:2, exact:true },
  hanged:    { name:'倒吊人',   desc:'销毁最多 2 张选定牌', need:2 },
  sun:       { name:'太阳',     desc:'最多 3 张选定牌变为<b>红桃</b>', need:3, suit:'H' },
  moon:      { name:'月亮',     desc:'最多 3 张选定牌变为<b>梅花</b>', need:3, suit:'C' },
  star:      { name:'星星',     desc:'最多 3 张选定牌变为<b>方块</b>', need:3, suit:'D' },
  world:     { name:'世界',     desc:'最多 3 张选定牌变为<b>黑桃</b>', need:3, suit:'S' },
  wheel:     { name:'命运之轮', desc:'1/4 概率为随机一张小丑添加<b>闪卡版本</b>', need:0 },
  judgement: { name:'审判',     desc:'随机获得一张小丑牌', need:0 },
  priestess: { name:'女祭司',   desc:'获得最多 2 张随机星球牌', need:0 },
  emperor:   { name:'皇帝',     desc:'获得最多 2 张随机塔罗牌', need:0 },
  temperance:{ name:'节制',     desc:'获得等同于当前小丑出售价总和的金币(最多 $50)', need:0 },
  hermit:    { name:'隐者',     desc:'金币翻倍(最多 +$20)', need:0 },
};

// ---- 小丑定义: cost 售价, rarity, desc(中文) ----
const JOKERS = [
  { id:'joker',        name:'Joker',            zh:'小丑',       rarity:'common',   cost:4, desc:'<span class="red">+4</span> 倍率' },
  { id:'greedy',       name:'Greedy Joker',     zh:'贪婪小丑',   rarity:'common',   cost:4, desc:'每张计分的<b>方块</b>牌 <span class="red">+3</span> 倍率' },
  { id:'lusty',        name:'Lusty Joker',      zh:'好色小丑',   rarity:'common',   cost:4, desc:'每张计分的<b>红桃</b>牌 <span class="red">+3</span> 倍率' },
  { id:'wrathful',     name:'Wrathful Joker',   zh:'暴怒小丑',   rarity:'common',   cost:4, desc:'每张计分的<b>黑桃</b>牌 <span class="red">+3</span> 倍率' },
  { id:'gluttonous',   name:'Gluttonous Joker', zh:'暴食小丑',   rarity:'common',   cost:4, desc:'每张计分的<b>梅花</b>牌 <span class="red">+3</span> 倍率' },
  { id:'jolly',        name:'Jolly Joker',      zh:'快活小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>对子</b>，<span class="red">+8</span> 倍率' },
  { id:'zany',         name:'Zany Joker',       zh:'滑稽小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>三条</b>，<span class="red">+12</span> 倍率' },
  { id:'mad',          name:'Mad Joker',        zh:'疯狂小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>两对</b>，<span class="red">+10</span> 倍率' },
  { id:'crazy',        name:'Crazy Joker',      zh:'癫狂小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>顺子</b>，<span class="red">+12</span> 倍率' },
  { id:'droll',        name:'Droll Joker',      zh:'古怪小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>同花</b>，<span class="red">+10</span> 倍率' },
  { id:'sly',          name:'Sly Joker',        zh:'狡猾小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>对子</b>，<span class="blue">+50</span> 筹码' },
  { id:'wily',         name:'Wily Joker',       zh:'诡计小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>三条</b>，<span class="blue">+100</span> 筹码' },
  { id:'clever',       name:'Clever Joker',     zh:'机敏小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>两对</b>，<span class="blue">+80</span> 筹码' },
  { id:'devious',      name:'Devious Joker',    zh:'奸诈小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>顺子</b>，<span class="blue">+100</span> 筹码' },
  { id:'crafty',       name:'Crafty Joker',     zh:'灵巧小丑',   rarity:'common',   cost:4, desc:'若出牌包含<b>同花</b>，<span class="blue">+80</span> 筹码' },
  { id:'half',         name:'Half Joker',       zh:'半张小丑',   rarity:'common',   cost:4, desc:'若出牌不超过 <b>3</b> 张，<span class="red">+20</span> 倍率' },
  { id:'stencil',      name:'Joker Stencil',    zh:'镂空小丑',   rarity:'uncommon', cost:6, desc:'每个空的小丑槽位(含自身)给予 <span class="red">×1</span> 倍率' },
  { id:'four_fingers', name:'Four Fingers',     zh:'四指小丑',   rarity:'uncommon', cost:6, desc:'<b>顺子</b>和<b>同花</b>只需 4 张牌即可组成' },
  { id:'mime',         name:'Mime',             zh:'默剧小丑',   rarity:'uncommon', cost:6, desc:'重新触发所有<b>手牌保留</b>效果' },
  { id:'credit',       name:'Credit Card',      zh:'信用卡',     rarity:'common',   cost:3, desc:'允许透支至 <span class="gold">-$20</span>' },
  { id:'banner',       name:'Banner',           zh:'旗帜',       rarity:'common',   cost:4, desc:'每个剩余弃牌次数 <span class="blue">+30</span> 筹码' },
  { id:'summit',       name:'Mystic Summit',    zh:'神秘之巅',   rarity:'uncommon', cost:6, desc:'弃牌次数为 <b>0</b> 时，<span class="red">+15</span> 倍率' },
  { id:'loyalty',      name:'Loyalty Card',     zh:'忠诚卡',     rarity:'uncommon', cost:6, desc:'每打出的第 <b>6</b> 手牌 <span class="red">×4</span> 倍率' },
  { id:'eight_ball',   name:'8 Ball',           zh:'8号球',      rarity:'common',   cost:4, desc:'每张子牌 8 计分时有 <b>1/4</b> 概率获得塔罗牌' },
  { id:'misprint',     name:'Misprint',         zh:'错版小丑',   rarity:'common',   cost:4, desc:'随机 <span class="red">+0~23</span> 倍率' },
  { id:'raised_fist',  name:'Raised Fist',      zh:'高举之拳',   rarity:'common',   cost:4, desc:'将手中<b>最小</b>牌点数的 2 倍加入倍率' },
  { id:'chaos',        name:'Chaos the Clown',  zh:'混沌小丑',   rarity:'common',   cost:4, desc:'每次商店可免费<b>刷新 1 次</b>' },
  { id:'fibonacci',    name:'Fibonacci',        zh:'斐波那契',   rarity:'uncommon', cost:6, desc:'每张计分的 A/2/3/5/8 <span class="red">+8</span> 倍率' },
  { id:'steel_joker',  name:'Steel Joker',      zh:'钢铁小丑',   rarity:'uncommon', cost:6, desc:'牌组中每张<b>钢铁牌</b>给予 <span class="red">×0.2</span> 倍率' },
  { id:'scary',        name:'Scary Face',       zh:'鬼脸小丑',   rarity:'common',   cost:4, desc:'每张计分的<b>人头牌</b> <span class="blue">+30</span> 筹码' },
  { id:'abstract',     name:'Abstract Joker',   zh:'抽象小丑',   rarity:'common',   cost:4, desc:'每张小丑牌 <span class="red">+3</span> 倍率' },
  { id:'delayed',      name:'Delayed Gratification', zh:'延迟满足', rarity:'common', cost:4, desc:'回合结束每剩 1 次弃牌 <span class="gold">+$2</span>(本回合未弃牌时)' },
  { id:'gros_michel',  name:'Gros Michel',      zh:'大麦克香蕉', rarity:'common',   cost:4, desc:'<span class="red">+15</span> 倍率，每回合结束 <b>1/6</b> 概率损毁' },
  { id:'even_steven',  name:'Even Steven',      zh:'偶数史蒂文', rarity:'common',   cost:4, desc:'每张计分的<b>偶数</b>牌 <span class="red">+4</span> 倍率' },
  { id:'odd_todd',     name:'Odd Todd',         zh:'奇数托德',   rarity:'common',   cost:4, desc:'每张计分的<b>奇数</b>牌 <span class="blue">+31</span> 筹码' },
  { id:'scholar',      name:'Scholar',          zh:'学者',       rarity:'common',   cost:4, desc:'每张计分的 A：<span class="blue">+20</span> 筹码 <span class="red">+4</span> 倍率' },
  { id:'business',     name:'Business Card',    zh:'名片',       rarity:'common',   cost:4, desc:'每张计分的<b>人头牌</b>有 <b>1/2</b> 概率 <span class="gold">+$2</span>' },
  { id:'egg',          name:'Egg',              zh:'鸡蛋',       rarity:'common',   cost:4, desc:'每回合结束出售价 <span class="gold">+$3</span>' },
  { id:'ice_cream',    name:'Ice Cream',        zh:'冰淇淋',     rarity:'common',   cost:4, desc:'<span class="blue">+100</span> 筹码，每打出 1 手牌 <span class="blue">-5</span> 筹码' },
  { id:'cavendish',    name:'Cavendish',        zh:'卡文迪什香蕉', rarity:'rare',   cost:9, desc:'<span class="red">×3</span> 倍率，每回合结束 <b>1/1000</b> 概率损毁' },
  { id:'dna',          name:'DNA',              zh:'DNA',        rarity:'rare',     cost:8, desc:'若回合<b>第一手牌</b>仅 1 张，永久复制该牌入牌组' },
  { id:'splash',       name:'Splash',           zh:'水花',       rarity:'common',   cost:4, desc:'所有<b>打出</b>的牌都参与计分' },
  { id:'blue_joker',   name:'Blue Joker',       zh:'蓝色小丑',   rarity:'common',   cost:4, desc:'抽牌堆每剩 1 张牌 <span class="blue">+2</span> 筹码' },
  { id:'hiker',        name:'Hiker',            zh:'远足者',     rarity:'uncommon', cost:6, desc:'每张打出的牌永久 <span class="blue">+5</span> 筹码' },
  { id:'photograph',   name:'Photograph',       zh:'照片',       rarity:'common',   cost:4, desc:'每张出牌中首张计分的<b>人头牌</b> <span class="red">×2</span> 倍率' },
  { id:'smiley',       name:'Smiley Face',      zh:'笑脸',       rarity:'common',   cost:4, desc:'每张计分的<b>人头牌</b> <span class="red">+5</span> 倍率' },
  { id:'golden',       name:'Golden Joker',     zh:'黄金小丑',   rarity:'common',   cost:5, desc:'回合结束 <span class="gold">+$4</span>' },
  { id:'baseball',     name:'Baseball Card',    zh:'棒球卡',     rarity:'rare',     cost:8, desc:'每张<b>罕见</b>小丑触发时额外 <span class="red">×1.5</span> 倍率' },
  { id:'bull',         name:'Bull',             zh:'公牛',       rarity:'uncommon', cost:6, desc:'每持有 <span class="gold">$1</span> <span class="blue">+2</span> 筹码' },
  { id:'popcorn',      name:'Popcorn',          zh:'爆米花',     rarity:'common',   cost:4, desc:'<span class="red">+20</span> 倍率，每回合结束 <span class="red">-4</span>' },
  { id:'ramen',        name:'Ramen',            zh:'拉面',       rarity:'uncommon', cost:6, desc:'<span class="red">×2</span> 倍率，每弃 1 张牌 <span class="red">-×0.01</span>' },
  { id:'seltzer',      name:'Seltzer',          zh:'苏打水',     rarity:'uncommon', cost:6, desc:'接下来 <b>10</b> 手牌，所有出牌重新触发' },
  { id:'castle',       name:'Castle',           zh:'城堡',       rarity:'uncommon', cost:6, desc:'每弃 1 张<b>指定花色</b>的牌 <span class="blue">+3</span> 筹码(花色轮换)' },
  { id:'mrbones',      name:'Mr. Bones',        zh:'白骨先生',   rarity:'uncommon', cost:6, desc:'若得分达到目标 <b>25%</b>，免死一次(自身损毁)' },
  { id:'shoot_moon',   name:'Shoot the Moon',   zh:'射月',       rarity:'common',   cost:5, desc:'手中每张 Q <span class="red">+13</span> 倍率' },
  { id:'baron',        name:'Baron',            zh:'男爵',       rarity:'rare',     cost:8, desc:'手中每张 K <span class="red">×1.5</span> 倍率' },
  { id:'luchador',     name:'Luchador',         zh:'摔跤手',     rarity:'uncommon', cost:6, desc:'出售此牌可<b>解除</b>当前 Boss 盲注效果' },
  { id:'juggler',      name:'Juggler',          zh:'杂耍艺人',   rarity:'common',   cost:4, desc:'手牌上限 <span class="blue">+1</span>' },
  { id:'drunkard',     name:'Drunkard',         zh:'酒鬼',       rarity:'common',   cost:4, desc:'弃牌次数 <span class="red">+1</span>' },
  { id:'acrobat',      name:'Acrobat',          zh:'杂技演员',   rarity:'uncommon', cost:6, desc:'本回合<b>最后一手牌</b> <span class="red">×3</span> 倍率' },
  { id:'sock',         name:'Sock and Buskin',  zh:'悲喜袜',     rarity:'uncommon', cost:6, desc:'重新触发所有计分的<b>人头牌</b>' },
  { id:'swashbuckler', name:'Swashbuckler',     zh:'剑客',       rarity:'common',   cost:4, desc:'将其他小丑的出售价总和加入倍率' },
  { id:'troubadour',   name:'Troubadour',       zh:'吟游诗人',   rarity:'uncommon', cost:6, desc:'手牌上限 <span class="blue">+2</span>，出牌次数 <span class="red">-1</span>' },
  { id:'certificate',  name:'Certificate',      zh:'证书',       rarity:'uncommon', cost:6, desc:'每回合开始将 1 张随机<b>增强牌</b>加入手牌' },
  { id:'hologram',     name:'Hologram',         zh:'全息影像',   rarity:'uncommon', cost:6, desc:'牌组每增加过 1 张牌 <span class="red">×0.25</span> 倍率' },
  { id:'vagabond',     name:'Vagabond',         zh:'流浪者',     rarity:'rare',     cost:8, desc:'出牌时金币不超过 <span class="gold">$4</span> 则获得塔罗牌' },
  { id:'throwback',    name:'Throwback',        zh:'怀旧小丑',   rarity:'uncommon', cost:6, desc:'每跳过 1 次盲注 <span class="red">×0.25</span> 倍率' },
  { id:'vampire',      name:'Vampire',          zh:'吸血鬼',     rarity:'uncommon', cost:6, desc:'每张计分的<b>增强牌</b>被吞噬，<span class="red">×0.1</span> 倍率(永久成长)' },
  { id:'midas',        name:'Midas Mask',       zh:'迈达斯面具', rarity:'uncommon', cost:6, desc:'每张计分的<b>人头牌</b>变为<b>黄金牌</b>' },
  { id:'seeing_double',name:'Seeing Double',    zh:'重影',       rarity:'uncommon', cost:6, desc:'若出牌含<b>梅花</b>及其他花色，<span class="red">×2</span> 倍率' },
  { id:'duo',          name:'The Duo',          zh:'双子',       rarity:'rare',     cost:8, desc:'若出牌包含<b>对子</b>，<span class="red">×2</span> 倍率' },
  { id:'trio',         name:'The Trio',         zh:'三重奏',     rarity:'rare',     cost:8, desc:'若出牌包含<b>三条</b>，<span class="red">×3</span> 倍率' },
  { id:'family',       name:'The Family',       zh:'家族',       rarity:'rare',     cost:8, desc:'若出牌包含<b>四条</b>，<span class="red">×4</span> 倍率' },
  { id:'order',        name:'The Order',        zh:'秩序',       rarity:'rare',     cost:8, desc:'若出牌包含<b>顺子</b>，<span class="red">×3</span> 倍率' },
  { id:'tribe',        name:'The Tribe',        zh:'部落',       rarity:'rare',     cost:8, desc:'若出牌包含<b>同花</b>，<span class="red">×2</span> 倍率' },
  { id:'drivers',      name:"Driver's License", zh:'驾照',       rarity:'rare',     cost:8, desc:'牌组中增强牌 ≥16 张时 <span class="red">×3</span> 倍率' },
  { id:'burnt',        name:'Burnt Joker',      zh:'烧焦小丑',   rarity:'rare',     cost:8, desc:'每回合<b>首次弃牌</b>的牌型升级 1 级' },
  { id:'constellation',name:'Constellation',    zh:'星座',       rarity:'uncommon', cost:6, desc:'本局每使用过 1 张星球牌 <span class="red">×0.1</span> 倍率' },
  { id:'rocket',       name:'Rocket',           zh:'火箭',       rarity:'uncommon', cost:6, desc:'回合结束 <span class="gold">+$1</span>，击败 Boss 后收益 <span class="gold">+$2</span>' },
  { id:'rough_gem',    name:'Rough Gem',        zh:'原矿宝石',   rarity:'uncommon', cost:6, desc:'每张计分的<b>方块</b>牌 <span class="gold">+$1</span>' },
  { id:'bloodstone',   name:'Bloodstone',       zh:'血石',       rarity:'uncommon', cost:6, desc:'每张计分的<b>红桃</b>牌有 <b>1/2</b> 概率 <span class="red">×1.5</span> 倍率' },
  { id:'arrowhead',    name:'Arrowhead',        zh:'箭头',       rarity:'uncommon', cost:6, desc:'每张计分的<b>梅花</b>牌 <span class="blue">+50</span> 筹码' },
  { id:'onyx',         name:'Onyx Agate',       zh:'缟玛瑙',     rarity:'uncommon', cost:6, desc:'每张计分的<b>梅花</b>牌 <span class="red">+7</span> 倍率' },
  { id:'glass_joker',  name:'Glass Joker',      zh:'玻璃小丑',   rarity:'uncommon', cost:6, desc:'每碎过 1 张玻璃牌 <span class="red">×0.75</span> 倍率' },
  { id:'stuntman',     name:'Stuntman',         zh:'特技演员',   rarity:'rare',     cost:8, desc:'<span class="blue">+250</span> 筹码，手牌上限 <span class="blue">-2</span>' },
  { id:'bootstraps',   name:'Bootstraps',       zh:'白手起家',   rarity:'uncommon', cost:6, desc:'每持有 <span class="gold">$5</span> <span class="red">+2</span> 倍率' },
  { id:'flash',        name:'Flash Card',       zh:'抽认卡',     rarity:'uncommon', cost:5, desc:'本局每刷新 1 次商店 <span class="red">+2</span> 倍率' },
  { id:'green_joker',  name:'Green Joker',      zh:'绿色小丑',   rarity:'common',   cost:4, desc:'每打出 1 手牌 <span class="red">+1</span> 倍率，每弃 1 次牌 <span class="red">-1</span>' },
  { id:'supernova',    name:'Supernova',        zh:'超新星',     rarity:'common',   cost:4, desc:'本局该牌型每打出过 1 次 <span class="red">+1</span> 倍率' },
  { id:'ride_bus',     name:'Ride the Bus',     zh:'搭公车',     rarity:'common',   cost:4, desc:'连续打出不含人头牌计分的手牌，每手 <span class="red">+1</span> 倍率' },
  { id:'runner',       name:'Runner',           zh:'跑者',       rarity:'common',   cost:4, desc:'若出牌包含<b>顺子</b>，永久 <span class="blue">+15</span> 筹码' },
  { id:'ancient',      name:'Ancient Joker',    zh:'远古小丑',   rarity:'rare',     cost:8, desc:'每张计分的<b>轮换花色</b>牌 <span class="red">×1.5</span> 倍率' },
  { id:'hack',         name:'Hack',             zh:'骇客',       rarity:'uncommon', cost:6, desc:'重新触发所有计分的 <b>2/3/4/5</b>' },
  { id:'dusk',         name:'Dusk',             zh:'黄昏',       rarity:'uncommon', cost:6, desc:'本回合<b>最后一手牌</b>的所有出牌重新触发' },
  { id:'square',       name:'Square Joker',     zh:'方块小丑',   rarity:'common',   cost:4, desc:'若出牌恰好 <b>4</b> 张，永久 <span class="blue">+4</span> 筹码' },
  { id:'fortune',      name:'Fortune Teller',   zh:'占卜师',     rarity:'common',   cost:5, desc:'本局每使用过 1 张塔罗牌 <span class="red">+1</span> 倍率' },
];
const JOKER_MAP = Object.fromEntries(JOKERS.map(j => [j.id, j]));
const RARITY_NAME = { common:'普通', uncommon:'罕见', rare:'稀有', legendary:'传奇' };
const RARITY_W = { common:70, uncommon:25, rare:5 };

const ENH_NAMES = { bonus:'奖励牌', mult:'倍率牌', wild:'万能牌', glass:'玻璃牌', steel:'钢铁牌', stone:'石头牌', gold:'黄金牌', lucky:'幸运牌' };
const EDITION_NAMES = { foil:'闪箔', holo:'镭射', poly:'多彩' };
const SEAL_NAMES = { red:'红蜡封', gold:'金蜡封', blue:'蓝蜡封', purple:'紫蜡封' };

// ---- Boss 盲注 ----
const BOSSES = [
  { id:'hook',    name:'钩爪',   mult:2, desc:'每打出一手牌后随机弃掉 2 张手牌' },
  { id:'club',    name:'梅花',   mult:2, desc:'所有梅花牌被削弱' },
  { id:'goad',    name:'刺棒',   mult:2, desc:'所有黑桃牌被削弱' },
  { id:'head',    name:'头颅',   mult:2, desc:'所有红桃牌被削弱' },
  { id:'window',  name:'窗户',   mult:2, desc:'所有方块牌被削弱' },
  { id:'plant',   name:'植物',   mult:2, desc:'所有人头牌被削弱' },
  { id:'wall',    name:'高墙',   mult:4, desc:'更高的目标分数' },
  { id:'needle',  name:'钢针',   mult:1, desc:'只能打出 1 手牌' },
  { id:'psychic', name:'灵媒',   mult:2, desc:'必须打出恰好 5 张牌' },
  { id:'mouth',   name:'巨口',   mult:2, desc:'本回合只能打出一种牌型' },
  { id:'eye',     name:'魔眼',   mult:2, desc:'本回合不能重复打出相同牌型' },
  { id:'tooth',   name:'利齿',   mult:2, desc:'每打出 1 张牌失去 $1' },
  { id:'flint',   name:'燧石',   mult:2, desc:'基础筹码与倍率减半' },
  { id:'water',   name:'深水',   mult:2, desc:'没有弃牌次数' },
  { id:'manacle', name:'镣铐',   mult:2, desc:'手牌上限 -1' },
  { id:'serpent', name:'巨蟒',   mult:2, desc:'出牌或弃牌后只能补到 3 张牌' },
  { id:'pillar',  name:'石柱',   mult:2, desc:'本底注中打出过的牌被削弱' },
  { id:'ox',      name:'公牛',   mult:2, desc:'打出你最常用的牌型会将金币清零' },
  { id:'heart',   name:'绯红之心', mult:2, desc:'每手牌随机削弱一张小丑' },
];
const BOSS_MAP = Object.fromEntries(BOSSES.map(b => [b.id, b]));

const ANTE_BASE = [0,300,800,2000,5000,11000,20000,35000,50000,60000,110000,160000,250000,400000];

const DECKS = [
  { id:'red',      name:'红色牌组', color:'#d64550', desc:'弃牌次数 +1' },
  { id:'blue',     name:'蓝色牌组', color:'#3f7fd6', desc:'出牌次数 +1' },
  { id:'yellow',   name:'黄色牌组', color:'#e0a83f', desc:'开局金币 +$10' },
  { id:'green',    name:'绿色牌组', color:'#3fae7c', desc:'无利息；每剩余出牌/弃牌次数 +$2' },
  { id:'black',    name:'黑色牌组', color:'#4a4a5a', desc:'小丑槽位 +1，出牌次数 -1' },
  { id:'painted',  name:'彩绘牌组', color:'#b06ee8', desc:'手牌上限 +2，小丑槽位 -1' },
  { id:'abandoned',name:'遗弃牌组', color:'#8a7a5a', desc:'牌组中没有人头牌(40 张)' },
  { id:'checkered',name:'棋盘牌组', color:'#5a8a9a', desc:'26 张黑桃 + 26 张红桃' },
  { id:'erratic',  name:'混沌牌组', color:'#c06a3f', desc:'所有牌的点数与花色完全随机' },
  { id:'plasma',   name:'等离子牌组', color:'#6ee0d8', desc:'计分时筹码与倍率先取平均再相乘；盲注目标 ×2' },
];

const VOUCHERS = [
  { id:'overstock',  name:'囤货',     cost:10, ico:'🃏', desc:'商店卡牌槽位 +1' },
  { id:'clearance',  name:'清仓甩卖', cost:10, ico:'🏷️', desc:'商店所有商品 75 折' },
  { id:'grabber',    name:'攫取者',   cost:10, ico:'✋', desc:'每回合出牌次数 +1' },
  { id:'wasteful',   name:'挥霍',     cost:10, ico:'🗑️', desc:'每回合弃牌次数 +1' },
  { id:'paintbrush', name:'画笔',     cost:10, ico:'🖌️', desc:'手牌上限 +1' },
  { id:'reroll',     name:'刷新盈余', cost:10, ico:'🔄', desc:'商店刷新费用 -$2' },
  { id:'seedmoney',  name:'种子资金', cost:10, ico:'🌱', desc:'利息上限提高到 $10' },
  { id:'telescope',  name:'望远镜',   cost:10, ico:'🔭', desc:'天体补充包必含你最常用牌型的星球' },
  { id:'blank',      name:'空白',     cost:10, ico:'⬜', desc:'……什么都没有？' },
];

const TAGS = [
  { id:'economy',   name:'经济标签',   desc:'立即获得你金币一半的金币(最多 $40)' },
  { id:'handy',     name:'巧手标签',   desc:'本局每打出过 1 手牌，获得 $1' },
  { id:'garbage',   name:'垃圾标签',   desc:'本局每使用过 1 次弃牌，获得 $1' },
  { id:'investment',name:'投资标签',   desc:'击败下一个 Boss 盲注后获得 $25' },
  { id:'orbital',   name:'轨道标签',   desc:'随机 3 种牌型升级 1 级' },
  { id:'boss',      name:'Boss标签',   desc:'重新随机 Boss 盲注' },
  { id:'rare',      name:'稀有标签',   desc:'下一个商店必出稀有丑且半价' },
  { id:'juggle',    name:'杂耍标签',   desc:'下一回合手牌上限 +3' },
];

const SHOP_PRICES = { tarot:3, planet:3, jokerCommon:4, jokerUncommon:6, jokerRare:8, pack:4, megaPack:8 };
const PACKS = [
  { id:'buffoon',  name:'丑角补充包', cost:4, kind:'joker',  n:2, pick:1, color:'#d64550' },
  { id:'buffoon_m',name:'超级丑角包', cost:8, kind:'joker',  n:4, pick:2, color:'#a02838' },
  { id:'arcana',   name:'秘术补充包', cost:4, kind:'tarot',  n:3, pick:1, color:'#a06ee8' },
  { id:'celestial',name:'天体补充包', cost:4, kind:'planet', n:3, pick:1, color:'#4fc3ff' },
  { id:'standard', name:'标准补充包', cost:4, kind:'card',   n:3, pick:1, color:'#5b7fa6' },
];
