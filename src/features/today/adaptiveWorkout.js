import { availableDumbbellLoads, availableKettlebellLoads, selectedGymMachines } from '../../lib/trainingProfile.js';
import { recentExerciseHistory, recommendNextLoad } from '../../lib/exerciseHistory.js';

const loadCopy = {
  start: '先从最小可用档位试一组',
  increase: '上次很稳，今天可以试下一档',
  keep: '先继续用上次这个重量',
  decrease: '今天先换轻一点，动作稳更重要',
  bodyweight: '先用徒手版本试一组',
  band_start: '先用弹力带轻阻力试一组，阻力可在记录时补充',
  machine_start: '先从这台器械的最轻档试一组，需要时再记录实际 kg',
  stop: '今天先不加重量，做舒缓活动或休息',
};

const movementCatalog = [
  {
    id: 'dumbbell_row',
    name: '单臂哑铃划船',
    movement: 'horizontal_pull',
    equipmentLabel: '已拥有的哑铃',
    requiresDumbbell: true,
    fallback: {
      id: 'prone_y_t_w',
      name: '俯卧 Y-T-W',
      equipmentLabel: '自重',
      requiresBodyweight: true,
      replacement: '没有哑铃时，改为自重俯卧 Y-T-W',
    },
  },
  {
    id: 'goblet_squat',
    name: '杯式深蹲',
    movement: 'squat',
    limitMovements: ['squat', 'stand_after_sitting'],
    equipmentLabel: '已拥有的哑铃',
    requiresDumbbell: true,
    fallback: {
      id: 'bodyweight_squat',
      name: '自重坐站',
      equipmentLabel: '自重',
      requiresBodyweight: true,
      replacement: '没有哑铃时，改为自重坐站',
    },
    avoidedFallback: {
      id: 'glute_bridge',
      name: '自重臀桥',
      equipmentLabel: '自重',
      requiresBodyweight: true,
      replacement: '避开深蹲，改为自重臀桥',
    },
  },
  {
    id: 'dumbbell_hip_hinge',
    name: '哑铃髋铰链',
    movement: 'hinge',
    equipmentLabel: '已拥有的哑铃',
    requiresDumbbell: true,
    fallback: {
      id: 'glute_bridge',
      name: '自重臀桥',
      equipmentLabel: '自重',
      requiresBodyweight: true,
      replacement: '没有哑铃时，改为自重臀桥',
    },
    avoidedFallback: {
      id: 'dead_bug',
      name: '死虫式',
      equipmentLabel: '自重',
      requiresBodyweight: true,
      replacement: '避开髋铰链，改为自重死虫式',
    },
  },
  {
    id: 'incline_push_up',
    name: '斜板俯卧撑',
    movement: 'horizontal_push',
    equipmentLabel: '自重',
    requiresBodyweight: true,
  },
  {
    id: 'dead_bug',
    name: '死虫式',
    movement: 'core',
    equipmentLabel: '自重',
    requiresBodyweight: true,
  },
];

const bandCatalog = [
  {
    id: 'band_row',
    name: '弹力带划船',
    movement: 'horizontal_pull',
    equipmentLabel: '弹力带',
    requiresBands: true,
    loadKind: 'band',
  },
  {
    id: 'band_chest_press',
    name: '弹力带推胸',
    movement: 'horizontal_push',
    equipmentLabel: '弹力带',
    requiresBands: true,
    loadKind: 'band',
  },
];

const kettlebellCatalog = [
  {
    id: 'kettlebell_deadlift',
    name: '壶铃硬拉',
    movement: 'hinge',
    equipmentLabel: '壶铃',
    requiresKettlebell: true,
  },
  {
    id: 'kettlebell_goblet_squat',
    name: '壶铃杯式深蹲',
    movement: 'squat',
    equipmentLabel: '壶铃',
    requiresKettlebell: true,
  },
];

const machineCatalog = [{
  id: 'machine_row',
  name: '器械划船',
  movement: 'horizontal_pull',
  requiresMachine: true,
  loadKind: 'machine',
}];

const recoveryCatalog = [
  {
    id: 'easy_walk',
    name: '轻松走动',
    movement: 'walk',
    equipmentLabel: '自重',
    requiresBodyweight: true,
    targetReps: '5–10 分钟',
  },
  {
    id: 'gentle_mobility',
    name: '舒缓活动度练习',
    movement: 'mobility',
    equipmentLabel: '自重',
    requiresBodyweight: true,
    targetReps: '每个方向 5–8 次',
  },
];

const uncomfortableFallback = {
  id: 'gentle_mobility',
  name: '舒缓活动度练习',
  equipmentLabel: '无负重',
  requiresBands: false,
  requiresBodyweight: false,
  requiresDumbbell: false,
  requiresKettlebell: false,
  requiresMachine: false,
  loadKind: 'bodyweight',
  targetReps: '每个方向 5–8 次',
  replacement: '上次这个动作不舒服，今天先改成无负重的舒缓活动',
  isSafetyAlternative: true,
};

function asArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string') : [];
}

