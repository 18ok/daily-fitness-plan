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
import { getCycleTrainingAdjustment } from '../../lib/cycleTrainingAdjustment';
import {
  deleteCycleLogRemote,
  fetchCycleLogs,
  upsertCycleLogRemote,
} from '../../lib/cycleTrackingRepository';
import { canSyncCycleLogs, normalizeCycleSyncSettings } from '../../lib/cycleSyncConsent';
import { supabase } from '../../lib/supabaseClient';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];
const bleedingOptions = [
  { value: 'spotting', label: '点滴' },
  { value: 'light', label: '少量' },
  { value: 'medium', label: '中等' },
  { value: 'heavy', label: '较多' },
];
const symptomOptions = ['腹部不适', '腰酸', '头痛', '疲惫', '情绪波动', '睡眠不佳'];
const periodStatusOptions = [
  { value: 'started', label: '今天开始' },
  { value: 'ongoing', label: '进行中' },
  { value: 'ended', label: '结束今天的经期' },
  { value: 'not_started', label: '今天没有开始' },
];
const sleepOptions = [
  { value: 'poor', label: '较差' },
  { value: 'normal', label: '一般' },
  { value: 'good', label: '不错' },
];
const redFlagOptions = [
  { value: 'dizziness', label: '头晕' },
  { value: 'abnormal_bleeding', label: '异常出血' },
];

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
    periodStatus: null,
    bleedingLevel: '',
    symptoms: [],
    painLevel: null,
    energyLevel: null,
    sleepQuality: '',
    redFlags: [],
    note: '',
  };
}

function isPeriodRecord(log) {
  return Boolean(log?.periodStatus || log?.bleedingLevel);
}

function cycleStatusLabel(value) {
  return periodStatusOptions.find((option) => option.value === value)?.label || '';
}

