import React, { useRef } from 'react';
import {
  Dumbbell,
  Heart,
  Home,
  Moon,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Utensils,
  WandSparkles,
} from 'lucide-react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { localDateKey } from '../../lib/careHistory';
import { samePlanSelections, upsertDailyPlan } from '../../lib/dailyPlanHistory';
import { ResultCard } from '../../components/common/ResultCard';
import { ChoiceGroup, OptionChip } from '../../components/common/SelectionControls';
import { Sticker } from '../../components/common/Sticker';

import planCat from '../../../assets/stickers/cat-companion/illustrations_clean/05_magic_wand_cat.png';
import foodCat from '../../../assets/stickers/cat-companion/illustrations_clean/04_sunflower_teddy_cat.png';
import cheerRabbit from '../../../assets/stickers/cute-energy/illustrations_clean/10_cheer_rabbit.png';
import okBear from '../../../assets/stickers/cute-energy/illustrations_clean/22_ok_bear.png';
import confusedFrog from '../../../assets/stickers/cute-energy/illustrations_clean/06_frog_confused.png';

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

export function TodayPage({ state, setState, plan }) {
  const [planHistory, setPlanHistory] = useLocalStorageState('daily-plan-history', []);
  const pageRef = useRef(null);
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
    window.setTimeout(() => {
      const page = pageRef.current;
      const result = resultRef.current;
      if (!page || !result) return;
      page.scrollTo({ top: Math.max(result.offsetTop - 8, 0), behavior: 'smooth' });
    }, 80);
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
    <div className="page-content" ref={pageRef}>
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
