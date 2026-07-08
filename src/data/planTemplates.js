import goodnightSheep from '../../assets/stickers/cute-energy/illustrations_clean/07_goodnight_sheep.png';
import healingCat from '../../assets/stickers/cute-energy/illustrations_clean/11_healing_cat.png';
import cheerRabbit from '../../assets/stickers/cute-energy/illustrations_clean/10_cheer_rabbit.png';
import foodCat from '../../assets/stickers/cat-companion/illustrations_clean/04_sunflower_teddy_cat.png';
import umbrellaCat from '../../assets/stickers/cat-companion/illustrations_clean/09_kimono_umbrella_cat.png';
import okBear from '../../assets/stickers/cute-energy/illustrations_clean/22_ok_bear.png';

export const planCategories = ['全部', '夜班后', '白班日', '很累', '休息日', '健身房', '速食便利店'];

export const planTemplates = [
  {
    title: '夜班后恢复日',
    category: '夜班后',
    meta: '30分钟 / 低压力 / 易消化',
    text: '先让身体慢慢回到舒服状态，做一点轻力量就很棒啦',
    tags: ['先恢复', '轻一点', '睡前友好'],
    sticker: goodnightSheep,
    state: { time: '30分钟', status: '夜班后', condition: '健身房' },
    detailSteps: [
      {
        num: '01',
        title: '先准备，慢慢醒一醒',
        text: '进健身房后先慢慢走 5 分钟，不用出汗。感觉身体从「夜班模式」切换过来，就可以开始啦。',
        icon: 'moon',
        tone: 'lavender',
      },
      {
        num: '02',
        title: '今天主要做这些',
        text: '找你能稳稳坐住的器械，下拉、坐姿划船、腿举各做 2 组。重量选「还能再做 2 次」的程度，不要和别人比。',
        icon: 'dumbbell',
        tone: 'mint',
      },
      {
        num: '03',
        title: '收尾 + 怎么吃',
        text: '拉伸胸背和髋部 5 分钟，像给身体说晚安。练后吃小份恢复餐：鸡蛋 + 豆浆 + 饭团，吃到七分饱再睡。',
        icon: 'heart',
        tone: 'pink',
      },
    ],
    foodTips: {
      combos: ['鸡蛋 + 豆浆 + 小份饭团', '酸奶 + 香蕉 + 茶叶蛋', '即食鸡胸 + 关东煮蛋白 + 小份主食'],
      storePick: ['茶叶蛋', '无糖酸奶', '饭团', '豆浆', '香蕉或苹果'],
      note: '夜班后不要空腹睡，先垫一点温和的，胃会舒服很多。少油、少辣、少甜就好。',
    },
    friendlyReminder: [
      '今天不用做得很猛，做完一点点就已经在照顾自己了。',
      '累的时候先恢复，不需要补偿式加练。',
      '如果头晕、胸闷、想吐，今天就直接停，休息也是计划的一部分。',
    ],
  },
  {
    title: '很累也能做',
    category: '很累',
    meta: '15分钟 / 最低线',
    text: '今天目标很小：活动一下、吃点好的、早点休息',
    tags: ['小目标', '可跳过力量', '早点睡'],
    sticker: healingCat,
    state: { time: '15分钟', status: '很累', condition: '家里' },
    detailSteps: [
      {
        num: '01',
        title: '先松一松，不用换装备',
        text: '坐在床边或垫子上，肩颈绕环 2 分钟。先把僵住的地方松开，今天不追求出汗。',
        icon: 'sparkles',
        tone: 'lavender',
      },
      {
        num: '02',
        title: '今天做一点点就够',
        text: '靠墙深蹲 2 组、每组 8–10 次；死虫 2 组、每组 8 次。动作慢、呼吸顺，感觉累就减次数。',
        icon: 'home',
        tone: 'mint',
      },
      {
        num: '03',
        title: '不舒服就停 + 补一点吃的',
        text: '如果头晕、胸闷、想吐，今天就到这里。停下来后喝温水，吃酸奶、鸡蛋或香蕉垫一下。',
        icon: 'shield',
        tone: 'pink',
      },
    ],
    foodTips: {
      combos: ['酸奶 + 香蕉', '鸡蛋 + 豆浆', '饭团 + 茶叶蛋 + 温水'],
      storePick: ['无糖酸奶', '香蕉', '茶叶蛋', '饭团', '豆浆'],
      note: '先吃一点温和的东西，别让胃空太久。咖啡不是不行，但别拿它硬顶疲劳。',
    },
    friendlyReminder: [
      '今天不用追求消耗，动一动就算赢。',
      '没完成也没关系，记录下来明天会自动降级一点。',
      '能坚持打开 App，就已经不是从零开始了。',
    ],
  },
  {
    title: '健身房标准日',
    category: '健身房',
    meta: '45分钟 / 轻塑形',
    text: '把器械拆成几步走，照着顺序来，不用怕不会用',
    tags: ['器械入门', '慢节奏', '新手友好'],
    sticker: cheerRabbit,
    state: { time: '45分钟', status: '白班', condition: '健身房' },
    detailSteps: [
      {
        num: '01',
        title: '先热身，走进器械区',
        text: '跑步机慢走或椭圆机 8 分钟，感觉身体暖起来就行。不用跑，今天目标是动作舒服、顺序清楚。',
        icon: 'sun',
        tone: 'lavender',
      },
      {
        num: '02',
        title: '按顺序做 3 个动作',
        text: '高位下拉 3 组：把手肘往身体两侧拉，肩膀别耸。坐姿划船 3 组：胸口挺一点。腿举 3 组：脚踩稳，膝盖跟脚尖同方向。',
        icon: 'dumbbell',
        tone: 'mint',
      },
      {
        num: '03',
        title: '拉伸收尾 + 练后补一点',
        text: '拉伸 7 分钟，给今天收个漂亮尾。练后 30 分钟内吃点蛋白质 + 主食，比如鸡胸 + 米饭，身体会更有安全感。',
        icon: 'utensils',
        tone: 'pink',
      },
    ],
    foodTips: {
      combos: ['鸡胸 / 鱼虾 + 米饭或面条 + 一份蔬菜', '牛奶 + 全麦面包 + 鸡蛋', '训练前：香蕉或一小份饭团垫一下'],
      storePick: ['即食鸡胸', '茶叶蛋', '饭团', '无糖酸奶', '香蕉'],
      note: '训练前后别空太久，吃了才有力气练。重量先轻一点，动作顺了再加，这很聪明。',
    },
    friendlyReminder: [
      '不要和别人比重量，今天只要动作舒服就好。',
      '如果动作变形，就降一点重量，不丢人。',
      '练完吃点东西、喝点水，身体会觉得被照顾到。',
    ],
  },
  {
    title: '速食便利店',
    category: '速食便利店',
    meta: '饮食参考 / 夜班友好',
    text: '没法做饭也没关系，便利店也能吃得像样又好吃',
    tags: ['即食', '高蛋白', '好买'],
    sticker: foodCat,
    state: { time: '30分钟', status: '夜班后', condition: '速食便利店' },
    detailSteps: [
      {
        num: '01',
        title: '今天以「吃稳一点」为主',
        text: '没法做饭也没关系，先去便利店把蛋白质买到。今天主线是把胃照顾舒服，训练可以只做轻走。',
        icon: 'shopping',
        tone: 'lavender',
      },
      {
        num: '02',
        title: '饭后轻轻走一走',
        text: '吃完后散步 10–20 分钟，不用快，帮助身体缓一缓。走不动就在店里附近慢慢晃一圈也行。',
        icon: 'sparkles',
        tone: 'mint',
      },
      {
        num: '03',
        title: '肩颈拉伸 + 准备休息',
        text: '肩颈拉伸 5 分钟，结束就可以休息啦。睡前吃到七分饱，别撑到睡不着。',
        icon: 'heart',
        tone: 'pink',
      },
    ],
    foodTips: {
      combos: ['茶叶蛋 + 饭团 + 无糖酸奶', '豆浆 + 香蕉 + 即食鸡胸', '关东煮蛋白类 + 小份主食 + 水果'],
      storePick: ['茶叶蛋', '无糖酸奶', '饭团', '豆浆', '即食鸡胸', '香蕉或苹果'],
      note: '想喝甜的也可以，但先把蛋白质吃到会更稳。泡面炸鸡偶尔没关系，别把它当夜班恢复餐主线。',
    },
    friendlyReminder: [
      '便利店也能吃得像样，你已经很会照顾自己了。',
      '夜班后不要空腹睡，吃到七分饱就好。',
      '今天不用加练，吃稳 + 走一走就已经很棒。',
    ],
  },
  {
    title: '休息日轻塑形',
    category: '休息日',
    meta: '30分钟 / 不焦虑',
    text: '在家轻轻动一下，保持节奏就很可爱了',
    tags: ['居家', '轻强度', '慢慢来'],
    sticker: umbrellaCat,
    state: { time: '30分钟', status: '休息日', condition: '家里' },
    detailSteps: [
      {
        num: '01',
        title: '在家热身，不用换鞋',
        text: '原地踏步或开合步 5 分钟，感觉身体暖起来就好。休息日也可以轻轻动一下，不用躺一整天。',
        icon: 'home',
        tone: 'lavender',
      },
      {
        num: '02',
        title: '轻动作，不跳跃',
        text: '臀桥 3 组、深蹲 2 组、平板支撑 2 组。膝盖跟脚尖同方向，撑不住就缩短时间，今天不追求累。',
        icon: 'dumbbell',
        tone: 'mint',
      },
      {
        num: '03',
        title: '拉伸收尾 + 正常吃饭',
        text: '拉伸 8 分钟，慢慢收尾。正常吃蛋白质 + 主食 + 蔬果，不用故意少吃，精神会稳很多。',
        icon: 'utensils',
        tone: 'pink',
      },
    ],
    foodTips: {
      combos: ['鸡蛋 + 米饭 + 一份蔬菜', '酸奶 + 水果 + 小份坚果', '即食鸡胸 + 饭团 + 温水'],
      storePick: ['鸡蛋', '酸奶', '饭团', '即食鸡胸', '香蕉'],
      note: '主食不用全砍，吃一点精神会好。晚上想吃零食时，先喝水或吃酸奶缓一下。',
    },
    friendlyReminder: [
      '休息日轻轻动一下，保持节奏就很可爱了。',
      '不用和别人比强度，今天舒服最重要。',
      '睡前吃太撑会影响休息，留一点舒服感就好。',
    ],
  },
  {
    title: '白班下班后',
    category: '白班日',
    meta: '30分钟 / 标准日',
    text: '下班后不用想太多，按这个顺序做就好',
    tags: ['稳定', '可持续', '省心版'],
    sticker: okBear,
    state: { time: '30分钟', status: '白班', condition: '家里' },
    detailSteps: [
      {
        num: '01',
        title: '先吃点，再开始',
        text: '下班后可以先吃正餐再练，这很正常。如果空腹练会心慌，先垫香蕉或饭团，身体会更有安全感。',
        icon: 'utensils',
        tone: 'lavender',
      },
      {
        num: '02',
        title: '按顺序做 4 个动作',
        text: '热身 5 分钟后：深蹲 3 组、臀桥 3 组、俯身划船 2 组。慢慢蹲、慢慢起，今天只要动作顺就好。',
        icon: 'dumbbell',
        tone: 'mint',
      },
      {
        num: '03',
        title: '拉伸 + 补水收尾',
        text: '拉伸 5 分钟，给今天收个漂亮尾。练后补蛋白质和温水，别用熬夜换训练，睡觉也是计划的一部分。',
        icon: 'heart',
        tone: 'pink',
      },
    ],
    foodTips: {
      combos: ['下班正餐：鸡胸 / 鱼 + 米饭 + 蔬菜', '练前垫：香蕉或饭团', '练后：酸奶 + 茶叶蛋 + 温水'],
      storePick: ['即食鸡胸', '茶叶蛋', '饭团', '无糖酸奶', '香蕉'],
      note: '久坐太久就起来走两分钟，不用一次做很多。想吃东西时先吃正餐，暴食概率会低很多。',
    },
    friendlyReminder: [
      '下班后不用想太多，照着顺序做就好。',
      '今天做到一点点，明天继续就会越来越顺。',
      '别用熬夜换训练，休息好也是你在认真照顾自己。',
    ],
  },
];
