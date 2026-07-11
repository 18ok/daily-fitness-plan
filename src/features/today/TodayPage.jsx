import React, { useRef, useState } from 'react';
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
} from 'lucide-react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { localDateKey } from '../../lib/careHistory';
import { samePlanSelections, upsertDailyPlan } from '../../lib/dailyPlanHistory';
import { ResultCard } from '../../components/common/ResultCard';
import { ChoiceGroup, OptionChip } from '../../components/common/SelectionControls';
import { Sticker } from '../../components/common/Sticker';
import { PilotFeedbackPrompt } from './PilotFeedbackPrompt';

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

function browserStorageAvailable() {
  try {
    const key = '__today_storage_check__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function TodayPage({ state, setState, plan }) {
  const [planHistory, setPlanHistory] = useLocalStorageState('daily-plan-history', []);
  const [storageAvailable] = useState(browserStorageAvailable);
  const pageRef = useRef(null);
  const resultRef = useRef(null);
  const today = localDateKey();
  const validPlanHistory = Array.isArray(planHistory) ? planHistory.filter((entry) => entry?.date) : [];
  const todayEntry = validPlanHistory.find((entry) => entry.date === today);
  const isFirstVisit = validPlanHistory.length === 0 || !plan;
  const [touched, setTouched] = useState({ time: false, status: false, condition: false });
  const [isAdjusting, setIsAdjusting] = useState(isFirstVisit);
  const canPreview = Boolean(plan) && (!isFirstVisit || (touched.time && touched.status && touched.condition));
  const confirmed = samePlanSelections(todayEntry?.selections, state) && todayEntry?.saved === true;

  const update = (key, value) => {
    setTouched((current) => ({ ...current, [key]: true }));
    setState((current) => ({
      ...(current && typeof current === 'object' ? current : {}),
      [key]: value,
    }));
  };

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

  function confirmTodayPlan() {
    if (!canPreview || confirmed) return;

    const confirmedAt = new Date().toISOString();
    setPlanHistory((current) =>
      upsertDailyPlan(
        current,
        planRecord({
          generatedAt: todayEntry?.generatedAt || confirmedAt,
          saved: true,
          savedAt: confirmedAt,
        }),
      ),
    );
    setIsAdjusting(false);
  }

  const selectionIsActive = (key, value) => (!isFirstVisit || touched[key]) && state[key] === value;

  return (
    <div className="page-content" ref={pageRef}>
      {isAdjusting && (
        <section className="selector-panel">
          <Sticker src={planCat} alt="魔法猫贴纸" className="peek-sticker" />
          <h1>{isFirstVisit ? '先告诉我今天的状态' : '调整今天的状态'}</h1>

          <ChoiceGroup title="今天有多少时间？">
            <div className="time-grid">
              {timeOptions.map((time) => (
                <button
                  className={`time-chip ${selectionIsActive('time', time) ? 'is-active' : ''}`}
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
                  active={selectionIsActive('status', item.label)}
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
                  active={selectionIsActive('condition', item.label)}
                  icon={item.icon}
                  key={item.label}
                  label={item.label}
                  onClick={() => update('condition', item.label)}
                />
              ))}
            </div>
          </ChoiceGroup>
        </section>
      )}

      {canPreview && (
        <div className="today-status-summary" aria-label="当前计划状态">
          <span>{state.time}</span>
          <span>{state.status}</span>
          <span>{state.condition}</span>
          <button onClick={() => setIsAdjusting(true)} type="button">调整</button>
        </div>
      )}

      {!storageAvailable && (
        <p className="today-storage-notice">本次计划可以查看，但当前浏览器无法长期保存。</p>
      )}

      {canPreview && (
        <section className="today-panel" ref={resultRef}>
          <div className="today-strategy">
            <span>你的今日重点</span>
            <h2>{plan.note}</h2>
            <p>{plan.trainingTitle} · {plan.foodTitle}</p>
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
            detail="做到这 3 件事就很棒了"
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

          <button
            className={`confirm-plan ${confirmed ? 'is-confirmed' : ''}`}
            disabled={confirmed}
            onClick={confirmTodayPlan}
            type="button"
          >
            <Save size={17} />
            {confirmed ? '今天计划已确认' : '今天就按这个做'}
          </button>
          <PilotFeedbackPrompt
            confirmed={confirmed}
            contentVersion={1}
            date={today}
            selections={state}
          />
        </section>
      )}
    </div>
  );
}
