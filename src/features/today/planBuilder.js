const planLibrary = {
  '15分钟': {
    gym: {
      training: '快走8分钟 + 器械轻拉10分钟 + 拉伸2分钟',
      tags: ['最低线', '不硬撑', '轻出汗'],
    },
    home: {
      training: '肩颈活动5分钟 + 臀桥2组 + 死虫2组 + 拉伸',
      tags: ['家里做', '不跳跃', '低压力'],
    },
    store: {
      training: '今天不安排正式训练，饭后轻松走10-15分钟',
      tags: ['恢复优先', '走一走', '不空腹'],
    },
  },
  '30分钟': {
    gym: {
      training: '轻力量 + 核心激活',
      detail: '热身5分钟 + 力量20分钟 + 拉伸5分钟',
      tags: ['新手友好', '塑形', '稳一点'],
    },
    home: {
      training: '居家全身唤醒',
      detail: '热身5分钟 + 深蹲/臀桥/平板支撑20分钟 + 拉伸',
      tags: ['不占地', '安静', '可暂停'],
    },
    store: {
      training: '饭后轻走 + 肩颈放松',
      detail: '步行20分钟 + 拉伸10分钟',
      tags: ['便利店日', '恢复', '不加练'],
    },
  },
  '45分钟': {
    gym: {
      training: '上肢塑形 + 臀腿辅助',
      detail: '热身8分钟 + 器械30分钟 + 拉伸7分钟',
      tags: ['标准日', '力量', '慢节奏'],
    },
    home: {
      training: '居家循环训练',
      detail: '深蹲/臀桥/划船/死虫各3组 + 拉伸',
      tags: ['家里做', '无器械', '轻强度'],
    },
    store: {
      training: '恢复走路日',
      detail: '正餐后低强度步行30分钟 + 拉伸10分钟',
      tags: ['速食日', '别硬练', '早点睡'],
    },
  },
  '60分钟': {
    gym: {
      training: '完整新手器械日',
      detail: '下拉/划船/推胸/腿举/臀推各3组 + 坡走',
      tags: ['完整日', '器械', '塑形'],
    },
    home: {
      training: '居家全身循环',
      detail: '全身动作3轮 + 低强度有氧15分钟',
      tags: ['完整日', '有氧', '拉伸'],
    },
    store: {
      training: '恢复优先',
      detail: '便利店正餐 + 低强度步行40分钟',
      tags: ['恢复', '轻活动', '不焦虑'],
    },
  },
};

function conditionKey(condition) {
  if (condition === '健身房') return 'gym';
  if (condition === '家里') return 'home';
  return 'store';
}

function buildPlan(time, status, condition) {
  const base = planLibrary[time][conditionKey(condition)];
  const nightShift = status === '夜班后';
  const tired = status === '很累';
  const rest = status === '休息日';

  if (nightShift) {
    return {
      trainingTitle: `${time} 轻恢复`,
      training: condition === '速食便利店' ? '饭后轻走 + 肩颈放松' : base.training,
      trainingDetail: condition === '健身房' ? '热身5分钟 + 力量20分钟 + 拉伸5分钟' : base.detail || '轻活动10-20分钟 + 拉伸放松',
      foodTitle: '夜班后小份恢复餐',
      food: condition === '速食便利店'
        ? '鸡蛋 / 酸奶 / 饭团 / 豆浆 / 水果'
        : '高蛋白 + 易消化 + 少油甜',
      minimum: ['训练≥20分钟', '蛋白质≥1掌心', '喝水≥1.5L'],
      avoid: ['空腹高强度', '久坐不动', '暴饮暴食'],
      note: '夜班后先恢复，不用补偿式加练。',
    };
  }

  if (tired) {
    return {
      trainingTitle: `${time} 降级版`,
      training: '轻活动 + 拉伸',
      trainingDetail: '能动一点就算完成，头晕就直接停止',
      foodTitle: '不刺激的正餐',
      food: condition === '速食便利店' ? '豆浆 / 鸡蛋 / 饭团 / 香蕉' : '蛋白质 + 主食 + 温热饮品',
      minimum: ['走路10分钟', '吃到蛋白质', '早点休息'],
      avoid: ['硬撑训练', '空腹咖啡', '情绪性暴食'],
      note: '很累的时候，目标是稳住身体，不是追求消耗。',
    };
  }

  if (rest) {
    return {
      trainingTitle: `${time} 轻塑形`,
      training: base.training,
      trainingDetail: base.detail || '轻力量 + 核心 + 拉伸',
      foodTitle: '正常吃饭',
      food: '一掌心蛋白质 + 一拳主食 + 蔬果',
      minimum: ['完成热身', '吃够蛋白质', '不熬夜'],
      avoid: ['全天躺平', '少吃主食', '睡前大餐'],
      note: '休息日适合慢慢做，不需要一下子拉满。',
    };
  }

  return {
    trainingTitle: `${time} 标准日`,
    training: base.training,
    trainingDetail: base.detail || base.training,
    foodTitle: '白班轻盈正餐',
    food: condition === '速食便利店' ? '即食鸡胸 / 茶叶蛋 / 饭团 / 无糖酸奶' : '高蛋白 + 正常主食 + 蔬果',
    minimum: ['训练≥20分钟', '蛋白质≥1掌心', '喝水≥1.5L'],
    avoid: ['空腹高强度', '久坐不动', '暴饮暴食'],
    note: '保持可持续，比一天做到完美更重要。',
  };
}

export { buildPlan };
