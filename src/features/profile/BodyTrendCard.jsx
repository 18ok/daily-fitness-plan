import { useMemo, useState } from 'react';
import { buildCakeTrendSummary } from '../../lib/trainingProfile';
import { localDateKey } from '../../lib/careHistory';

const LAYER_LABELS = {
  body_trend: '身体趋势',
  completed_workouts: '完成训练',
  food_habit_days: '吃饭习惯',
};

function completedWorkoutDays(history) {
  return new Set(
    (Array.isArray(history) ? history : [])
      .filter((entry) => entry?.checks?.includes('训练完成'))
      .map((entry) => entry.date),
  ).size;
}

function foodHabitDays(history) {
  return new Set(
    (Array.isArray(history) ? history : [])
      .filter((entry) => entry?.checks?.includes('吃饭完成'))
      .map((entry) => entry.date),
  ).size;
}

export function BodyTrendCard({ bodyTrendHistory, careHistory, onSaveWeight }) {
  const [isOpen, setIsOpen] = useState(false);
  const [weightKg, setWeightKg] = useState('');
  const [saved, setSaved] = useState(false);
  const summary = useMemo(() => buildCakeTrendSummary({
    bodyTrendHistory,
    completedWorkouts: completedWorkoutDays(careHistory),
    foodHabitDays: foodHabitDays(careHistory),
  }), [bodyTrendHistory, careHistory]);

  function openCard() {
    setIsOpen(true);
  }

  function saveWeeklyWeight() {
    const nextWeight = Number(weightKg);
    if (!Number.isFinite(nextWeight) || nextWeight <= 0 || nextWeight > 500) return;

    onSaveWeight({ date: localDateKey(), weightKg: Number(nextWeight.toFixed(1)) });
    setWeightKg('');
    setSaved(true);
  }

  return (
    <article className={`body-trend-card ${isOpen ? 'is-open' : ''}`}>
      <div className="body-trend-heading">
        <div className="body-trend-title">
          <button aria-expanded={isOpen} className="body-trend-trigger" onClick={openCard} type="button">
            我的身体趋势
          </button>
          <small>{summary.label}</small>
        </div>
        <button
          aria-controls="body-trend-explanation"
          aria-expanded={isOpen}
          aria-label="查看身体趋势说明"
          className="body-trend-help"
          onClick={openCard}
          type="button"
        >
          ?
        </button>
      </div>

      {isOpen && (
        <div className="body-trend-content">
          <div aria-hidden="true" className="body-trend-cake">
            {summary.layers.map((layer) => (
              <span
                className={`body-trend-cake-layer body-trend-cake-layer--${layer.key}`}
                data-active={Number.isFinite(layer.value) && layer.value !== 0}
                key={layer.key}
              />
            ))}
          </div>
          <div className="body-trend-copy">
            <p id="body-trend-explanation">{summary.explanation}</p>
            <div aria-label="本周习惯" className="body-trend-habit-chips">
              {summary.layers.map((layer) => (
                <span className={layer.value ? 'is-active' : ''} key={layer.key}>
                  {LAYER_LABELS[layer.key]}
                </span>
              ))}
            </div>
          </div>

          <label className="body-trend-weight-field">
            <span>本周体重（kg）</span>
            <input
              inputMode="decimal"
              max="500"
              min="1"
              onChange={(event) => {
                setWeightKg(event.target.value);
                setSaved(false);
              }}
              step="0.1"
              type="number"
              value={weightKg}
            />
          </label>
          <button className="body-trend-save" onClick={saveWeeklyWeight} type="button">
            记录本周体重
          </button>
          {saved && <span className="body-trend-saved" role="status">本周记录已更新</span>}
        </div>
      )}
    </article>
  );
}