export function PlanCalendar() {
  const [planHistory] = useLocalStorageState('daily-plan-history', []);
  const [careHistory] = useLocalStorageState('care-history', []);
  const [cycleLogs, setCycleLogs] = useLocalStorageState('cycle-logs', []);
  const [cycleSettings, setCycleSettings] = useLocalStorageState('cycle-settings', { cloudSyncConsent: false });
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
  const normalizedCycleSettings = useMemo(() => normalizeCycleSyncSettings(cycleSettings), [cycleSettings]);
  const cycleCloudSyncEnabled = canSyncCycleLogs(signedIn, normalizedCycleSettings);
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
  const selectedTrainingAdjustment = useMemo(
    () => (selectedCycle ? getCycleTrainingAdjustment(selectedCycle) : null),
    [selectedCycle],
  );
  const selectedCount = [selectedPlan, selectedCare, selectedCycle].filter(Boolean).length;
  const isFutureDate = selectedDate > todayKey;

  useEffect(() => {
    let active = true;

    async function loadSession() {
      if (!supabase) return;
      const { data } = await supabase.auth.getSession();
      if (!active || !data.session) return;
      setSignedIn(true);
    }

    loadSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function loadCloudLogs() {
      if (!cycleCloudSyncEnabled) return;
      try {
        const remoteLogs = await fetchCycleLogs();
        if (!active) return;
        setCycleLogs((current) => normalizeCycleLogs([...current, ...remoteLogs]));
        setSyncMessage(remoteLogs.length ? '经期记录已与云端同步' : '');
      } catch {
        if (active) setSyncMessage('暂时无法读取云端，本机记录仍可正常使用');
      }
    }

    loadCloudLogs();
    return () => {
      active = false;
    };
  }, [cycleCloudSyncEnabled, setCycleLogs]);

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

  function openEditorForDate(dateKey) {
    if (dateKey > todayKey) return;
    const cycle = cycleByDate.get(dateKey);
    setSelectedDate(dateKey);
    setForm(cycle
      ? {
          date: cycle.date,
          periodStatus: cycle.periodStatus || null,
          bleedingLevel: cycle.bleedingLevel || '',
          symptoms: [...cycle.symptoms],
          painLevel: cycle.painLevel,
          energyLevel: cycle.energyLevel,
          sleepQuality: cycle.sleepQuality || '',
          redFlags: [...cycle.redFlags],
          note: cycle.note,
        }
      : blankForm(dateKey));
    setSyncMessage('');
    setEditorOpen(true);
  }

  function openEditor() {
    openEditorForDate(selectedDate);
  }

  function openTodayEditor() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    openEditorForDate(todayKey);
  }

  function toggleSymptom(symptom) {
    setForm((current) => ({
      ...current,
      symptoms: current.symptoms.includes(symptom)
        ? current.symptoms.filter((item) => item !== symptom)
        : [...current.symptoms, symptom],
    }));
  }

  function toggleRedFlag(redFlag) {
    setForm((current) => ({
      ...current,
      redFlags: current.redFlags.includes(redFlag)
        ? current.redFlags.filter((item) => item !== redFlag)
        : [...current.redFlags, redFlag],
    }));
  }

  function updateCloudSyncConsent(enabled) {
    setCycleSettings({ cloudSyncConsent: enabled === true });
    setSyncMessage(enabled
      ? '已允许同步；云端仅会保存你之后明确记录的经期和身体状态。'
      : '已关闭云端同步，新的经期和身体状态记录仅保存在这台设备。');
  }

  async function saveCycleLog() {
    if (
      !form.periodStatus
      && !form.bleedingLevel
      && form.symptoms.length === 0
      && form.painLevel === null
      && form.energyLevel === null
      && !form.sleepQuality
      && form.redFlags.length === 0
      && !form.note.trim()
    ) {
      setSyncMessage('至少记录一项身体情况，或者写下一句感受。');
      return;
    }

    const entry = {
      ...form,
      periodStatus: form.periodStatus === 'not_started' ? null : form.periodStatus || null,
      bleedingLevel: form.bleedingLevel || null,
      sleepQuality: form.sleepQuality || null,
      note: form.note.trim(),
      updatedAt: new Date().toISOString(),
    };
    const nextLogs = upsertCycleLog(normalizedCycleLogs, entry);
    setCycleLogs(nextLogs);
    setSaving(true);
    setEditorOpen(false);

    if (cycleCloudSyncEnabled) {
      try {
        await upsertCycleLogRemote(entry);
        setSyncMessage('已保存，并同步到云端');
      } catch {
        setSyncMessage('已保存在本机，云端稍后再同步');
      }
    } else {
      setSyncMessage(signedIn
        ? '已保存在本机；你尚未同意同步到云端。'
        : '已保存在本机，登录后可选择是否同步到云端。');
    }

    setSaving(false);
  }

  async function deleteCycleLog() {
    if (!selectedCycle) return;
    setCycleLogs(removeCycleLog(normalizedCycleLogs, selectedDate));
    setSaving(true);
    setEditorOpen(false);

    if (cycleCloudSyncEnabled) {
      try {
        await deleteCycleLogRemote(selectedDate);
        setSyncMessage('这天的经期记录已删除');
      } catch {
        setSyncMessage('本机记录已删除，云端删除暂时失败');
      }
    } else {
      setSyncMessage(signedIn
        ? '这天的本机记录已删除；云端同步尚未启用。'
        : '这天的本机记录已删除。');
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

      <section className="cycle-sync-consent" aria-live="polite">
        {signedIn ? (
          <label>
            <input
              checked={normalizedCycleSettings.cloudSyncConsent}
              onChange={(event) => updateCloudSyncConsent(event.target.checked)}
              type="checkbox"
            />
            <span>
              允许将经期和身体状态同步到我的账户
              <small>仅用于在你的设备间恢复记录；可随时关闭，不用于医疗诊断。</small>
            </span>
          </label>
        ) : (
          <p>经期和身体状态记录仅保存在这台设备。</p>
        )}
        {signedIn && !normalizedCycleSettings.cloudSyncConsent && (
          <p>未开启前，记录仅保存在这台设备。</p>
        )}
      </section>

      <button className="cycle-today-record-button" onClick={openTodayEditor} type="button">
        <Droplets size={18} />
        记录今天
      </button>

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
            const hasPeriodRecord = isPeriodRecord(cycleLog);
            const hasBodyRecord = Boolean(cycleLog && !hasPeriodRecord);
            const isPredicted = !hasPeriodRecord && isWithinRange(item.key, cycleSummary.nextEstimate);
            const classNames = [
              'calendar-day',
              item.inCurrentMonth ? '' : 'is-outside',
              item.key === todayKey ? 'is-today' : '',
              item.key === selectedDate ? 'is-selected' : '',
              hasPeriodRecord ? 'has-period-record' : '',
              hasBodyRecord ? 'has-body-record' : '',
              isPredicted ? 'is-cycle-predicted' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                aria-label={`${item.key}${hasPlan ? '，已有计划' : ''}${hasCare ? '，已签到' : ''}${hasPeriodRecord ? '，已记录经期' : ''}${hasBodyRecord ? '，有身体状态记录' : ''}${isPredicted ? '，经期参考范围' : ''}`}
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
                  {hasPeriodRecord && <b className="cycle-mark" />}
                  {hasBodyRecord && <b className="body-mark" />}
                </i>
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="plan-mark" />计划</span>
          <span><i className="care-mark" />签到</span>
          <span><i className="cycle-mark" />已记录经期</span>
          <span><i className="body-mark" />身体状态</span>
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
              <p>{[
                cycleStatusLabel(selectedCycle.periodStatus),
                bleedingOptions.find((item) => item.value === selectedCycle.bleedingLevel)?.label,
              ].filter(Boolean).join(' · ') || '身体状态记录'}</p>
              <small>
                {[
                  selectedCycle.painLevel !== null ? `疼痛 ${selectedCycle.painLevel}/10` : '',
                  selectedCycle.energyLevel !== null ? `精力 ${selectedCycle.energyLevel}/10` : '',
                  sleepOptions.find((item) => item.value === selectedCycle.sleepQuality)?.label,
                  ...selectedCycle.symptoms,
                  selectedCycle.note,
                ].filter(Boolean).join(' · ') || '没有补充其他感受'}
              </small>
            </div>
            <button aria-label="编辑已记录的身体状态" onClick={openEditor} title="修改" type="button">
              <Pencil size={16} />
            </button>
          </article>
        )}

        {selectedTrainingAdjustment && (
          <article className={`cycle-training-adjustment is-${selectedTrainingAdjustment.level}`}>
            <span className="calendar-detail-icon"><Sparkles size={18} /></span>
            <div>
              <strong>{selectedTrainingAdjustment.title}</strong>
              {selectedTrainingAdjustment.reasons.length > 0 && (
                <p>{selectedTrainingAdjustment.reasons.join(' · ')}</p>
              )}
              <small>{selectedTrainingAdjustment.suggestion}</small>
              {selectedTrainingAdjustment.requiresCareNotice && (
                <em>这不是医疗诊断。</em>
              )}
            </div>
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
            {cycleCloudSyncEnabled && <Cloud size={14} />}
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
              <legend>经期今天的状态</legend>
              <div className="cycle-status-grid">
                {periodStatusOptions.map((option) => (
                  <button
                    aria-pressed={form.periodStatus === option.value}
                    className={form.periodStatus === option.value ? 'is-active' : ''}
                    key={option.value || 'not-started'}
                    onClick={() => setForm((current) => ({ ...current, periodStatus: option.value }))}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <small>经期是连续事件：开始、进行中和结束可以按天补记或修改。</small>
            </fieldset>

            <fieldset>
              <legend>今天的出血量</legend>
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
              <legend>疼痛程度</legend>
              <div className="cycle-score-grid">
                {Array.from({ length: 11 }, (_, value) => (
                  <button
                    aria-label={`疼痛 ${value}`}
                    aria-pressed={form.painLevel === value}
                    className={form.painLevel === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => setForm((current) => ({
                      ...current,
                      painLevel: current.painLevel === value ? null : value,
                    }))}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
              <small>0 是没有疼痛，10 是最强烈。疼痛较强时会建议今天先暂停训练。</small>
            </fieldset>

            <fieldset>
              <legend>精力程度</legend>
              <div className="cycle-score-grid">
                {Array.from({ length: 11 }, (_, value) => (
                  <button
                    aria-label={`精力 ${value}`}
                    aria-pressed={form.energyLevel === value}
                    className={form.energyLevel === value ? 'is-active' : ''}
                    key={value}
                    onClick={() => setForm((current) => ({
                      ...current,
                      energyLevel: current.energyLevel === value ? null : value,
                    }))}
                    type="button"
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>昨晚睡眠</legend>
              <div className="cycle-sleep-grid">
                {sleepOptions.map((option) => (
                  <button
                    aria-pressed={form.sleepQuality === option.value}
                    className={form.sleepQuality === option.value ? 'is-active' : ''}
                    key={option.value}
                    onClick={() => setForm((current) => ({
                      ...current,
                      sleepQuality: current.sleepQuality === option.value ? '' : option.value,
                    }))}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
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

            <fieldset>
              <legend>需要留意的信号</legend>
              <div className="cycle-red-flag-list">
                {redFlagOptions.map((option) => (
                  <button
                    aria-pressed={form.redFlags.includes(option.value)}
                    className={form.redFlags.includes(option.value) ? 'is-active' : ''}
                    key={option.value}
                    onClick={() => toggleRedFlag(option.value)}
                    type="button"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <small>如果出现异常出血、明显头晕或令你担心的症状，请暂停训练并及时就医。</small>
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
