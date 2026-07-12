const RED_FLAG_LABELS = {
  dizziness: '出现头晕',
  abnormal_bleeding: '出现异常出血',
};

function validScore(value) {
  return Number.isInteger(value) && value >= 0 && value <= 10 ? value : null;
}

function hasRedFlags(value) {
  return Array.isArray(value) && value.some((item) => typeof item === 'string' && item);
}

function symptomReason(symptoms) {
  if (!Array.isArray(symptoms) || symptoms.length === 0) return null;
  return '已记录身体不适';
}

function redFlagReasons(redFlags) {
  return redFlags
    .filter((item) => typeof item === 'string')
    .map((item) => RED_FLAG_LABELS[item] || '出现需要留意的信号');
}

/**
 * Offer a conservative, non-diagnostic training adjustment for one daily log.
 * @param {object | null | undefined} log
 */
export function getCycleTrainingAdjustment(log) {
  const safeLog = log && typeof log === 'object' ? log : {};
  const painLevel = validScore(safeLog.painLevel);
  const energyLevel = validScore(safeLog.energyLevel);
  const poorSleep = safeLog.sleepQuality === 'poor';
  const redFlags = Array.isArray(safeLog.redFlags) ? safeLog.redFlags : [];
  const mildSymptom = symptomReason(safeLog.symptoms);

  if (hasRedFlags(redFlags) || (painLevel !== null && painLevel >= 7)) {
    const reasons = [
      ...redFlagReasons(redFlags),
      ...(painLevel !== null && painLevel >= 7 ? [`疼痛 ${painLevel}/10`] : []),
    ];
    return {
      level: 'suggest_rest',
      title: '建议暂停训练',
      reasons,
      suggestion: '今天先暂停训练；如症状严重、持续或令你担心，请及时就医。',
      requiresCareNotice: true,
    };
  }

  if (
    (painLevel !== null && painLevel >= 4)
    || (energyLevel !== null && energyLevel <= 3)
    || poorSleep
  ) {
    const reasons = [
      ...(painLevel !== null && painLevel >= 4 ? [`疼痛 ${painLevel}/10`] : []),
      ...(energyLevel !== null && energyLevel <= 3 ? [`精力 ${energyLevel}/10`] : []),
      ...(poorSleep ? ['昨晚睡眠较差'] : []),
    ];
    return {
      level: 'recovery',
      title: '今天适合恢复训练',
      reasons,
      suggestion: '可以考虑散步、拉伸或降低时长和重量；如不适就停止。',
      requiresCareNotice: false,
    };
  }

  if ((energyLevel !== null && energyLevel <= 5) || mildSymptom) {
    return {
      level: 'light',
      title: '今天建议轻量训练',
      reasons: [
        ...(energyLevel !== null && energyLevel <= 5 ? [`精力 ${energyLevel}/10`] : []),
        ...(mildSymptom ? [mildSymptom] : []),
      ],
      suggestion: '可以完成轻量版本，减少组数或把训练换成舒缓活动。',
      requiresCareNotice: false,
    };
  }

  return {
    level: 'normal',
    title: '可以按原计划训练',
    reasons: ['当前记录没有显示需要降低强度的信号'],
    suggestion: '按自己的感受调整；如果训练中出现不适，请及时停止。',
    requiresCareNotice: false,
  };
}
