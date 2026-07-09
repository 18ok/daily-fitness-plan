import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalStorageState } from './hooks/useLocalStorageState';
import { createRoot } from 'react-dom/client';
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CircleUserRound,
  Dumbbell,
  Folder,
  Heart,
  Home,
  MessageCircle,
  Moon,
  Save,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Utensils,
  WandSparkles,
} from 'lucide-react';
import './styles.css';
import { nextTodayContent, quoteForSticker, recommendStickerForState, stickerByLabel, stickersForCategory } from './data/recommendQuote';
import { stickerCategories } from './data/stickerCatalog';
import { planCategories, planTemplates } from './data/planTemplates';
import { supabase } from './lib/supabaseClient';
import { downloadSnapshot, restoreLocalSnapshot, uploadSnapshot } from './lib/syncSnapshot';
import { calculateCareStreak, countNightRecoveries, localDateKey, upsertCareRecord } from './lib/careHistory';
import { samePlanSelections, upsertDailyPlan } from './lib/dailyPlanHistory';

import logoCat from '../assets/stickers/cat-companion/illustrations_clean/02_sailor_flag_cat.png';
import planCat from '../assets/stickers/cat-companion/illustrations_clean/05_magic_wand_cat.png';
import foodCat from '../assets/stickers/cat-companion/illustrations_clean/04_sunflower_teddy_cat.png';
import libraryCat from '../assets/stickers/cat-companion/illustrations_clean/06_detective_cat.png';
import umbrellaCat from '../assets/stickers/cat-companion/illustrations_clean/09_kimono_umbrella_cat.png';
import cheerRabbit from '../assets/stickers/cute-energy/illustrations_clean/10_cheer_rabbit.png';
import goodnightSheep from '../assets/stickers/cute-energy/illustrations_clean/07_goodnight_sheep.png';
import okBear from '../assets/stickers/cute-energy/illustrations_clean/22_ok_bear.png';
import healingCat from '../assets/stickers/cute-energy/illustrations_clean/11_healing_cat.png';
import workingRabbit from '../assets/stickers/cute-energy/illustrations_clean/19_working_rabbit.png';
import loveBear from '../assets/stickers/cute-energy/illustrations_clean/01_love_bear.png';
import confusedFrog from '../assets/stickers/cute-energy/illustrations_clean/06_frog_confused.png';

const planStepIcons = {
  moon: Moon,
  dumbbell: Dumbbell,
  heart: Heart,
  sparkles: Sparkles,
  home: Home,
  shield: ShieldCheck,
  sun: Sun,
  utensils: Utensils,
  shopping: ShoppingBag,
};

function PlanStepCard({ step }) {
  const Icon = planStepIcons[step.icon] || Sparkles;

  return (
    <article className={`plan-step-card ${step.tone}`}>
      <div className="plan-step-top">
        <span className="plan-step-num">{step.num}</span>
        <span className="plan-step-icon">
          <Icon size={17} strokeWidth={2.3} />
        </span>
      </div>
      <h4>{step.title}</h4>
      <p>{step.text}</p>
    </article>
  );
}

