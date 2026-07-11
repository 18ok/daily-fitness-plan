import React, { useState } from 'react';
import { BookOpen, ChevronRight, Sparkles } from 'lucide-react';
import { Sticker } from '../../components/common/Sticker';
import { planCategories, planTemplates } from '../../data/planTemplates';
import { TemplateDetailSheet } from './TemplateDetailSheet';

import libraryCat from '../../../assets/stickers/cat-companion/illustrations_clean/06_detective_cat.png';

export function LibraryPage({ state, setState, setActiveTab }) {
  const [category, setCategory] = useState('夜班后');
  const [applied, setApplied] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const templates = planTemplates;
  const categories = planCategories;
  const visibleTemplates = category === '全部' ? templates : templates.filter((item) => item.category === category);
  const recommended =
    templates.find((item) => item.state.status === state.status && item.state.condition === state.condition) ||
    templates.find((item) => item.category === state.status) ||
    templates[0];

  function applyTemplate(template) {
    setState(template.state);
    setApplied(template.title);
  }

  return (
    <section className="sub-page library-page">
      <div className="sub-title-row">
        <div>
          <h1>计划库</h1>
          <p>把动作和吃饭拆简单，照着做就好。</p>
        </div>
        <Sticker src={libraryCat} alt="侦探猫贴纸" className="title-sticker" />
      </div>

      <article className="library-recommend">
        <div className="recommend-icon">
          <BookOpen size={20} />
        </div>
        <div>
          <span>按当前状态推荐</span>
          <h2>{recommended.title}</h2>
          <p>{recommended.text}</p>
        </div>
        <button onClick={() => applyTemplate(recommended)} type="button">套用</button>
      </article>

      <div className="category-scroll">
        {categories.map((item) => (
          <button className={item === category ? 'is-active' : ''} key={item} onClick={() => setCategory(item)} type="button">
            {item}
          </button>
        ))}
      </div>

      {applied && (
        <div className="applied-banner">
          <Sparkles size={16} />
          已套用「{applied}」，可以回到今日计划查看。
          <button onClick={() => setActiveTab('today')} type="button">去看看</button>
        </div>
      )}

      <div className="template-list">
        {visibleTemplates.map((template) => (
          <button
            className="template-card"
            key={template.title}
            onClick={() => setSelectedTemplate(template)}
            type="button"
          >
            <div>
              <h2>{template.title}</h2>
              <span>{template.meta}</span>
              <p>{template.text}</p>
              <div className="template-tags">
                {template.tags.map((tag) => (
                  <em key={tag}>{tag}</em>
                ))}
              </div>
            </div>
            <Sticker src={template.sticker} alt={`${template.title}贴纸`} className="template-sticker" />
            <div className="template-actions">
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  applyTemplate(template);
                }}
                type="button"
              >
                套用
              </button>
              <ChevronRight size={18} />
            </div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <TemplateDetailSheet
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onApply={() => {
            applyTemplate(selectedTemplate);
            setSelectedTemplate(null);
          }}
        />
      )}
    </section>
  );
}
