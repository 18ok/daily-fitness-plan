import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  Cloud,
  Droplets,
  Info,
  Pencil,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';
import { localDateKey } from '../../lib/careHistory';
import { monthCalendarDays, shiftMonth } from '../../lib/calendarDates';
import {
  calculateCycleSummary,
  normalizeCycleLogs,
  removeCycleLog,
  upsertCycleLog,
} from '../../lib/cycleTracking';
import {
  deleteCycleLogRemote,
  fetchCycleLogs,
  upsertCycleLogRemote,
} from '../../lib/cycleTrackingRepository';
import { supabase } from '../../lib/supabaseClient';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const bleedingOptions = [
  { value: 'spotting', label: '点滴' },
  { value: 'light', label: '少量' },
  { value: 'medium', label: '中等' },
  { value: 'heavy', label: '较多' },
];
const symptomOptions = ['腹部不适', '腰酸', '头痛', '疲惫', '情绪波动', '睡眠不佳'];

function dateFromKey(key) {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatMonth(date) {
  return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: 'long' }).format(date);
}

function formatSelectedDate(key) {
  return new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }).format(dateFromKey(key));
}

function formatRange(range) {
  if (!range?.start || !range?.end) return '';
  const start = dateFromKey(range.start);
  const end = dateFromKey(range.end);
  const startText = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endText = start.getMonth() === end.getMonth()
    ? `${end.getDate()}日`
    : `${end.getMonth() + 1}月${end.getDate()}日`;
  return `${startText} - ${endText}`;
}

function isWithinRange(key, range) {
  return Boolean(range?.start && range?.end && key >= range.start && key <= range.end);
}

function blankForm(date) {
  return {
    date,
    bleedingLevel: '',
    symptoms: [],
    note: '',
  };
}

