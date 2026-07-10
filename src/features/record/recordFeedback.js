function recordCompanionText(status) {
  if (status === '夜班后') return '今天不用完美，夜班后慢慢照顾自己也很好。';
  if (status === '很累') return '今天不用完美，能照顾自己一点点就很好。';
  if (status === '休息日') return '休息日也可以轻轻记录一下，保持节奏就很可爱。';
  return '今天不用完美，能照顾自己一点点就很好。';
}

function buildRecordFeedback(checks, energy, appetite) {
  const done = checks.length;
  const hasTraining = checks.includes('训练完成');
  const hasFood = checks.includes('吃饭完成');
  const hasWater = checks.includes('喝水完成');
  const noDizzy = checks.includes('没有头晕');

  if (energy === '很累') {
    return {
      title: '今天适合先恢复',
      body: '今天先恢复也很好，不需要补偿式加练。能把身体感受留下来，就已经在认真照顾自己了。',
      badge: done > 0 ? `记录了 ${done} 个小照顾` : '愿意看看自己的状态，这也很棒',
    };
  }

  if (appetite === '吃少了') {
    return {
      title: '记得喂饱自己',
      body: '下次先补一份蛋白质和主食，别让身体空着硬撑。今天这样记下来，明天会轻轻调整节奏。',
      badge: hasFood ? '有记得吃饭，很好' : '下一餐先补一点就好',
    };
  }

  if (appetite === '有点乱吃') {
    return {
      title: '没关系，下一餐慢慢来',
      body: '没关系，下一餐回到舒服一点的节奏就好。不是失败，只是今天状态如此。',
      badge: noDizzy ? '身体还稳定，这就很好' : '先休息，明天再轻轻来',
    };
  }

  if (hasTraining && hasFood) {
    return {
      title: '今天已经很稳啦',
      body: '今天已经很稳啦，身体会记得这些小努力。你正在把照顾自己做进日常里。',
      badge: '小小成就 +1',
    };
  }

  if (energy === '轻松' && done >= 3) {
    return {
      title: '今天在轻轻发光',
      body: '身体感觉轻松，完成得也不错。明天可以继续这个节奏，不用加量。',
      badge: `${done} 项都记下来啦`,
    };
  }

  if (done >= 4) {
    return {
      title: '今天照顾得很周到',
      body: '训练、吃饭、喝水……你在很多地方都照顾到了自己。这样的记录，会帮你慢慢找到舒服的节奏。',
      badge: '今日小成就达成',
    };
  }

  if (done >= 2) {
    return {
      title: '已经有人在认真爱自己了',
      body: '不用一次做完所有事，你点的每一项都是在对自己好。继续保持这种低压力的节奏就好。',
      badge: `${done}/${5} 项已完成`,
    };
  }

  if (done >= 1) {
    return {
      title: '从一点点开始',
      body: '哪怕只完成一项，也比硬撑或完全放弃要好。今天这样就已经在路上了。',
      badge: '第一步也是进步',
    };
  }

  if (hasWater) {
    return {
      title: '有在好好喝水',
      body: '喝水这件事看起来小，但对恢复很重要。继续用这么轻松的方式记录就好。',
      badge: '小习惯也是成就',
    };
  }

  return {
    title: '今天也在路上',
    body: '不管点了多少，愿意停下来看看自己的状态，就已经不是在硬撑啦。',
    badge: '打开记录页本身就很棒',
  };
}

export { buildRecordFeedback, recordCompanionText };
