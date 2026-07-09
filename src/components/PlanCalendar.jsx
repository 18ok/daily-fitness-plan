import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, CircleCheck, Sparkles } from 'lucide-react';
import { useLocalStorageState } from '../hooks/useLocalStorageState';
import { localDateKey } from '../lib/careHistory';
import { monthCalendarDays, shiftMonth } from '../lib/calendarDates';

const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

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

export function PlanCalendar() {
  const [planHistory] = useLocalStorageState('daily-plan-history', []);
  const [careHistory] = useLocalStorageState('care-history', []);
  const today = useMemo(() => new Date(), []);
  const todayKey = localDateKey(today);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const days = useMemo(() => monthCalendarDays(visibleMonth), [visibleMonth]);
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

  function moveMonth(amount) {
    const next = shiftMonth(visibleMonth, amount);
    setVisibleMonth(next);
    setSelectedDate(localDateKey(next));
  }

  function returnToToday() {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(todayKey);
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
            const classNames = [
              'calendar-day',
              item.inCurrentMonth ? '' : 'is-outside',
              item.key === todayKey ? 'is-today' : '',
              item.key === selectedDate ? 'is-selected' : '',
            ].filter(Boolean).join(' ');

            return (
              <button
                aria-label={`${item.key}${hasPlan ? '，已有计划' : ''}${hasCare ? '，已签到' : ''}`}
                className={classNames}
                key={item.key}
                onClick={() => setSelectedDate(item.key)}
                type="button"
              >
                <span>{item.day}</span>
                <i className="calendar-marks">
                  {hasPlan && <b className="plan-mark" />}
                  {hasCare && <b className="care-mark" />}
                </i>
              </button>
            );
          })}
        </div>

        <div className="calendar-legend">
          <span><i className="plan-mark" />已生成计划</span>
          <span><i className="care-mark" />已签到记录</span>
        </div>
      </section>

      <section className="calendar-day-detail" aria-live="polite">
        <div className="calendar-detail-head">
          <div>
            <span>{selectedDate === todayKey ? '今天' : '当天记录'}</span>
            <h2>{formatSelectedDate(selectedDate)}</h2>
          </div>
          {(selectedPlan || selectedCare) && <em>{[selectedPlan, selectedCare].filter(Boolean).length}项</em>}
        </div>

        {!selectedPlan && !selectedCare && (
          <div className="calendar-empty">
            <CalendarDays size={24} />
            <strong>这天还没有记录</strong>
            <p>生成计划或保存今日记录后，会自动出现在这里。</p>
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
      </section>
    </section>
  );
}