function profileGoals(profile) {
  const goals = asArray(profile?.goals);
  return goals.length > 0 ? goals : (typeof profile?.goal === 'string' ? [profile.goal] : []);
}

function movementLimits(profile) {
  return [...new Set([...asArray(profile?.movementLimits), ...asArray(profile?.avoidMovements)])];
}

function hasSafetyFlag(profile) {
  const flag = profile?.safetyFlag;
  return flag === true || (typeof flag === 'string' && flag !== '' && flag !== 'none' && flag !== 'normal');
}

function hasBodyweightCapability(profile) {
  return profile?.equipment?.bodyweight === true;
}

function workoutMode(cycleAdjustment, trainingProfile) {
  if (hasSafetyFlag(trainingProfile) || cycleAdjustment?.level === 'suggest_rest') return 'suggest_rest';
  return ['light', 'recovery'].includes(cycleAdjustment?.level) ? cycleAdjustment.level : 'normal';
}

function movementCount(time, experienceLevel) {
  if (time === '15分钟') return 2;
  const countByExperience = { new: 2, occasional: 3, consistent: 4 };
  const count = countByExperience[experienceLevel] || countByExperience.new;
  if (time === '45分钟' || time === '60分钟') return Math.min(5, count + 1);
  return count;
}

function targetReps(goals, experienceLevel) {
  if (experienceLevel === 'consistent') return '8–10 次';
  if (goals.includes('habit')) return '6–8 次';
  return '6–8 次';
}

function setsFor(mode, experienceLevel) {
  if (mode === 'recovery') return 1;
  if (mode === 'light') return 2;
  return experienceLevel === 'new' ? 1 : 2;
}

function latestExerciseLog(history, exerciseId) {
  return recentExerciseHistory(history, exerciseId, 1)[0]
    || recentExerciseHistory(history, exerciseId.replaceAll('_', '-'), 1)[0]
    || null;
}

function loadSuggestion({ exerciseId, availableLoads, exerciseHistory, loadKind, mode }) {
  if (loadKind === 'band') return { loadKg: null, action: 'band_start', guidance: loadCopy.band_start };
  if (loadKind === 'machine') return { loadKg: null, action: 'machine_start', guidance: loadCopy.machine_start };

  const previousLog = latestExerciseLog(exerciseHistory, exerciseId);
  const recommendation = recommendNextLoad({
    availableLoads: loadKind === 'load' ? availableLoads : [],
    previousLog,
    todayMode: mode,
  });
  const shouldHoldLoad = mode !== 'normal' && recommendation.action === 'increase';
  const heldLoad = availableLoads.filter((load) => load <= Number(previousLog?.loadKg)).at(-1) || availableLoads[0] || null;

  return {
    loadKg: shouldHoldLoad ? heldLoad : recommendation.loadKg,
    action: shouldHoldLoad ? 'keep' : recommendation.action,
    guidance: loadCopy[shouldHoldLoad ? 'keep' : recommendation.action],
  };
}

function resolveMovement(template, context) {
  const {
    bands, bodyweight, experienceLevel, exerciseHistory, goals, kettlebellLoads, limits, loads, machines, mode,
  } = context;
  let resolved = template;

  const limitedMovements = template.limitMovements || [template.movement];

  if (latestExerciseLog(exerciseHistory, template.id)?.feedback === 'uncomfortable') {
    resolved = { ...template, ...uncomfortableFallback };
  } else if (limitedMovements.some((movement) => limits.includes(movement))) {
    if (!template.avoidedFallback) return null;
    resolved = { ...template, ...template.avoidedFallback, requiresDumbbell: false };
  } else if (template.requiresDumbbell && loads.length === 0 && template.fallback) {
    resolved = { ...template, ...template.fallback, requiresDumbbell: false };
  }

  if ((resolved.requiresDumbbell && loads.length === 0)
    || (resolved.requiresKettlebell && kettlebellLoads.length === 0)
    || (resolved.requiresMachine && machines.length === 0)
    || (resolved.requiresBands && !bands)
    || (resolved.requiresBodyweight && !bodyweight)) {
    return null;
  }

  const loadKind = resolved.loadKind || ((resolved.requiresDumbbell || resolved.requiresKettlebell) ? 'load' : 'bodyweight');
  const availableLoads = resolved.requiresKettlebell ? kettlebellLoads : loads;

  return {
    id: resolved.id,
    name: resolved.name,
    replacement: resolved.replacement || null,
    isSafetyAlternative: resolved.isSafetyAlternative === true,
    equipmentLabel: resolved.requiresMachine ? machines[0] : resolved.equipmentLabel,
    loadKind,
    availableLoads: loadKind === 'load' ? availableLoads : [],
    sets: setsFor(mode, experienceLevel),
    targetReps: resolved.targetReps || targetReps(goals, experienceLevel),
    suggestedLoad: loadSuggestion({
      exerciseId: resolved.id,
      availableLoads,
      exerciseHistory,
      loadKind,
      mode,
    }),
    why: goals.includes('shape') ? '用容易掌握的全身动作，慢慢建立塑形基础。' : '用容易掌握的动作，先把训练习惯做稳。',
    stopHint: '动作疼痛、头晕或明显不舒服时就停止，今天改为轻松走动或休息。',
  };
}

