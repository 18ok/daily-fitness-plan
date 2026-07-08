export const quoteLibrary = [
  {
    id: 'general_slow_001',
    scene: '今日推荐',
    mood: '日常',
    text: '今天不用一下子变厉害，慢慢做完一点点，也是在认真照顾自己呀。',
  },
  {
    id: 'night_shift_001',
    scene: '夜班后',
    mood: '疲劳',
    text: '夜班后先让身体回到舒服状态。吃一点、洗个澡、好好睡，今天已经很辛苦啦。',
  },
  {
    id: 'night_shift_002',
    scene: '夜班后',
    mood: '恢复',
    text: '下夜班不用急着证明自己。先把胃和睡眠照顾好，训练可以轻轻来。',
  },
  {
    id: 'training_start_001',
    scene: '训练前',
    mood: '没动力',
    text: '不用练到很累，今天只要开始热身，就已经比躺着焦虑强很多啦。',
  },
  {
    id: 'tired_001',
    scene: '很累',
    mood: '疲劳',
    text: '很累的时候，降低难度不是偷懒，是聪明。今天就用最低线保护自己。',
  },
  {
    id: 'tired_002',
    scene: '很累',
    mood: '低能量',
    text: '身体在提醒你慢一点。动一小会儿、吃点舒服的、早点休息，就很好了。',
  },
  {
    id: 'done_001',
    scene: '完成后',
    mood: '鼓励',
    text: '做到这里就很好啦。不是每一天都要满分，稳定一点点就会变漂亮。',
  },
  {
    id: 'day_shift_001',
    scene: '白班日',
    mood: '下班后',
    text: '白天已经消耗很多脑力了，训练安排简单一点，身体会更愿意配合你。',
  },
  {
    id: 'comfort_001',
    scene: '鼓励',
    mood: '情绪低落',
    text: '今天也想认真夸你一下：你没有放弃自己，这件事本身就很珍贵。',
  },
  {
    id: 'plan_001',
    scene: '生成计划前',
    mood: '行动',
    text: '把复杂的事交给计划就好。你只负责点一下，然后照着做一点点。',
  },
];

export function getQuoteById(id) {
  return quoteLibrary.find((quote) => quote.id === id) || quoteLibrary[0];
}

export function quotesForSticker(sticker) {
  if (!sticker?.quoteIds?.length) return [quoteLibrary[0]];
  return sticker.quoteIds.map((id) => getQuoteById(id));
}
