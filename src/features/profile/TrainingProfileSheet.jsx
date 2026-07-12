import { useState } from 'react';
import {
  AVOID_MOVEMENTS,
  DUMBBELL_PRESETS,
  normalizeBodyTrendHistory,
  normalizeTrainingProfile,
} from '../../lib/trainingProfile';
import { ModalPortal } from '../../components/common/ModalPortal';

const GOALS = [
  { value: 'habit', label: '建立习惯' },
  { value: 'shape', label: '轻松塑形' },
  { value: 'fat_loss_food', label: '减脂饮食习惯' },
];

const EXPERIENCE_OPTIONS = [
  { value: 'new', label: '从没练过' },
  { value: 'occasional', label: '偶尔练过' },
  { value: 'consistent', label: '有规律地练过' },
];

const PLACE_OPTIONS = [
  { value: 'home', label: '家里' },
  { value: 'gym', label: '健身房' },
  { value: 'outdoors', label: '户外或其它地方' },
];

const EQUIPMENT_OPTIONS = [
  { value: 'bodyweight', label: '自重' },
  { value: 'bands', label: '弹力带' },
  { value: 'kettlebell', label: '壶铃' },
  { value: 'gymMachines', label: '健身房器械' },
];

const MOVEMENT_OPTIONS = [
  { value: AVOID_MOVEMENTS[0], label: '深蹲、起身' },
  { value: AVOID_MOVEMENTS[1], label: '弯腰、硬拉' },
  { value: AVOID_MOVEMENTS[2], label: '头顶推举' },
  { value: AVOID_MOVEMENTS[3], label: '拉的动作' },
  { value: AVOID_MOVEMENTS[6], label: '跳跃动作' },
];

const FOOD_HABIT_OPTIONS = [
  { value: 'protein_first', label: '先把一餐吃踏实' },
  { value: 'regular_meals', label: '尽量规律吃饭' },
  { value: 'convenience_store', label: '准备方便的备选食物' },
];

function todayKey() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function toggleValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

function createDraft(profile, history) {
  const normalized = normalizeTrainingProfile(profile);
  const latestWeight = normalizeBodyTrendHistory(history).at(-1)?.weightKg;
  return {
    ...normalized,
    goals: normalized.goals,
    movementLimits: normalized.movementLimits,
    trainingPlaces: normalized.trainingPlaces,
    foodHabits: normalized.foodHabits,
    equipment: { ...normalized.equipment },
    heightCm: normalized.heightCm ?? '',
    weightKg: latestWeight ?? '',
  };
}

