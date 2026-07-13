import React, { useState } from 'react';
import { localDateKey } from '../../lib/careHistory';
import { recentExerciseHistory, upsertExerciseLog } from '../../lib/exerciseHistory';
import { availableDumbbellLoads, availableKettlebellLoads, selectedGymMachines } from '../../lib/trainingProfile';

const feedbackOptions = [
  { value: 'too_easy', label: '太轻松' },
  { value: 'just_right', label: '刚刚好' },
  { value: 'somewhat_hard', label: '有点吃力' },
  { value: 'uncomfortable', label: '不舒服' },
];

function completedReps(targetReps) {
  const values = String(targetReps || '').match(/\d+/g)?.map(Number) || [];
  return Math.max(...values, 1);
}

function usesMinutes(targetReps) {
  return String(targetReps || '').includes('分钟');
}

function feedbackLabel(feedback) {
  return feedbackOptions.find((item) => item.value === feedback)?.label || '还没有记录感受';
}

function resultText(log) {
  if (!log) return '上次：还没有记录';
  const equipment = log.equipment || (log.loadKg === null ? '徒手' : `${log.loadKg}kg`);
  const load = log.loadKg === null ? '' : ` ${log.loadKg}kg`;
  const resistance = log.resistance ? ` ${log.resistance}` : '';
  return `上次：${equipment}${load}${resistance} · ${log.sets.length} 组 · ${feedbackLabel(log.feedback)}`;
}

function emptyDraft() {
  return {
    load: null, machineLoad: '', completedSetIndexes: [], feedback: '', note: '', resistance: '', saved: false,
  };
}

