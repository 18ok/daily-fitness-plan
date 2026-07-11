import React, { useState } from 'react';
import {
  Dumbbell,
  Heart,
  Save,
  ShieldCheck,
  Sparkles,
  Utensils,
} from 'lucide-react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { localDateKey, upsertCareRecord } from '../../lib/careHistory';
import { Sticker } from '../../components/common/Sticker';
import { buildRecordFeedback, recordCompanionText } from './recordFeedback';

import goodnightSheep from '../../../assets/stickers/cute-energy/illustrations_clean/07_goodnight_sheep.png';
import healingCat from '../../../assets/stickers/cute-energy/illustrations_clean/11_healing_cat.png';

export function RecordPage({ state }) {
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
