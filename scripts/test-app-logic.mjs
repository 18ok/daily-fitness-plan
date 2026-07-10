import assert from 'node:assert/strict';
import { buildPlan } from '../src/features/today/planBuilder.js';
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

run('record companion copy preserves status branches', () => {
  assert.equal(recordCompanionText('夜班后'), '今天不用完美，夜班后慢慢照顾自己也很好。');
  assert.equal(recordCompanionText('休息日'), '休息日也可以轻轻记录一下，保持节奏就很可爱。');
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

console.log('\nAll app logic tests passed.');
