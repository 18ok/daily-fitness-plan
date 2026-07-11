import React from 'react';
import {
  Dumbbell,
  Heart,
  Home,
  Moon,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Sun,
  Utensils,
} from 'lucide-react';
import { Sticker } from '../../components/common/Sticker';

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

export function TemplateDetailSheet({ template, onClose, onApply }) {
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
