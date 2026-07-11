import assert from 'node:assert/strict';
import { buildPlan } from '../src/features/today/planBuilder.js';
import {
  buildPilotFeedback,
  createPilotFeedbackId,
  submitPilotFeedback,
} from '../src/features/today/pilotFeedback.js';
import { buildRecordFeedback, recordCompanionText } from '../src/features/record/recordFeedback.js';

function run(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

run('night-shift gym plan preserves recovery output', () => {
  assert.deepEqual(buildPlan('30分钟', '夜班后', '健身房'), {
    trainingTitle: '30分钟 轻恢复',
    training: '轻力量 + 核心激活',
    trainingDetail: '热身5分钟 + 力量20分钟 + 拉伸5分钟',
    foodTitle: '夜班后小份恢复餐',
    food: '高蛋白 + 易消化 + 少油甜',
    minimum: ['训练≥20分钟', '蛋白质≥1掌心', '喝水≥1.5L'],
    avoid: ['空腹高强度', '久坐不动', '暴饮暴食'],
    note: '夜班后先恢复，不用补偿式加练。',
  });
});

run('tired store plan preserves downgrade output', () => {
  const plan = buildPlan('15分钟', '很累', '速食便利店');
  assert.equal(plan.trainingTitle, '15分钟 降级版');
  assert.equal(plan.food, '豆浆 / 鸡蛋 / 饭团 / 香蕉');
  assert.deepEqual(plan.minimum, ['走路10分钟', '吃到蛋白质', '早点休息']);
});

run('all supported statuses and default companion exact output', () => {
  assert.equal(recordCompanionText('夜班后'), '今天不用完美，夜班后慢慢照顾自己也很好。');
  assert.equal(recordCompanionText('很累'), '今天不用完美，能照顾自己一点点就很好。');
  assert.equal(recordCompanionText('休息日'), '休息日也可以轻轻记录一下，保持节奏就很可爱。');
  assert.equal(recordCompanionText('白班'), '今天不用完美，能照顾自己一点点就很好。');
});

run('standard plan exact output', () => {
  assert.deepEqual(buildPlan('30分钟', '白班', '健身房'), {
    trainingTitle: '30分钟 标准日',
    training: '轻力量 + 核心激活',
    trainingDetail: '热身5分钟 + 力量20分钟 + 拉伸5分钟',
    foodTitle: '白班轻盈正餐',
    food: '高蛋白 + 正常主食 + 蔬果',
    minimum: ['训练≥20分钟', '蛋白质≥1掌心', '喝水≥1.5L'],
    avoid: ['空腹高强度', '久坐不动', '暴饮暴食'],
    note: '保持可持续，比一天做到完美更重要。',
  });
});

run('rest plan exact output', () => {
  assert.deepEqual(buildPlan('45分钟', '休息日', '家里'), {
    trainingTitle: '45分钟 轻塑形',
    training: '居家循环训练',
    trainingDetail: '深蹲/臀桥/划船/死虫各3组 + 拉伸',
    foodTitle: '正常吃饭',
    food: '一掌心蛋白质 + 一拳主食 + 蔬果',
    minimum: ['完成热身', '吃够蛋白质', '不熬夜'],
    avoid: ['全天躺平', '少吃主食', '睡前大餐'],
    note: '休息日适合慢慢做，不需要一下子拉满。',
  });
});

run('invalid persisted selections do not generate a silent default plan', () => {
  assert.equal(buildPlan('unknown', '白班', '家里'), null);
  assert.equal(buildPlan('30分钟', 'unknown', '家里'), null);
  assert.equal(buildPlan('30分钟', '白班', 'unknown'), null);
});

run('record feedback prioritizes tired energy', () => {
  assert.deepEqual(buildRecordFeedback(['训练完成'], '很累', '正常吃了'), {
    title: '今天适合先恢复',
    body: '今天先恢复也很好，不需要补偿式加练。能把身体感受留下来，就已经在认真照顾自己了。',
    badge: '记录了 1 个小照顾',
  });
});

run('record feedback preserves stable completion output', () => {
  const result = buildRecordFeedback(['训练完成', '吃饭完成'], '还可以', '正常吃了');
  assert.equal(result.title, '今天已经很稳啦');
  assert.equal(result.badge, '小小成就 +1');
});

run('reduced appetite exact output', () => {
  assert.deepEqual(buildRecordFeedback(['吃饭完成'], '还可以', '吃少了'), {
    title: '记得喂饱自己',
    body: '下次先补一份蛋白质和主食，别让身体空着硬撑。今天这样记下来，明天会轻轻调整节奏。',
    badge: '有记得吃饭，很好',
  });
});

run('chaotic appetite exact output', () => {
  assert.deepEqual(buildRecordFeedback(['没有头晕'], '还可以', '有点乱吃'), {
    title: '没关系，下一餐慢慢来',
    body: '没关系，下一餐回到舒服一点的节奏就好。不是失败，只是今天状态如此。',
    badge: '身体还稳定，这就很好',
  });
});

run('pilot feedback identity is stable per exact plan', () => {
  const input = {
    clientId: 'client-123',
    date: '2026-07-11',
    contentVersion: 1,
    selections: { time: '30分钟', status: '白班', condition: '家里' },
  };
  assert.equal(
    createPilotFeedbackId(input),
    'client-123|2026-07-11|1|30分钟|白班|家里',
  );
});

run('pilot feedback payload excludes personal and cycle data', () => {
  assert.deepEqual(
    buildPilotFeedback({
      clientFeedbackId: 'client-123|2026-07-11|1|30分钟|白班|家里',
      rating: '太难',
      note: '  动作说明还不够具体。  ',
      selections: { time: '30分钟', status: '白班', condition: '家里' },
      contentVersion: 1,
      submittedAt: '2026-07-11T04:00:00.000Z',
    }),
    {
      client_feedback_id: 'client-123|2026-07-11|1|30分钟|白班|家里',
      rating: '太难',
      note: '动作说明还不够具体。',
      time_choice: '30分钟',
      status_choice: '白班',
      condition_choice: '家里',
      content_version: 1,
      submitted_at: '2026-07-11T04:00:00.000Z',
    },
  );
});

run('pilot feedback rejects unknown ratings and long notes', () => {
  const base = {
    clientFeedbackId: 'feedback-id',
    selections: { time: '30分钟', status: '白班', condition: '家里' },
    contentVersion: 1,
    submittedAt: '2026-07-11T04:00:00.000Z',
  };
  assert.throws(() => buildPilotFeedback({ ...base, rating: '一般', note: '' }), /Unsupported feedback rating/);
  assert.throws(() => buildPilotFeedback({ ...base, rating: '适合', note: 'x'.repeat(201) }), /Feedback note is too long/);
});

async function runAsync(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`fail - ${name}`);
    throw error;
  }
}

await runAsync('pilot feedback repository inserts once', async () => {
  const calls = [];
  const client = {
    from(table) {
      return {
        async insert(payload) {
          calls.push({ table, payload });
          return { error: null };
        },
      };
    },
  };
  const payload = { client_feedback_id: 'feedback-id', rating: '适合' };
  await submitPilotFeedback(client, payload);
  assert.deepEqual(calls, [{ table: 'experience_feedback', payload }]);
});

console.log('\nAll app logic tests passed.');