export function PlanCalendar() {
  const [planHistory] = useLocalStorageState('daily-plan-history', []);
  const [careHistory] = useLocalStorageState('care-history', []);
  const [cycleLogs, setCycleLogs] = useLocalStorageState('cycle-logs', []);
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState(() => blankForm(todayKey));
  const [signedIn, setSignedIn] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const days = useMemo(() => monthCalendarDays(visibleMonth), [visibleMonth]);
  const normalizedCycleLogs = useMemo(() => normalizeCycleLogs(cycleLogs), [cycleLogs]);
  const cycleByDate = useMemo(
    () => new Map(normalizedCycleLogs.map((entry) => [entry.date, entry])),
    [normalizedCycleLogs],
  );
  const cycleSummary = useMemo(() => calculateCycleSummary(normalizedCycleLogs), [normalizedCycleLogs]);
  const plansByDate = useMemo(
    () => new Map((Array.isArray(planHistory) ? planHistory : []).map((entry) => [entry.date, entry])),
    [planHistory],
  );
  const careByDate = useMemo(
    () => new Map((Array.isArray(careHistory) ? careHistory : []).map((entry) => [entry.date, entry])),
    [careHistory],
  );
  const selectedPlan = plansByDate.get(selectedDate);
  const selectedCare = careByDate.get(selectedDate);
  const selectedCycle = cycleByDate.get(selectedDate);
  const selectedCount = [selectedPlan, selectedCare, selectedCycle].filter(Boolean).length;
  const isFutureDate = selectedDate > todayKey;

  useEffect(() => {
    let active = true;

    async function loadCloudLogs() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      setSignedIn(true);

      try {
        const remoteLogs = await fetchCycleLogs();
        if (!active) return;
        const merged = normalizeCycleLogs([...normalizedCycleLogs, ...remoteLogs]);
        setCycleLogs(merged);
        setSyncMessage(remoteLogs.length ? '经期记录已与云端同步' : '');
      } catch {
        if (active) setSyncMessage('暂时无法读取云端，本机记录仍可正常使用');
      }
    }

    loadCloudLogs();
    return () => {
      active = false;
    };
    // Only hydrate when the calendar opens; local updates are handled explicitly below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function moveMonth(amount) {
    const next = shiftMonth(visibleMonth, amount);
    setVisibleMonth(next);
    setSelectedDate(localDateKey(next));
    setEditorOpen(false);
  }

  function returnToToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
    setEditorOpen(false);
  }

  function openEditor() {
    if (isFutureDate) return;
    setForm(selectedCycle
      ? {
          date: selectedCycle.date,
          bleedingLevel: selectedCycle.bleedingLevel || '',
          symptoms: [...selectedCycle.symptoms],
          note: selectedCycle.note,
        }
      : blankForm(selectedDate));
    setSyncMessage('');
    setEditorOpen(true);
  }

  function toggleSymptom(symptom) {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom],
    }));
  }

  async function saveCycleLog() {
    if (!form.bleedingLevel && form.symptoms.length === 0 && !form.note.trim()) {
      setSyncMessage('至少选择一项情况，或者写下一句身体感受');
      return;
    }

    const entry = {
      ...form,
      bleedingLevel: form.bleedingLevel || null,
      note: form.note.trim(),
      updatedAt: new Date().toISOString(),
    };
    const nextLogs = upsertCycleLog(normalizedCycleLogs, entry);
    setCycleLogs(nextLogs);
    setSaving(true);
    setEditorOpen(false);

    if (signedIn) {
      try {
        await upsertCycleLogRemote(entry);
        setSyncMessage('已保存，并同步到云端');
      } catch {
        setSyncMessage('已保存在本机，云端稍后再同步');
      }
    } else {
      setSyncMessage('已保存在本机，登录后可同步到云端');
    }

    setSaving(false);
  }

  async function deleteCycleLog() {
    if (!selectedCycle) return;
    setCycleLogs(removeCycleLog(normalizedCycleLogs, selectedDate));
    setSaving(true);
    setEditorOpen(false);

    if (signedIn) {
      try {
        await deleteCycleLogRemote(selectedDate);
        setSyncMessage('这天的经期记录已删除');
      } catch {
        setSyncMessage('本机记录已删除，云端删除暂时失败');
      }
    } else {
      setSyncMessage('这天的本机记录已删除');
    }

    setSaving(false);
  }

  return (
    <section className="sub-page calendar-page">
      <div className="calendar-title-row">
        <div>
          <span>每天留下一个小脚印</span>
          <h1>计划日历</h1>
        </div>
        <button onClick={returnToToday} type="button">今天</button>
      </div>

      <section className="cycle-overview" aria-live="polite">
        <span className="cycle-overview-icon"><Droplets size={19} /></span>
        <div>
          <strong>
            {cycleSummary.status === 'ok' ? '下次经期参考范围' : '记录经期变化'}
          </strong>
          <p>
            {cycleSummary.status === 'ok'
              ? `${formatRange(cycleSummary.nextEstimate)}，根据你最近的记录估算`
              : '记录至少两次经期开始时间后，才能形成个人趋势'}
          </p>
        </div>
        <Info size={16} aria-label="仅供个人趋势参考，不是医学诊断" />
      </section>

      <section className="calendar-board" aria-label="计划日历">
        <div className="calendar-month-bar">
          <button aria-label="上个月" onClick={() => moveMonth(-1)} title="上个月" type="button">
            <ChevronLeft size={21} />
          </button>
          <strong>{formatMonth(visibleMonth)}</strong>
          <button aria-label="下个月" onClick={() => moveMonth(1)} title="下个月" type="button">
            <ChevronRight size={21} />
          </button>
        </div>

        <div className="calendar-weekdays" aria-hidden="true">
          {weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}
        </div>

        <div className="calendar-grid">
          {days.map((item) => {
            const hasPlan = plansByDate.has(item.key);
            const hasCare = careByDate.has(item.key);
            const cycleLog = cycleByDate.get(item.key);
            const isPredicted = !cycleLog && isWithinRange(item.key, cycleSummary.nextEstimate);
            const classNames = [
              'calendar-day',
              item.inCurrentMonth ? '' : 'is-outside',
              item.key === todayKey ? 'is-today' : '',
              item.key === selectedDate ? 'is-selected' : '',
              cycleLog ? 'has-cycle-log' : '',
              isPredicted ? 'is-cycle-predicted' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                aria-label={`${item.key}${hasPlan ? '，已有计划' : ''}${hasCare ? '，已签到' : ''}${cycleLog ? '，有经期记录' : ''}${isPredicted ? '，经期参考范围' : ''}`}
                className={classNames}
                key={item.key}
                onClick={() => {
                  setSelectedDate(item.key);
                  setEditorOpen(false);
                }}
                type="button"
              >
                <span>{item.day}</span>
                <i className="calendar-marks">
                  {hasPlan && <b className="plan-mark" />}
                  {hasCare && <b className="care-mark" />}
                  {cycleLog && <b className="cycle-mark" />}
                </i>
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="plan-mark" />计划</span>
          <span><i className="care-mark" />签到</span>
          <span><i className="cycle-mark" />经期记录</span>
          <span><i className="cycle-predicted-mark" />参考范围</span>
        </div>
      </section>

      <section className="calendar-day-detail" aria-live="polite">
        <div className="calendar-detail-head">
          <div>
            <span>{selectedDate === todayKey ? '今天' : '当天记录'}</span>
            <h2>{formatSelectedDate(selectedDate)}</h2>
          </div>
          {selectedCount > 0 && <em>{selectedCount}项</em>}
        </div>

        {!selectedPlan && !selectedCare && !selectedCycle && (
          <div className="calendar-empty">
            <CalendarDays size={24} />
            <strong>这天还没有记录</strong>
            <p>{isFutureDate ? '未来日期暂时不能记录身体情况。' : '可以生成计划、签到，或记录当天的身体情况。'}</p>
          </div>
        )}

        {selectedPlan && (
          <article className="calendar-detail-item plan-detail">
            <span className="calendar-detail-icon"><Sparkles size={18} /></span>
            <div>
              <strong>今日计划</strong>
              <p>{selectedPlan.selections?.status} · {selectedPlan.selections?.time} · {selectedPlan.selections?.condition}</p>
              <small>{selectedPlan.plan?.trainingTitle}，{selectedPlan.plan?.foodTitle}</small>
            </div>
            <em>{selectedPlan.saved ? '已保存' : '已生成'}</em>
          </article>
        )}

        {selectedCare && (
          <article className="calendar-detail-item care-detail">
            <span className="calendar-detail-icon"><CircleCheck size={18} /></span>
            <div>
              <strong>照顾记录</strong>
              <p>{selectedCare.status} · {selectedCare.energy} · {selectedCare.appetite}</p>
              <small>完成了 {selectedCare.checks?.length || 0} 项小照顾</small>
            </div>
            <em>已签到</em>
          </article>
        )}

        {selectedCycle && (
          <article className="calendar-detail-item cycle-detail">
            <span className="calendar-detail-icon"><Droplets size={18} /></span>
            <div>
              <strong>身体记录</strong>
              <p>{bleedingOptions.find((item) => item.value === selectedCycle.bleedingLevel)?.label || '无出血记录'}</p>
              <small>
                {[...selectedCycle.symptoms, selectedCycle.note].filter(Boolean).join(' · ') || '没有补充其他感受'}
              </small>
            </div>
            <button aria-label="修改身体记录" onClick={openEditor} title="修改" type="button">
              <Pencil size={16} />
            </button>
          </article>
        )}

        {!isFutureDate && !editorOpen && (
          <button className="cycle-record-button" onClick={openEditor} type="button">
            <Droplets size={17} />
            {selectedCycle ? '修改这天的身体记录' : '记录这天的身体情况'}
          </button>
        )}

        {syncMessage && !editorOpen && (
          <p className="cycle-sync-message">
            {signedIn && <Cloud size={14} />}
            {syncMessage}
          </p>
        )}
      </section>

      {editorOpen && (
        <div className="cycle-editor-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setEditorOpen(false);
        }}>
          <section aria-label="身体情况记录" aria-modal="true" className="cycle-editor" role="dialog">
            <div className="cycle-editor-head">
              <div>
                <span>{formatSelectedDate(selectedDate)}</span>
                <h2>{selectedCycle ? '修改身体记录' : '记录身体情况'}</h2>
              </div>
              <button aria-label="关闭" onClick={() => setEditorOpen(false)} title="关闭" type="button">
                <X size={20} />
              </button>
            </div>

            <fieldset>
              <legend>今天的经量</legend>
              <div className="cycle-choice-grid">
                {bleedingOptions.map((option) => (
                  <button
                    aria-pressed={form.bleedingLevel === option.value}
                    className={form.bleedingLevel === option.value ? 'is-active' : ''}
                    key={option.value}
                    onClick={() => setForm((current) => ({
                      ...current,
                      bleedingLevel: current.bleedingLevel === option.value ? '' : option.value,
                    }))}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <small>“点滴”只做当天记录，不会自动算作一次经期开始。</small>
            </fieldset>

            <fieldset>
              <legend>身体感受</legend>
              <div className="cycle-symptom-list">
                {symptomOptions.map((symptom) => (
                  <button
                    aria-pressed={form.symptoms.includes(symptom)}
                    className={form.symptoms.includes(symptom) ? 'is-active' : ''}
                    key={symptom}
                    onClick={() => toggleSymptom(symptom)}
                    type="button"
                  >
                    {symptom}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="cycle-note">
              <span>想留给自己的一句话（选填）</span>
              <textarea
                maxLength={120}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="例如：今天有点累，训练换成了散步。"
                rows={3}
                value={form.note}
              />
              <small>{form.note.length}/120</small>
            </label>

            {syncMessage && <p className="cycle-editor-message">{syncMessage}</p>}

            <div className="cycle-editor-actions">
              {selectedCycle && (
                <button className="cycle-delete-button" disabled={saving} onClick={deleteCycleLog} type="button">
                  <Trash2 size={17} />
                  删除
                </button>
              )}
              <button className="cycle-save-button" disabled={saving} onClick={saveCycleLog} type="button">
                {saving ? '保存中' : '保存记录'}
              </button>
            </div>

            <p className="cycle-privacy-note">
              这些内容属于个人健康记录，仅用于观察自己的变化，不提供医学诊断。
            </p>
          </section>
        </div>
      )}
    </section>
  );
}