function uniqueMovements(movements) {
  const seenIds = new Set();
  return movements.filter((movement) => {
    if (!movement || seenIds.has(movement.id)) return false;
    seenIds.add(movement.id);
    return true;
  });
}

function mealGuide(basePlan, goals, state) {
  const fatLossFood = goals.includes('fat_loss_food');
  const isStore = state?.condition === '速食便利店';

  return {
    title: fatLossFood ? '盘餐法：吃饱也能稳稳调整' : '盘餐法：给训练留出能量',
    plate: [
      '一掌心蛋白质',
      '一拳主食',
      '半盘蔬菜或水果',
    ],
    suggestion: isStore
      ? '便利店可从蛋、奶、豆制品、饭团和水果里拼一餐。'
      : (basePlan?.food || '按一掌心蛋白质、一拳主食和半盘蔬菜或水果来搭配。'),
    reminder: fatLossFood
      ? '先规律吃正餐，不用靠少吃或补偿式运动。'
      : '训练前后都可以正常吃饭，按饥饿感调整份量。',
  };
}

function tailoredMealGuide(basePlan, profile, state) {
  const guide = mealGuide(basePlan, profileGoals(profile), state);
  const habits = profile?.dietHabits || {};
  if (!profileGoals(profile).includes('fat_loss_food')) return guide;

  if (habits.takeout === 'weekly_4_plus') {
    return {
      ...guide,
      suggestion: '外卖时可以先找一份蛋白质、一个主食和蔬菜，不用为了补偿而少吃。',
      reminder: habits.breakfast === 'rarely'
        ? '早餐先从一份容易准备的主食和蛋白质开始，规律比追求完美更重要。'
        : guide.reminder,
    };
  }
  if (habits.protein === 'unsure') {
    return {
      ...guide,
      suggestion: '每餐先看看有没有蛋、奶、豆制品、鱼肉或其他你愿意吃的蛋白质。',
      reminder: habits.breakfast === 'rarely'
        ? '早餐先从一份容易准备的主食和蛋白质开始，规律比追求完美更重要。'
        : guide.reminder,
    };
  }
  if (habits.breakfast === 'rarely') {
    return { ...guide, reminder: '早餐先从一份容易准备的主食和蛋白质开始，规律比追求完美更重要。' };
  }
  return guide;
}

function safetyNotice(mode, cycleAdjustment, hasUncomfortableAction = false) {
  if (mode === 'suggest_rest') {
    return cycleAdjustment?.suggestion || '今天先暂停训练；如症状严重、持续或令你担心，请及时就医。';
  }
  if (mode === 'recovery') return '今天以舒缓活动为主；如不适就停止。';
  if (mode === 'light') return '今天做轻量版本，动作舒服比完成数量更重要。';
  if (hasUncomfortableAction) return '上次有动作让你不舒服，今天先停掉那个动作并改做无负重舒缓活动；如不适持续或令你担心，请停止并咨询专业人士。';
  return '按自己的感受调整；如果训练中出现不适，请及时停止。';
}

export function buildAdaptiveWorkout({
  basePlan,
  state,
  trainingProfile,
  exerciseHistory,
  cycleAdjustment,
} = {}) {
  const goals = profileGoals(trainingProfile);
  const mode = workoutMode(cycleAdjustment, trainingProfile);
  const loads = availableDumbbellLoads(trainingProfile);
  const kettlebellLoads = availableKettlebellLoads(trainingProfile);
  const machines = selectedGymMachines(trainingProfile);
  const context = {
    bands: trainingProfile?.equipment?.bands === true,
    goals,
    limits: movementLimits(trainingProfile),
    loads,
    kettlebellLoads,
    machines,
    bodyweight: hasBodyweightCapability(trainingProfile),
    mode,
    exerciseHistory,
    experienceLevel: trainingProfile?.experienceLevel || trainingProfile?.experience || 'new',
  };

  if (mode === 'suggest_rest') {
    return {
      mode,
      movements: [],
      mealGuide: tailoredMealGuide(basePlan, trainingProfile, state),
      safetyNotice: safetyNotice(mode, cycleAdjustment),
    };
  }

  const templates = mode === 'recovery'
    ? recoveryCatalog
    : [...movementCatalog, ...bandCatalog, ...kettlebellCatalog, ...machineCatalog];
  const movements = uniqueMovements(templates.map((template) => resolveMovement(template, context)))
    .slice(0, movementCount(state?.time, context.experienceLevel));
  const hasUncomfortableAction = movements.some((movement) => movement.isSafetyAlternative);

  if (movements.length === 0) {
    return {
      mode: 'suggest_rest',
      movements: [],
      mealGuide: tailoredMealGuide(basePlan, trainingProfile, state),
      safetyNotice: '还没有确认可用器械或徒手训练，今天先不安排训练。',
    };
  }

  return {
    mode,
    movements,
    mealGuide: tailoredMealGuide(basePlan, trainingProfile, state),
    safetyNotice: safetyNotice(mode, cycleAdjustment, hasUncomfortableAction),
  };
}

export { loadCopy };