export function AdaptiveWorkoutCard({ exerciseHistory, onSaveLog, profile, workout }) {
  const [openMovementId, setOpenMovementId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const ownedLoads = availableDumbbellLoads(profile);
  const hasBodyweight = profile?.equipment?.bodyweight === true;
  const hasEquipment = hasBodyweight
    || ownedLoads.length > 0
    || profile?.equipment?.bands === true
    || availableKettlebellLoads(profile).length > 0
    || selectedGymMachines(profile).length > 0;
  const profileNeedsSetup = !hasEquipment;

  if (!workout) return null;

  function draftFor(movementId) {
    return drafts[movementId] || emptyDraft();
  }

  function updateDraft(movementId, update) {
    setDrafts((current) => {
      const next = { ...current };
      next[movementId] = update({ ...draftFor(movementId), ...(current[movementId] || {}) });
      return next;
    });
  }

  function toggleSet(movementId, setIndex) {
    updateDraft(movementId, (draft) => ({
      ...draft,
      saved: false,
      completedSetIndexes: draft.completedSetIndexes.includes(setIndex)
        ? draft.completedSetIndexes.filter((item) => item !== setIndex)
        : [...draft.completedSetIndexes, setIndex].sort((left, right) => left - right),
    }));
  }

  function saveMovement(movement) {
    const draft = draftFor(movement.id);
    const reps = completedReps(movement.targetReps);
    const isReady = draft.load !== null
      && draft.completedSetIndexes.length === movement.sets
      && Boolean(draft.feedback);
    if (!isReady) return;

    onSaveLog((current) => upsertExerciseLog(current, {
      exerciseId: movement.id,
      exerciseName: movement.name,
      date: localDateKey(),
      equipment: movement.equipmentLabel,
      feedback: draft.feedback,
      loadKg: typeof draft.load === 'number'
        ? draft.load
        : (movement.loadKind === 'machine' && Number(draft.machineLoad) > 0 ? Number(draft.machineLoad) : null),
      resistance: movement.loadKind === 'band' ? draft.resistance : '',
      sets: Array.from({ length: movement.sets }, () => ({ plannedReps: reps, completedReps: reps })),
      note: draft.note,
    }));
    updateDraft(movement.id, (current) => ({ ...current, saved: true }));
  }

  return (
    <section className={`adaptive-workout-card is-${workout.mode}`} aria-live="polite">
      <div className="adaptive-workout-heading">
        <span>本次训练记录</span>
        <h3>今天做什么？</h3>
        <p>{workout.safetyNotice}</p>
      </div>

      {workout.mode === 'suggest_rest' ? (
        <p className="adaptive-safety-notice">今天先不记录重量，按上面的提醒休息或做舒缓活动。</p>
      ) : (
        <div className="adaptive-movement-list">
          {workout.movements.map((movement, index) => {
            const draft = draftFor(movement.id);
            const isOpen = openMovementId === movement.id;
            const history = recentExerciseHistory(exerciseHistory, movement.id, 3);
            const reps = completedReps(movement.targetReps);
            const unit = usesMinutes(movement.targetReps) ? '分钟' : '次';
            const needsWeight = movement.loadKind === 'load';
            const readyToSave = draft.load !== null
              && draft.completedSetIndexes.length === movement.sets
              && Boolean(draft.feedback);

            return (
              <article className={`adaptive-movement ${isOpen ? 'is-open' : ''}`} key={movement.id}>
                <div className="adaptive-movement-summary">
                  <div>
                    <span className="adaptive-movement-number">动作 {index + 1}</span>
                    <h4>{movement.name}</h4>
                    <p>{movement.equipmentLabel} · {movement.sets} 组 · {movement.targetReps}</p>
                    <small>{resultText(history[0])}</small>
                  </div>
                  <button
                    aria-expanded={isOpen}
                    className="adaptive-record-trigger"
                    onClick={() => setOpenMovementId(isOpen ? null : movement.id)}
                    type="button"
                  >
                    {isOpen ? '收起记录' : `记录第 ${index + 1} 个动作`}
                  </button>
                </div>

                <div className="adaptive-movement-details">
                  <p className="adaptive-suggestion">今天建议：{movement.suggestedLoad.guidance}</p>
                  <p className="adaptive-reason">为什么这样安排：{movement.why}</p>
                  {movement.replacement && <p className="adaptive-replacement">如果不舒服，换成：{movement.replacement}</p>}
                  <p className="adaptive-stop-hint">{movement.stopHint}</p>
                  <ol className="adaptive-history" aria-label={`${movement.name}最近三次记录`}>
                    {history.length > 0 ? history.map((log) => (
                      <li key={`${log.exerciseId}-${log.date}`}>
                        <span>{log.date}</span>
                        <span>{resultText(log).replace('上次：', '')}</span>
                      </li>
                    )) : (
                      <li>
                        <span>最近三次</span>
                        <span>还没有记录</span>
                      </li>
                    )}
                  </ol>
                </div>

                {isOpen && (
                  <div className="adaptive-movement-form">
                    <fieldset className="adaptive-fieldset">
                      <legend>实际器械和重量</legend>
                      {needsWeight ? (
                        <div className="adaptive-weight-grid">
                          {movement.availableLoads.map((load) => (
                            <button
                              aria-pressed={draft.load === load}
                              className={draft.load === load ? 'is-selected' : ''}
                              key={load}
                              onClick={() => updateDraft(movement.id, (current) => ({ ...current, load, saved: false }))}
                              type="button"
                            >
                              {load}kg
                            </button>
                          ))}
                        </div>
                      ) : movement.loadKind === 'band' ? (
                        <>
                          <button
                            aria-pressed={draft.load === 'band'}
                            className={`adaptive-bodyweight ${draft.load === 'band' ? 'is-selected' : ''}`}
                            onClick={() => updateDraft(movement.id, (current) => ({ ...current, load: 'band', saved: false }))}
                            type="button"
                          >
                            弹力带
                          </button>
                          <label className="adaptive-note" htmlFor={`adaptive-resistance-${movement.id}`}>
                            弹力带阻力（选填）
                            <input
                              id={`adaptive-resistance-${movement.id}`}
                              maxLength="120"
                              onChange={(event) => updateDraft(movement.id, (current) => ({ ...current, resistance: event.target.value, saved: false }))}
                              placeholder="例如：中等阻力"
                              value={draft.resistance}
                            />
                          </label>
                        </>
                      ) : movement.loadKind === 'machine' ? (
                        <>
                          <button
                            aria-pressed={draft.load === 'machine'}
                            className={`adaptive-bodyweight ${draft.load === 'machine' ? 'is-selected' : ''}`}
                            onClick={() => updateDraft(movement.id, (current) => ({ ...current, load: 'machine', saved: false }))}
                            type="button"
                          >
                            最轻档
                          </button>
                          <label className="adaptive-note" htmlFor={`adaptive-machine-load-${movement.id}`}>
                            这台器械的实际重量（kg，选填）
                            <input
                              id={`adaptive-machine-load-${movement.id}`}
                              inputMode="decimal"
                              min="0"
                              onChange={(event) => updateDraft(movement.id, (current) => ({ ...current, machineLoad: event.target.value, saved: false }))}
                              type="number"
                              value={draft.machineLoad}
                            />
                          </label>
                        </>
                      ) : (
                        <button
                          aria-pressed={draft.load === 'bodyweight'}
                          className={`adaptive-bodyweight ${draft.load === 'bodyweight' ? 'is-selected' : ''}`}
                          onClick={() => updateDraft(movement.id, (current) => ({ ...current, load: 'bodyweight', saved: false }))}
                          type="button"
                        >
                          {movement.equipmentLabel}
                        </button>
                      )}
                    </fieldset>

                    <fieldset className="adaptive-fieldset">
                      <legend>完成组次</legend>
                      <div className="adaptive-set-list">
                        {Array.from({ length: movement.sets }, (_, setIndex) => {
                          const isComplete = draft.completedSetIndexes.includes(setIndex);
                          return (
                            <button
                              aria-pressed={isComplete}
                              className={isComplete ? 'is-selected' : ''}
                              key={setIndex}
                              onClick={() => toggleSet(movement.id, setIndex)}
                              type="button"
                            >
                              第 {setIndex + 1} 组完成 {reps} {unit}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>

                    <fieldset className="adaptive-fieldset">
                      <legend>这组感觉怎么样？</legend>
                      <div className="adaptive-feedback-grid">
                        {feedbackOptions.map((option) => (
                          <button
                            aria-pressed={draft.feedback === option.value}
                            className={draft.feedback === option.value ? 'is-selected' : ''}
                            key={option.value}
                            onClick={() => updateDraft(movement.id, (current) => ({ ...current, feedback: option.value, saved: false }))}
                            type="button"
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </fieldset>

                    <label className="adaptive-note" htmlFor={`adaptive-note-${movement.id}`}>
                      留一句给下次的自己（选填）
                      <textarea
                        id={`adaptive-note-${movement.id}`}
                        maxLength="120"
                        onChange={(event) => updateDraft(movement.id, (current) => ({ ...current, note: event.target.value, saved: false }))}
                        placeholder="留一句给下次的自己（选填）"
                        value={draft.note}
                      />
                    </label>

                    <button
                      className="adaptive-save"
                      disabled={!readyToSave}
                      onClick={() => saveMovement(movement)}
                      type="button"
                    >
                      保存这次动作
                    </button>
                    {draft.saved && <p className="adaptive-saved">已保存到这台设备。</p>}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {profileNeedsSetup && (
        <p className="adaptive-profile-hint">补充器械和经验后，我可以告诉你先拿多重。</p>
      )}
    </section>
  );
}