function ChoiceButton({ active, children, onClick }) {
  return (
    <button
      aria-pressed={active}
      className={active ? 'is-active' : ''}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

export function TrainingProfileSheet({ bodyTrendHistory, onClose, onSaveProfile, onSaveWeight, profile }) {
  const [draft, setDraft] = useState(() => createDraft(profile, bodyTrendHistory));
  const [customWeight, setCustomWeight] = useState('');

  function toggleDraftValue(key, value) {
    setDraft((current) => ({ ...current, [key]: toggleValue(current[key], value) }));
  }

  function toggleEquipment(value) {
    setDraft((current) => ({
      ...current,
      equipment: { ...current.equipment, [value]: !current.equipment[value] },
    }));
  }

  function togglePresetWeight(weight) {
    setDraft((current) => ({
      ...current,
      equipment: {
        ...current.equipment,
        dumbbellKg: toggleValue(current.equipment.dumbbellKg, weight).sort((left, right) => left - right),
      },
    }));
  }

  function addCustomWeight() {
    const weight = Number(customWeight);
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100) return;
    setDraft((current) => ({
      ...current,
      equipment: {
        ...current.equipment,
        customDumbbellKg: [...new Set([...current.equipment.customDumbbellKg, Number(weight.toFixed(1))])]
          .sort((left, right) => left - right),
      },
    }));
    setCustomWeight('');
  }

  function removeCustomWeight(weight) {
    setDraft((current) => ({
      ...current,
      equipment: {
        ...current.equipment,
        customDumbbellKg: current.equipment.customDumbbellKg.filter((item) => item !== weight),
      },
    }));
  }

  function saveProfile() {
    const normalizedProfile = normalizeTrainingProfile({
      ...draft,
      goal: draft.goals[0],
      equipment: draft.equipment,
    });
    const weightKg = Number(draft.weightKg);

    onSaveProfile({
      ...normalizedProfile,
      goal: normalizedProfile.goals[0] || '',
    });
    onSaveWeight(normalizeBodyTrendHistory([
      ...(Array.isArray(bodyTrendHistory) ? bodyTrendHistory : []),
      ...(Number.isFinite(weightKg) && weightKg > 0 ? [{ date: todayKey(), weightKg }] : []),
    ]));
    onClose();
  }

  return (
    <ModalPortal>
      <div className="detail-sheet-backdrop" role="presentation" onClick={onClose}>
        <section
          aria-label="训练资料设置"
          aria-modal="true"
          className="profile-setting-sheet training-profile-sheet"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <div className="sheet-handle" />
          <h2>训练资料设置</h2>
          <p>只填你愿意填的部分。它会帮你把训练建议调得更贴近现在的自己。</p>

          <section className="training-profile-section">
            <h3>你想先改善什么？</h3>
            <div className="training-profile-choice-grid">
              {GOALS.map((item) => (
                <ChoiceButton
                  active={draft.goals.includes(item.value)}
                  key={item.value}
                  onClick={() => setDraft((current) => ({ ...current, goals: [item.value] }))}
                >
                  {item.label}
                </ChoiceButton>
              ))}
            </div>
          </section>

          <section className="training-profile-section">
            <h3>你的身高和本周体重</h3>
            <div className="training-profile-fields">
              <label>
                <span>身高（cm）</span>
                <input
                  inputMode="decimal"
                  min="50"
                  onChange={(event) => setDraft((current) => ({ ...current, heightCm: event.target.value }))}
                  type="number"
                  value={draft.heightCm}
                />
              </label>
              <label>
                <span>本周体重（kg）</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setDraft((current) => ({ ...current, weightKg: event.target.value }))}
                  type="number"
                  value={draft.weightKg}
                />
              </label>
            </div>
          </section>

          <section className="training-profile-section">
            <h3>你练过吗？</h3>
            <div className="training-profile-choice-grid">
              {EXPERIENCE_OPTIONS.map((item) => (
                <ChoiceButton
                  active={draft.experienceLevel === item.value}
                  key={item.value}
                  onClick={() => setDraft((current) => ({ ...current, experienceLevel: item.value }))}
                >
                  {item.label}
                </ChoiceButton>
              ))}
            </div>
          </section>

          <section className="training-profile-section">
            <h3>你在哪里练、手边有什么？</h3>
            <div className="training-profile-choice-grid">
              {PLACE_OPTIONS.map((item) => (
                <ChoiceButton
                  active={draft.trainingPlaces.includes(item.value)}
                  key={item.value}
                  onClick={() => toggleDraftValue('trainingPlaces', item.value)}
                >
                  {item.label}
                </ChoiceButton>
              ))}
            </div>
            <div className="training-profile-choice-grid training-profile-equipment-grid">
              {EQUIPMENT_OPTIONS.map((item) => (
                <ChoiceButton
                  active={draft.equipment[item.value] === true}
                  key={item.value}
                  onClick={() => toggleEquipment(item.value)}
                >
                  {item.label}
                </ChoiceButton>
              ))}
            </div>
            <p className="training-profile-helper">有哑铃的话，选一下手边能用的重量。</p>
            <div className="training-profile-weight-grid">
              {DUMBBELL_PRESETS.map((weight) => (
                <ChoiceButton
                  active={draft.equipment.dumbbellKg.includes(weight)}
                  key={weight}
                  onClick={() => togglePresetWeight(weight)}
                >
                  {weight}kg
                </ChoiceButton>
              ))}
            </div>
            <div className="training-profile-custom-weight">
              <label>
                <span>自定义哑铃重量（kg）</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setCustomWeight(event.target.value)}
                  type="number"
                  value={customWeight}
                />
              </label>
              <button onClick={addCustomWeight} type="button">添加重量</button>
            </div>
            {draft.equipment.customDumbbellKg.length > 0 && (
              <div aria-label="已选自定义哑铃重量" className="training-profile-weight-chips">
                {draft.equipment.customDumbbellKg.map((weight) => (
                  <button key={weight} onClick={() => removeCustomWeight(weight)} type="button">
                    {weight}kg ×
                  </button>
                ))}
              </div>
            )}
            <div className="training-profile-range-fields">
              <label>
                <span>可调哑铃最轻（kg）</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    equipment: {
                      ...current.equipment,
                      adjustableDumbbellRange: {
                        ...(current.equipment.adjustableDumbbellRange || {}),
                        minKg: event.target.value,
                      },
                    },
                  }))}
                  type="number"
                  value={draft.equipment.adjustableDumbbellRange?.minKg ?? ''}
                />
              </label>
              <label>
                <span>可调哑铃最重（kg）</span>
                <input
                  inputMode="decimal"
                  min="0"
                  onChange={(event) => setDraft((current) => ({
                    ...current,
                    equipment: {
                      ...current.equipment,
                      adjustableDumbbellRange: {
                        ...(current.equipment.adjustableDumbbellRange || {}),
                        maxKg: event.target.value,
                      },
                    },
                  }))}
                  type="number"
                  value={draft.equipment.adjustableDumbbellRange?.maxKg ?? ''}
                />
              </label>
            </div>
          </section>

          <section className="training-profile-section">
            <h3>有什么动作需要避开？</h3>
            <div className="training-profile-choice-grid">
              {MOVEMENT_OPTIONS.map((item) => (
                <ChoiceButton
                  active={draft.movementLimits.includes(item.value)}
                  key={item.value}
                  onClick={() => toggleDraftValue('movementLimits', item.value)}
                >
                  {item.label}
                </ChoiceButton>
              ))}
            </div>
          </section>

          <section className="training-profile-section">
            <h3>安全确认</h3>
            <div className="training-profile-safety-options">
              <ChoiceButton
                active={draft.safetyFlag === 'none'}
                onClick={() => setDraft((current) => ({ ...current, safetyFlag: 'none' }))}
              >
                没有需要暂停训练的情况
              </ChoiceButton>
              <ChoiceButton
                active={draft.safetyFlag === 'suggest_rest'}
                onClick={() => setDraft((current) => ({ ...current, safetyFlag: 'suggest_rest' }))}
              >
                近期受伤、医生限制或需要先咨询专业人士
              </ChoiceButton>
            </div>
            {draft.safetyFlag === 'suggest_rest' && (
              <aside className="training-profile-safety-callout">
                先暂停本次训练，等确认适合再开始。这里不做诊断，也不替代医生或专业人士的建议。
              </aside>
            )}
          </section>

          {draft.goals.includes('fat_loss_food') && (
            <section className="training-profile-section">
              <h3>减脂饮食习惯</h3>
              <div className="training-profile-choice-grid">
                {FOOD_HABIT_OPTIONS.map((item) => (
                  <ChoiceButton
                    active={draft.foodHabits.includes(item.value)}
                    key={item.value}
                    onClick={() => toggleDraftValue('foodHabits', item.value)}
                  >
                    {item.label}
                  </ChoiceButton>
                ))}
              </div>
            </section>
          )}

          <p className="training-profile-local-note">身体资料默认仅保存在这台设备。</p>
          <div className="profile-sheet-actions">
            <button className="secondary" onClick={onClose} type="button">取消</button>
            <button className="profile-sheet-primary" onClick={saveProfile} type="button">保存训练资料</button>
          </div>
        </section>
      </div>
    </ModalPortal>
  );
}