function TemplateDetailSheet({ template, onClose, onApply }) {
  return (
    <div className="detail-sheet-backdrop" role="presentation" onClick={onClose}>
      <section
        className="template-detail-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`${template.title}详情`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="detail-sheet-head">
          <div>
            <span>{template.meta}</span>
            <h2>{template.title}</h2>
            <p>{template.text}</p>
          </div>
          <Sticker src={template.sticker} alt={`${template.title}贴纸`} className="detail-sheet-sticker" />
        </div>

        <section className="plan-steps-section">
          <h3>今天这样做</h3>
          <div className="plan-step-list">
            {template.detailSteps.map((step) => (
              <PlanStepCard key={step.num} step={step} />
            ))}
          </div>
        </section>

        <section className="plan-food-panel">
          <div className="plan-food-head">
            <Utensils size={18} strokeWidth={2.3} />
            <h3>今天怎么吃</h3>
          </div>
          <div className="plan-food-group">
            <span>可以直接这样搭</span>
            <ul>
              {template.foodTips.combos.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          {template.foodTips.storePick?.length > 0 && (
            <div className="plan-food-group store">
              <span>便利店 / 超市可以买</span>
              <p>{template.foodTips.storePick.join('、')}</p>
            </div>
          )}
          <p className="plan-food-note">{template.foodTips.note}</p>
        </section>

        <article className="plan-reminder-card">
          <Heart size={18} strokeWidth={2.3} />
          <div>
            <strong>小提醒</strong>
            <ul>
              {template.friendlyReminder.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </article>

        <div className="detail-sheet-actions">
          <button className="secondary" onClick={onClose} type="button">先看看</button>
          <button className="primary" onClick={onApply} type="button">套用这个计划</button>
        </div>
      </section>
    </div>
  );
}

const timeOptions = ['15分钟', '30分钟', '45分钟', '60分钟'];
const statusOptions = [
  { label: '白班', icon: Sun },
  { label: '夜班后', icon: Moon },
  { label: '休息日', icon: Sparkles },
  { label: '很累', icon: Heart },
];
const conditionOptions = [
  { label: '健身房', icon: Dumbbell },
  { label: '家里', icon: Home },
  { label: '速食便利店', icon: ShoppingBag },
];

const tabs = [
  { id: 'today', label: '今日计划', icon: CalendarDays },
  { id: 'record', label: '记录', icon: BarChart3 },
  { id: 'library', label: '计划库', icon: Folder },
  { id: 'stickers', label: '能量贴纸', icon: MessageCircle },
  { id: 'profile', label: '我的', icon: CircleUserRound },
];

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

function Sticker({ src, alt, className = '' }) {
  return <img className={`sticker ${className}`} src={src} alt={alt} draggable="false" />;
}

function OptionChip({ active, icon: Icon, label, onClick }) {
  return (
    <button className={`option-chip ${active ? 'is-active' : ''}`} onClick={onClick} type="button">
      <Icon size={15} strokeWidth={2.3} />
      <span>{label}</span>
    </button>
  );
}

function ChoiceGroup({ title, children }) {
  return (
    <section className="choice-group">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ResultCard({ tone, icon: Icon, title, subtitle, detail, chips, sticker, alt }) {
  return (
    <article className={`result-card ${tone}`}>
      <div className="result-icon">
        <Icon size={19} strokeWidth={2.4} />
      </div>
      <div className="result-copy">
        <div className="result-title-row">
          <h3>{title}</h3>
          {subtitle && <span>{subtitle}</span>}
        </div>
        <p>{detail}</p>
        {chips?.length > 0 && (
          <div className="mini-tags">
            {chips.map((chip) => (
              <span key={chip}>{chip}</span>
            ))}
          </div>
        )}
      </div>
      {sticker && (
        <span className="card-sticker-frame">
          <Sticker src={sticker} alt={alt} className="card-sticker" />
        </span>
      )}
    </article>
  );
}

function TodayPage({ state, setState, plan }) {
  const [planHistory, setPlanHistory] = useLocalStorageState('daily-plan-history', []);
  const resultRef = useRef(null);
  const today = localDateKey();
  const todayEntry = planHistory.find((entry) => entry.date === today);
  const generated = samePlanSelections(todayEntry?.selections, state);
  const saved = generated && todayEntry?.saved === true;
  const update = (key, value) => setState((current) => ({ ...current, [key]: value }));

  function planRecord(overrides = {}) {
    return {
      date: today,
      selections: { ...state },
      plan,
      contentVersion: 1,
      generatedAt: new Date().toISOString(),
      saved: false,
      ...overrides,
    };
  }

  function generateTodayPlan() {
    setPlanHistory((current) => upsertDailyPlan(current, planRecord()));
    window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }

  function toggleSavedPlan() {
    const nextSaved = !saved;
    setPlanHistory((current) =>
      upsertDailyPlan(
        current,
        planRecord({
          generatedAt: generated ? todayEntry.generatedAt : new Date().toISOString(),
          saved: nextSaved,
          savedAt: nextSaved ? new Date().toISOString() : null,
        }),
      ),
    );
  }

  return (
    <div className="page-content">
      <section className="selector-panel">
        <Sticker src={planCat} alt="魔法猫贴纸" className="peek-sticker" />
        <h1>今日状态选择</h1>

        <ChoiceGroup title="今天有多少时间？">
          <div className="time-grid">
            {timeOptions.map((time) => (
              <button
                className={`time-chip ${state.time === time ? 'is-active' : ''}`}
                key={time}
                onClick={() => update('time', time)}
                type="button"
              >
                {time}
              </button>
            ))}
          </div>
        </ChoiceGroup>

        <ChoiceGroup title="今天的状态是？">
          <div className="option-grid four">
            {statusOptions.map((item) => (
              <OptionChip
                active={state.status === item.label}
                icon={item.icon}
                key={item.label}
                label={item.label}
                onClick={() => update('status', item.label)}
              />
            ))}
          </div>
        </ChoiceGroup>

        <ChoiceGroup title="今天怎么安排？">
          <div className="option-grid three">
            {conditionOptions.map((item) => (
              <OptionChip
                active={state.condition === item.label}
                icon={item.icon}
                key={item.label}
                label={item.label}
                onClick={() => update('condition', item.label)}
              />
            ))}
          </div>
        </ChoiceGroup>

        <button className={`generate-button ${generated ? 'is-generated' : ''}`} onClick={generateTodayPlan} type="button">
          <WandSparkles size={20} strokeWidth={2.4} />
          <span>{generated ? '今日计划已生成' : '生成今日计划'}</span>
        </button>
      </section>

      <section className="today-panel" ref={resultRef}>
        <div className="panel-heading">
          <div>
            <h2>今天照着做</h2>
            <p>{plan.note}</p>
          </div>
          <button className={`save-plan ${saved ? 'is-saved' : ''}`} onClick={toggleSavedPlan} type="button">
            <Save size={15} />
            {saved ? '已保存' : '保存计划'}
          </button>
        </div>

        <ResultCard
          tone="mint"
          icon={Dumbbell}
          title="训练"
          subtitle={plan.trainingTitle}
          detail={`${plan.training}｜${plan.trainingDetail}`}
          chips={['热身', '力量', '拉伸']}
          sticker={cheerRabbit}
          alt="加油兔子贴纸"
        />
        <ResultCard
          tone="lemon"
          icon={Utensils}
          title="吃饭"
          subtitle={plan.foodTitle}
          detail={plan.food}
          chips={state.condition === '速食便利店' ? ['便利店', '即食', '少油甜'] : ['高蛋白', '易消化', '少油甜']}
          sticker={foodCat}
          alt="吃饭猫贴纸"
        />
        <ResultCard
          tone="lavender"
          icon={ShieldCheck}
          title="最低线"
          detail="做到这3件事就很棒了"
          chips={plan.minimum}
          sticker={okBear}
          alt="OK小熊贴纸"
        />
        <ResultCard
          tone="pink"
          icon={Heart}
          title="不要做"
          detail="这几件事今天尽量避开"
          chips={plan.avoid}
          sticker={confusedFrog}
          alt="提醒贴纸"
        />
      </section>
    </div>
  );
}

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

function RecordPage({ state }) {
  const [checks, setChecks] = useLocalStorageState('record-checks', ['训练完成', '喝水完成']);
  const [energy, setEnergy] = useLocalStorageState('record-energy', '还可以');
  const [appetite, setAppetite] = useLocalStorageState('record-appetite', '正常吃了');
  const [careHistory, setCareHistory] = useLocalStorageState('care-history', []);
  const [saved, setSaved] = useState(() => careHistory.some((entry) => entry.date === localDateKey()));
  const items = [
    { label: '训练完成', helper: '按今天计划做了一点', icon: Dumbbell },
    { label: '吃饭完成', helper: '吃到蛋白质和主食', icon: Utensils },
    { label: '喝水完成', helper: '今天至少喝到1.5L', icon: ShieldCheck },
    { label: '没有暴食', helper: '没有靠情绪乱吃', icon: Heart },
    { label: '没有头晕', helper: '身体状态还稳定', icon: Sparkles },
  ];
  const progress = Math.round((checks.length / items.length) * 100);
  const feedback = buildRecordFeedback(checks, energy, appetite);
  const companion = recordCompanionText(state.status);

  function markUnsaved() {
    setSaved(false);
  }

  function toggle(item) {
    setChecks((current) => (current.includes(item) ? current.filter((x) => x !== item) : [...current, item]));
    markUnsaved();
  }

  function saveTodayRecord() {
    const date = localDateKey();
    setCareHistory((current) =>
      upsertCareRecord(current, {
        date,
        status: state.status,
        time: state.time,
        condition: state.condition,
        checks,
        energy,
        appetite,
        savedAt: new Date().toISOString(),
      }),
    );
    setSaved(true);
  }

  return (
    <section className="sub-page record-page">
      <article className="record-status-card">
        <div className="record-status-copy">
          <span className="record-status-label">今日状态</span>
          <p className="record-status-line">{state.status} · {state.time} · {state.condition}</p>
          <p className="record-companion">{companion}</p>
        </div>
        <div className="progress-badge" aria-label={`完成度 ${progress}%`}>
          <strong>{progress}%</strong>
          <span>照顾度</span>
        </div>
        <Sticker src={healingCat} alt="治愈猫贴纸" className="record-hero-sticker" />
      </article>

      <section className="record-section-card record-check-section">
        <div className="record-section-head">
          <h2>今日完成项</h2>
          <span>{checks.length}/{items.length}</span>
        </div>
        <div className="record-list">
          {items.map(({ label, helper, icon: Icon }) => {
            const active = checks.includes(label);
            return (
              <button className={`record-row ${active ? 'is-active' : ''}`} key={label} onClick={() => toggle(label)} type="button">
                <span className="record-row-icon">
                  <Icon size={18} strokeWidth={2.3} />
                </span>
                <span className="record-row-copy">
                  <strong>{label}</strong>
                  <small>{helper}</small>
                </span>
                <span className="record-status">{active ? '记下来啦' : '轻点一下'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="record-section-card">
        <h2>身体感觉</h2>
        <div className="segmented">
          {['轻松', '还可以', '很累'].map((item) => (
            <button
              className={energy === item ? 'is-active' : ''}
              key={item}
              onClick={() => {
                setEnergy(item);
                markUnsaved();
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="record-section-card">
        <h2>饮食状态</h2>
        <div className="segmented wide">
          {['正常吃了', '吃少了', '有点乱吃'].map((item) => (
            <button
              className={appetite === item ? 'is-active' : ''}
              key={item}
              onClick={() => {
                setAppetite(item);
                markUnsaved();
              }}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      <article className="summary-card record-summary">
        <Sticker src={goodnightSheep} alt="晚安绵羊贴纸" className="summary-sticker" />
        <span className="record-summary-badge">{feedback.badge}</span>
        <h2>{feedback.title}</h2>
        <p>{feedback.body}</p>
      </article>

      <button className={`record-save ${saved ? 'is-saved' : ''}`} onClick={saveTodayRecord} type="button">
        <Save size={18} />
        {saved ? '今日已签到' : '保存记录并签到'}
      </button>
    </section>
  );
}

function LibraryPage({ state, setState, setActiveTab }) {
  const [category, setCategory] = useState('夜班后');
  const [applied, setApplied] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const templates = planTemplates;
  const categories = planCategories;
  const visibleTemplates = category === '全部' ? templates : templates.filter((item) => item.category === category);
  const recommended =
    templates.find((item) => item.state.status === state.status && item.state.condition === state.condition) ||
    templates.find((item) => item.category === state.status) ||
    templates[0];

  function applyTemplate(template) {
    setState(template.state);
    setApplied(template.title);
  }

  return (
    <section className="sub-page library-page">
      <div className="sub-title-row">
        <div>
          <h1>计划库</h1>
          <p>把动作和吃饭拆简单，照着做就好。</p>
        </div>
        <Sticker src={libraryCat} alt="侦探猫贴纸" className="title-sticker" />
      </div>

      <article className="library-recommend">
        <div className="recommend-icon">
          <BookOpen size={20} />
        </div>
        <div>
          <span>按当前状态推荐</span>
          <h2>{recommended.title}</h2>
          <p>{recommended.text}</p>
        </div>
        <button onClick={() => applyTemplate(recommended)} type="button">套用</button>
      </article>

      <div className="category-scroll">
        {categories.map((item) => (
          <button className={item === category ? 'is-active' : ''} key={item} onClick={() => setCategory(item)} type="button">
            {item}
          </button>
        ))}
      </div>

      {applied && (
        <div className="applied-banner">
          <Sparkles size={16} />
          已套用「{applied}」，可以回到今日计划查看。
          <button onClick={() => setActiveTab('today')} type="button">去看看</button>
        </div>
      )}

      <div className="template-list">
        {visibleTemplates.map((template) => (
          <button
            className="template-card"
            key={template.title}
            onClick={() => setSelectedTemplate(template)}
            type="button"
          >
            <div>
              <h2>{template.title}</h2>
              <span>{template.meta}</span>
              <p>{template.text}</p>
              <div className="template-tags">
                {template.tags.map((tag) => (
                  <em key={tag}>{tag}</em>
                ))}
              </div>
            </div>
            <Sticker src={template.sticker} alt={`${template.title}贴纸`} className="template-sticker" />
            <div className="template-actions">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  applyTemplate(template);
                }}
                type="button"
              >
                套用
              </button>
              <ChevronRight size={18} />
            </div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <TemplateDetailSheet
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onApply={() => {
            applyTemplate(selectedTemplate);
            setSelectedTemplate(null);
          }}
        />
      )}
    </section>
  );
}

function StickersPage({ state }) {
  const [category, setCategory] = useState('今日推荐');
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [favorites, setFavorites] = useLocalStorageState('sticker-favorites', ['慢慢来']);
  const recommendedSticker = recommendStickerForState(state);
  const [todaySticker, setTodaySticker] = useState(recommendedSticker);
  const [todayQuoteId, setTodayQuoteId] = useState(() => quoteForSticker(recommendedSticker).id);
  const visibleStickers = stickersForCategory(category, state);
  const todayQuote = quoteForSticker(todaySticker, todayQuoteId);
  const favoriteStickers = favorites.map(stickerByLabel).filter(Boolean).slice(0, 5);
  const displayCategories = stickerCategories.filter((item) => item !== '白班日');

  function toggleFavorite(label) {
    setFavorites((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
  }

  function shuffleTodayQuote() {
    const next = nextTodayContent(todaySticker, todayQuoteId, state);
    setTodaySticker(next.sticker);
    setTodayQuoteId(next.quoteId);
  }

  function openSticker(sticker) {
    setSelectedSticker(sticker);
  }

  return (
    <section className="sub-page sticker-page">
      <article className="energy-hero sticker-today-card">
        <div className="sticker-today-copy">
          <span className="sticker-today-label">今日推荐</span>
          <h1>今天陪你说一句</h1>
          <p className="sticker-today-quote">{todayQuote.text}</p>
          <div className="sticker-today-actions">
            <button className="sticker-action-btn" onClick={shuffleTodayQuote} type="button">
              <Sparkles size={15} />
              换一句
            </button>
            <button
              className={favorites.includes(todaySticker.label) ? 'sticker-action-btn is-active' : 'sticker-action-btn'}
              onClick={() => toggleFavorite(todaySticker.label)}
              type="button"
            >
              <Heart size={15} />
              {favorites.includes(todaySticker.label) ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
        <button className="today-sticker-card" onClick={() => openSticker(todaySticker)} type="button">
          <Sticker src={todaySticker.src} alt={`${todaySticker.label}贴纸`} />
          <strong>{todaySticker.label}</strong>
          <span>{todaySticker.scene}</span>
        </button>
      </article>

      <div className="category-scroll">
        {displayCategories.map((item) => (
          <button className={item === category ? 'is-active' : ''} key={item} onClick={() => setCategory(item)} type="button">
            {item}
          </button>
        ))}
      </div>

      <section className="sticker-favorites-section">
        <div className="sticker-section-head">
          <h2>我的收藏</h2>
          {favoriteStickers.length > 0 && <span>{favorites.length} 张</span>}
        </div>
        {favoriteStickers.length > 0 ? (
          <div className="favorite-sticker-row">
            {favoriteStickers.map((item) => (
              <button className="favorite-sticker-chip" key={item.id} onClick={() => openSticker(item)} type="button">
                <Sticker src={item.src} alt={`${item.label}贴纸`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="favorite-empty">还没有收藏，看到喜欢的贴纸可以先收起来。</p>
        )}
      </section>

      <section className="sticker-grid-section">
        <div className="sticker-section-head">
          <h2>{category}</h2>
          <span>{visibleStickers.length} 张</span>
        </div>
        <div className="sticker-grid">
          {visibleStickers.map((item) => {
            const isFavorite = favorites.includes(item.label);
            return (
              <button className={`sticker-tile ${item.tone}`} key={item.id} onClick={() => openSticker(item)} type="button">
                {isFavorite && (
                  <span className="sticker-fav-mark" aria-label="已收藏">
                    <Heart size={12} fill="currentColor" />
                  </span>
                )}
                <Sticker src={item.src} alt={`${item.label}贴纸`} />
                <strong>{item.label}</strong>
                <span>{item.scene}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSticker && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={() => setSelectedSticker(null)}>
          <section className="sticker-detail-sheet" role="dialog" aria-modal="true" aria-label={`${selectedSticker.label}详情`} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <Sticker src={selectedSticker.src} alt={`${selectedSticker.label}贴纸`} className="big-sticker-preview" />
            <h2>{selectedSticker.label}</h2>
            <span className="sticker-detail-scene">{selectedSticker.scene}</span>
            <p>{quoteForSticker(selectedSticker).text}</p>
            <div className="detail-sheet-actions sticker-actions">
              <button className="secondary" onClick={() => setSelectedSticker(null)} type="button">收起</button>
              <button className="primary" onClick={() => toggleFavorite(selectedSticker.label)} type="button">
                {favorites.includes(selectedSticker.label) ? '取消收藏' : '收藏这张'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function SettingOption({ active, children, onClick }) {
  return (
    <button className={active ? 'is-active' : ''} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function ProfileSheetActions({ onCancel, onSave, saveLabel = '保存设置' }) {
  return (
    <div className="profile-sheet-actions">
      <button className="secondary" onClick={onCancel} type="button">取消</button>
      <button className="profile-sheet-primary" onClick={onSave} type="button">{saveLabel}</button>
    </div>
  );
}

const reminderOptions = ['下班后', '睡醒后', '睡前', '休息日中午', '关闭提醒'];
const trainingPlaceOptions = ['健身房', '家里', '速食便利店'];
const trainingDurationOptions = ['15分钟', '30分钟', '45分钟', '60分钟'];
const foodPreferenceOptions = ['正常吃饭', '夜班后小份恢复', '便利店优先', '少油少刺激'];

function ProfilePage() {
  const [protectMode, setProtectMode] = useLocalStorageState('profile-protect-mode', true);
  const [nightMode, setNightMode] = useLocalStorageState('profile-night-mode', true);
  const [reminderTime, setReminderTime] = useLocalStorageState('profile-reminder-time', '下班后');
  const [trainingPreference, setTrainingPreference] = useLocalStorageState('profile-training-preference', {
    place: '健身房',
    duration: '30分钟',
  });
  const [foodPreference, setFoodPreference] = useLocalStorageState('profile-food-preference', '正常吃饭');
  const [careHistory] = useLocalStorageState('care-history', []);
  const [stickerFavorites] = useLocalStorageState('sticker-favorites', ['慢慢来']);
  const [activeSheet, setActiveSheet] = useState(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileDraft, setProfileDraft] = useState(null);
  const [reminderDraft, setReminderDraft] = useState(reminderTime);
  const [trainingDraft, setTrainingDraft] = useState(trainingPreference);
  const [foodDraft, setFoodDraft] = useState(foodPreference);
  const [profile, setProfile] = useLocalStorageState('profile', {
    name: '今天也慢慢来',
    goal: '夜班后恢复 + 轻塑形',
    avatar: logoCat,
    avatarType: 'preset',
  });
  const [session, setSession] = useState(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState('登录后可以把计划、记录和个人设置同步到云端。');
  const [cloudSnapshot, setCloudSnapshot] = useState(null);
  const careStreak = calculateCareStreak(careHistory);
  const nightRecoveryCount = countNightRecoveries(careHistory);
  const favoriteCount = Array.isArray(stickerFavorites) ? stickerFavorites.length : 0;
  const avatarOptions = [
    { label: '元气', src: logoCat },
    { label: '慢慢来', src: umbrellaCat },
    { label: '加油', src: cheerRabbit },
    { label: '恢复', src: goodnightSheep },
    { label: '喜欢', src: loveBear },
    { label: 'OK', src: okBear },
  ];
  const settings = [
    { id: 'reminder', title: '提醒时间', value: reminderTime, icon: CalendarDays },
    { id: 'food', title: '饮食偏好', value: foodPreference, icon: Utensils },
    {
      id: 'training',
      title: '训练偏好',
      value: `${trainingPreference.place} · ${trainingPreference.duration}`,
      icon: Dumbbell,
    },
    { id: 'sync', title: '数据备份', value: session ? '已登录' : '登录同步', icon: Save },
  ];

  useEffect(() => {
    if (!supabase) {
      setSyncStatus('还没有配置 Supabase，同步功能暂时不可用。');
      return undefined;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session || null);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;

    let cancelled = false;

    async function prepareCloudSnapshot() {
      setSyncBusy(true);
      try {
        const snapshot = await downloadSnapshot(userId);
        if (cancelled) return;

        if (!snapshot) {
          await uploadSnapshot(userId);
          if (!cancelled) {
            setCloudSnapshot(null);
            setSyncStatus('首次登录，已把这台设备的数据备份到云端。');
          }
          return;
        }

        setCloudSnapshot(snapshot);
        setSyncStatus('已找到云端数据。可以恢复云端，也可以用本机数据覆盖云端。');
      } catch (error) {
        if (!cancelled) setSyncStatus(`同步检查失败：${error.message}`);
      } finally {
        if (!cancelled) setSyncBusy(false);
      }
    }

    prepareCloudSnapshot();

    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

  async function sendLoginLink() {
    if (!supabase) {
      setSyncStatus('Supabase 还没有配置好。');
      return;
    }

    const email = loginEmail.trim();
    if (!email || !email.includes('@')) {
      setSyncStatus('先输入一个能收邮件的邮箱。');
      return;
    }

    setSyncBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: import.meta.env.VITE_AUTH_REDIRECT_URL || window.location.origin,
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSyncStatus('登录邮件已发送。去邮箱点一下链接，回来后会自动登录。');
    } catch (error) {
      setSyncStatus(`登录邮件发送失败：${error.message}`);
    } finally {
      setSyncBusy(false);
    }
  }

  async function saveLocalToCloud() {
    const userId = session?.user?.id;
    if (!userId) return;

    setSyncBusy(true);
    try {
      await uploadSnapshot(userId);
      const snapshot = await downloadSnapshot(userId);
      setCloudSnapshot(snapshot);
      setSyncStatus('已把本机数据同步到云端。');
    } catch (error) {
      setSyncStatus(`上传失败：${error.message}`);
    } finally {
      setSyncBusy(false);
    }
  }

  function useCloudSnapshot() {
    if (!cloudSnapshot?.data) {
      setSyncStatus('还没有可恢复的云端数据。');
      return;
    }

    restoreLocalSnapshot(cloudSnapshot.data);
    setSyncStatus('已恢复云端数据，页面马上刷新。');
    window.setTimeout(() => window.location.reload(), 450);
  }

  async function signOut() {
    if (!supabase) return;
    setSyncBusy(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setCloudSnapshot(null);
      setSyncStatus('已退出登录。本机数据还会保留在这台设备上。');
    } catch (error) {
      setSyncStatus(`退出失败：${error.message}`);
    } finally {
      setSyncBusy(false);
    }
  }

  function openProfileEdit() {
    setProfileDraft({ ...profile });
    setEditingProfile(true);
  }

  function closeProfileEdit() {
    setEditingProfile(false);
    setProfileDraft(null);
  }

  function saveProfileEdit() {
    if (profileDraft) setProfile(profileDraft);
    closeProfileEdit();
  }

  function openSettingSheet(id) {
    if (id === 'reminder') setReminderDraft(reminderTime);
    if (id === 'training') setTrainingDraft({ ...trainingPreference });
    if (id === 'food') setFoodDraft(foodPreference);
    setActiveSheet(id);
  }

  function closeSettingSheet() {
    setActiveSheet(null);
  }

  function saveReminder() {
    setReminderTime(reminderDraft);
    closeSettingSheet();
  }

  function saveTraining() {
    setTrainingPreference(trainingDraft);
    closeSettingSheet();
  }

  function saveFood() {
    setFoodPreference(foodDraft);
    closeSettingSheet();
  }

  const draftProfile = profileDraft || profile;

  return (
    <section className="sub-page profile-page">
      <article className="profile-hero-card">
        <button className="profile-main profile-edit-trigger" onClick={openProfileEdit} type="button">
          <Sticker src={profile.avatar} alt="头像贴纸" className="profile-avatar" />
          <div>
            <h1>{profile.name}</h1>
            <p>目标：{profile.goal}</p>
          </div>
          <span>编辑</span>
        </button>
        <button className={protectMode ? 'protect-pill is-on' : 'protect-pill'} onClick={() => setProtectMode(!protectMode)} type="button">
          {protectMode ? '小白保护已开启' : '开启小白保护'}
        </button>
      </article>

      <article className="sync-panel sync-panel-live">
        <div>
          <h2>远程登录与同步</h2>
          <p>{syncStatus}</p>
          {session?.user?.email && <span className="sync-account">{session.user.email}</span>}
        </div>
        {session ? (
          <div className="sync-actions">
            <button disabled={syncBusy} onClick={saveLocalToCloud} type="button">同步本机</button>
            <button disabled={syncBusy || !cloudSnapshot} onClick={useCloudSnapshot} type="button">恢复云端</button>
            <button disabled={syncBusy} onClick={signOut} type="button">退出</button>
          </div>
        ) : (
          <div className="sync-login">
            <input
              inputMode="email"
              onChange={(event) => setLoginEmail(event.target.value)}
              placeholder="输入邮箱"
              type="email"
              value={loginEmail}
            />
            <button disabled={syncBusy} onClick={sendLoginLink} type="button">
              {syncBusy ? '发送中' : '登录同步'}
            </button>
          </div>
        )}
      </article>

      <section className="profile-stats">
        <article>
          <strong>{careStreak}天</strong>
          <span>连续照顾自己</span>
        </article>
        <article>
          <strong>{nightRecoveryCount}次</strong>
          <span>夜班后恢复</span>
        </article>
        <article>
          <strong>{favoriteCount}张</strong>
          <span>收藏贴纸</span>
        </article>
      </section>

      <section className="profile-switches">
        <button className={nightMode ? 'switch-row is-on' : 'switch-row'} onClick={() => setNightMode(!nightMode)} type="button">
          <span>
            <Moon size={18} />
            夜班模式
          </span>
          <em>{nightMode ? '开' : '关'}</em>
        </button>
        <button className={protectMode ? 'switch-row is-on' : 'switch-row'} onClick={() => setProtectMode(!protectMode)} type="button">
          <span>
            <ShieldCheck size={18} />
            小白保护模式
          </span>
          <em>{protectMode ? '开' : '关'}</em>
        </button>
      </section>

      <div className="settings-list profile-settings">
        {settings.map(({ id, title, value, icon: Icon }) => (
          <button key={id} onClick={() => openSettingSheet(id)} type="button">
            <span className="setting-icon">
              <Icon size={17} />
            </span>
            <span className="setting-copy">
              <strong>{title}</strong>
              <small>{value}</small>
            </span>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>

      <article className="profile-note-card">
        <div>
          <h2>今天也不用着急</h2>
          <p>你不用一下子做到完美。先吃好一点、动一点、早点休息，就已经是在认真照顾自己啦。</p>
        </div>
        <Sticker src={umbrellaCat} alt="慢慢来猫贴纸" />
      </article>

      {activeSheet === 'reminder' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="提醒时间设置" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>提醒时间</h2>
            <p>选一个你最容易打开 App 的时间就好。</p>
            <div className="setting-options">
              {reminderOptions.map((item) => (
                <SettingOption active={reminderDraft === item} key={item} onClick={() => setReminderDraft(item)}>
                  {item}
                </SettingOption>
              ))}
            </div>
            <ProfileSheetActions onCancel={closeSettingSheet} onSave={saveReminder} />
          </section>
        </div>
      )}

      {activeSheet === 'training' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="训练偏好设置" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>训练偏好</h2>
            <p>默认值只是帮你少点几下，随时可以改。</p>
            <h3 className="setting-group-title">默认训练地点</h3>
            <div className="setting-options">
              {trainingPlaceOptions.map((item) => (
                <SettingOption
                  active={trainingDraft.place === item}
                  key={item}
                  onClick={() => setTrainingDraft((current) => ({ ...current, place: item }))}
                >
                  {item}
                </SettingOption>
              ))}
            </div>
            <h3 className="setting-group-title">默认训练时长</h3>
            <div className="setting-option-grid">
              {trainingDurationOptions.map((item) => (
                <SettingOption
                  active={trainingDraft.duration === item}
                  key={item}
                  onClick={() => setTrainingDraft((current) => ({ ...current, duration: item }))}
                >
                  {item}
                </SettingOption>
              ))}
            </div>
            <ProfileSheetActions onCancel={closeSettingSheet} onSave={saveTraining} />
          </section>
        </div>
      )}

      {activeSheet === 'food' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="饮食偏好设置" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>饮食偏好</h2>
            <p>不是限制你吃什么，只是让建议更贴近你。</p>
            <div className="setting-options">
              {foodPreferenceOptions.map((item) => (
                <SettingOption active={foodDraft === item} key={item} onClick={() => setFoodDraft(item)}>
                  {item}
                </SettingOption>
              ))}
            </div>
            <ProfileSheetActions onCancel={closeSettingSheet} onSave={saveFood} />
          </section>
        </div>
      )}

      {activeSheet === 'sync' && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeSettingSheet}>
          <section className="profile-setting-sheet" role="dialog" aria-modal="true" aria-label="数据备份" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>数据备份</h2>
            <p>这个功能后续会接上。现在计划和记录会先保存在你的手机里，刷新也不会丢。</p>
            <button className="profile-sheet-primary" onClick={closeSettingSheet} type="button">知道了</button>
          </section>
        </div>
      )}

      {editingProfile && profileDraft && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={closeProfileEdit}>
          <section className="profile-edit-sheet" role="dialog" aria-modal="true" aria-label="编辑个人资料" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <h2>编辑个人资料</h2>
            <p>头像和昵称都可以自己来，参与感会更强一点。</p>

            <div className="profile-edit-preview">
              <Sticker src={draftProfile.avatar} alt="当前头像" className="profile-avatar large" />
              <div>
                <strong>{draftProfile.name}</strong>
                <span>{draftProfile.goal}</span>
              </div>
            </div>

            <label className="profile-field">
              <span>昵称</span>
              <input
                value={draftProfile.name}
                onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))}
              />
            </label>

            <label className="profile-field">
              <span>当前目标</span>
              <textarea
                rows={2}
                value={draftProfile.goal}
                onChange={(event) => setProfileDraft((current) => ({ ...current, goal: event.target.value }))}
              />
            </label>

            <section className="avatar-picker">
              <h3>选择内置贴纸头像</h3>
              <div>
                {avatarOptions.map((item) => (
                  <button
                    className={draftProfile.avatar === item.src ? 'is-active' : ''}
                    key={item.label}
                    onClick={() => setProfileDraft((current) => ({ ...current, avatar: item.src, avatarType: 'preset' }))}
                    type="button"
                  >
                    <Sticker src={item.src} alt={`${item.label}头像`} />
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </section>

            <label className="upload-avatar">
              <input
                accept="image/*"
                type="file"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = () => {
                    setProfileDraft((current) => ({ ...current, avatar: reader.result, avatarType: 'upload' }));
                  };
                  reader.readAsDataURL(file);
                }}
              />
              上传自己的图片
            </label>

            <ProfileSheetActions onCancel={closeProfileEdit} onSave={saveProfileEdit} saveLabel="保存我的资料" />
          </section>
        </div>
      )}
    </section>
  );
}

function Header() {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-avatar">
          <Sticker src={logoCat} alt="今日可爱能量头像" />
        </span>
        <strong>今日可爱能量</strong>
      </div>
      <button className="calendar-link" type="button">
        <CalendarDays size={18} />
        计划日历
      </button>
    </header>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState('today');
  const [state, setState] = useLocalStorageState('today-plan-state', {
    time: '30分钟',
    status: '夜班后',
    condition: '健身房',
  });
  const plan = useMemo(() => buildPlan(state.time, state.status, state.condition), [state]);
  const isNightRecovery = state.status === '夜班后';

  return (
    <main className="app-stage">
      <div className={`mobile-shell ${isNightRecovery ? 'night-recovery' : ''}`}>
        <Header />
        {activeTab === 'today' && <TodayPage state={state} setState={setState} plan={plan} />}
        {activeTab === 'record' && <RecordPage state={state} />}
        {activeTab === 'library' && <LibraryPage state={state} setState={setState} setActiveTab={setActiveTab} />}
        {activeTab === 'stickers' && <StickersPage state={state} />}
        {activeTab === 'profile' && <ProfilePage />}

        <nav className="bottom-nav" aria-label="底部导航">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button className={activeTab === id ? 'is-active' : ''} key={id} onClick={() => setActiveTab(id)} type="button">
              <Icon size={21} strokeWidth={activeTab === id ? 2.6 : 2.2} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </main>
  );
}

createRoot(document.getElementById('root')).render(<App />);
