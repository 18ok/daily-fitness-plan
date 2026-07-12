import { availableDumbbellLoads } from '../../lib/trainingProfile.js';
import { recentExerciseHistory, recommendNextLoad } from '../../lib/exerciseHistory.js';

const loadCopy = {
  start: '先从最小可用档位试一组',
  increase: '上次很稳，今天可以试下一档',
  keep: '先继续用上次这个重量',
  decrease: '今天先换轻一点，动作稳更重要',
  bodyweight: '先用徒手版本试一组',
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

function movementCount(time) {
  if (time === '15分钟') return 2;
  if (time === '45分钟') return 5;
  if (time === '60分钟') return 5;
  return 4;
}

function targetReps(goals) {
  if (goals.includes('habit')) return '6–8 次';
  return '8–10 次';
}

function setsFor(mode) {
  if (mode === 'recovery') return 1;
  if (mode === 'light') return 2;
  return 2;
}

function latestExerciseLog(history, exerciseId) {
  return recentExerciseHistory(history, exerciseId, 1)[0]
    || recentExerciseHistory(history, exerciseId.replaceAll('_', '-'), 1)[0]
    || null;
}

function loadSuggestion({ exerciseId, requiresDumbbell, loads, exerciseHistory, mode }) {
  const previousLog = latestExerciseLog(exerciseHistory, exerciseId);
  const recommendation = recommendNextLoad({
    availableLoads: requiresDumbbell ? loads : [],
    previousLog,
    todayMode: mode,
  });
  const shouldHoldLoad = mode !== 'normal' && recommendation.action === 'increase';
  const heldLoad = loads.filter((load) => load <= Number(previousLog?.loadKg)).at(-1) || loads[0] || null;

  return {
    loadKg: shouldHoldLoad ? heldLoad : recommendation.loadKg,
    action: shouldHoldLoad ? 'keep' : recommendation.action,
    guidance: loadCopy[shouldHoldLoad ? 'keep' : recommendation.action],
  };
}

function resolveMovement(template, context) {
  const { goals, limits, loads, bodyweight, mode, exerciseHistory } = context;
  let resolved = template;

  if (limits.includes(template.movement)) {
    if (!template.avoidedFallback) return null;
    resolved = { ...template, ...template.avoidedFallback, requiresDumbbell: false };
  } else if (template.requiresDumbbell && loads.length === 0 && template.fallback) {
    resolved = { ...template, ...template.fallback, requiresDumbbell: false };
  }

  if ((resolved.requiresDumbbell && loads.length === 0) || (resolved.requiresBodyweight && !bodyweight)) {
    return null;
  }

  return {
    id: resolved.id,
    name: resolved.name,
    replacement: resolved.replacement || null,
    equipmentLabel: resolved.equipmentLabel,
    sets: setsFor(mode),
    targetReps: resolved.targetReps || targetReps(goals),
    suggestedLoad: loadSuggestion({
      exerciseId: resolved.id,
      requiresDumbbell: resolved.requiresDumbbell === true,
      loads,
      exerciseHistory,
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

function safetyNotice(mode, cycleAdjustment) {
  if (mode === 'suggest_rest') {
    return cycleAdjustment?.suggestion || '今天先暂停训练；如症状严重、持续或令你担心，请及时就医。';
  }
  if (mode === 'recovery') return '今天以舒缓活动为主；如不适就停止。';
  if (mode === 'light') return '今天做轻量版本，动作舒服比完成数量更重要。';
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
  const context = {
    goals,
    limits: movementLimits(trainingProfile),
    loads,
    bodyweight: hasBodyweightCapability(trainingProfile),
    mode,
    exerciseHistory,
  };

  if (mode === 'suggest_rest') {
    return {
      mode,
      movements: [],
      mealGuide: mealGuide(basePlan, goals, state),
      safetyNotice: safetyNotice(mode, cycleAdjustment),
    };
  }

  const templates = mode === 'recovery'
    ? recoveryCatalog
    : movementCatalog.slice(0, movementCount(state?.time));
  const movements = uniqueMovements(templates.map((template) => resolveMovement(template, context)));

  if (movements.length === 0) {
    return {
      mode: 'suggest_rest',
      movements: [],
      mealGuide: mealGuide(basePlan, goals, state),
      safetyNotice: '还没有确认可用器械或徒手训练，今天先不安排训练。',
    };
  }

  return {
    mode,
    movements,
    mealGuide: mealGuide(basePlan, goals, state),
    safetyNotice: safetyNotice(mode, cycleAdjustment),
  };
}

export { loadCopy };
