import React, { useState } from 'react';
import { Heart, Sparkles } from 'lucide-react';
import { Sticker } from '../../components/common/Sticker';
import { nextTodayContent, quoteForSticker, recommendStickerForState, stickerByLabel, stickersForCategory } from '../../data/recommendQuote';
import { stickerCategories } from '../../data/stickerCatalog';
import { useLocalStorageState } from '../../hooks/useLocalStorageState';

export function StickersPage({ state }) {
  const [category, setCategory] = useState('今日推荐');
  const [selectedSticker, setSelectedSticker] = useState(null);
  const [favorites, setFavorites] = useLocalStorageState('sticker-favorites', ['慢慢来']);
  const recommendedSticker = recommendStickerForState(state);
  const [todaySticker, setTodaySticker] = useState(recommendedSticker);
  const [todayQuoteId, setTodayQuoteId] = useState(() => quoteForSticker(recommendedSticker).id);
  const visibleStickers = stickersForCategory(category, state);
  const todayQuote = quoteForSticker(todaySticker, todayQuoteId);
  const favoriteStickers = favorites.map(stickerByLabel).filter(Boolean).slice(0, 5);
  const displayCategories = stickerCategories.filter((item) => item !== '白班日');

  function toggleFavorite(label) {
    setFavorites((current) => (current.includes(label) ? current.filter((item) => item !== label) : [...current, label]));
  }

  function shuffleTodayQuote() {
    const next = nextTodayContent(todaySticker, todayQuoteId, state);
    setTodaySticker(next.sticker);
    setTodayQuoteId(next.quoteId);
  }

  function openSticker(sticker) {
    setSelectedSticker(sticker);
  }

  return (
    <section className="sub-page sticker-page">
      <article className="energy-hero sticker-today-card">
        <div className="sticker-today-copy">
          <span className="sticker-today-label">今日推荐</span>
          <h1>今天陪你说一句</h1>
          <p className="sticker-today-quote">{todayQuote.text}</p>
          <div className="sticker-today-actions">
            <button className="sticker-action-btn" onClick={shuffleTodayQuote} type="button">
              <Sparkles size={15} />
              换一句
            </button>
            <button
              className={favorites.includes(todaySticker.label) ? 'sticker-action-btn is-active' : 'sticker-action-btn'}
              onClick={() => toggleFavorite(todaySticker.label)}
              type="button"
            >
              <Heart size={15} />
              {favorites.includes(todaySticker.label) ? '已收藏' : '收藏'}
            </button>
          </div>
        </div>
        <button className="today-sticker-card" onClick={() => openSticker(todaySticker)} type="button">
          <Sticker src={todaySticker.src} alt={`${todaySticker.label}贴纸`} />
          <strong>{todaySticker.label}</strong>
          <span>{todaySticker.scene}</span>
        </button>
      </article>

      <div className="category-scroll">
        {displayCategories.map((item) => (
          <button className={item === category ? 'is-active' : ''} key={item} onClick={() => setCategory(item)} type="button">
            {item}
          </button>
        ))}
      </div>

      <section className="sticker-favorites-section">
        <div className="sticker-section-head">
          <h2>我的收藏</h2>
          {favoriteStickers.length > 0 && <span>{favorites.length} 张</span>}
        </div>
        {favoriteStickers.length > 0 ? (
          <div className="favorite-sticker-row">
            {favoriteStickers.map((item) => (
              <button className="favorite-sticker-chip" key={item.id} onClick={() => openSticker(item)} type="button">
                <Sticker src={item.src} alt={`${item.label}贴纸`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        ) : (
          <p className="favorite-empty">还没有收藏，看到喜欢的贴纸可以先收起来。</p>
        )}
      </section>

      <section className="sticker-grid-section">
        <div className="sticker-section-head">
          <h2>{category}</h2>
          <span>{visibleStickers.length} 张</span>
        </div>
        <div className="sticker-grid">
          {visibleStickers.map((item) => {
            const isFavorite = favorites.includes(item.label);
            return (
              <button className={`sticker-tile ${item.tone}`} key={item.id} onClick={() => openSticker(item)} type="button">
                {isFavorite && (
                  <span className="sticker-fav-mark" aria-label="已收藏">
                    <Heart size={12} fill="currentColor" />
                  </span>
                )}
                <Sticker src={item.src} alt={`${item.label}贴纸`} />
                <strong>{item.label}</strong>
                <span>{item.scene}</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedSticker && (
        <div className="detail-sheet-backdrop" role="presentation" onClick={() => setSelectedSticker(null)}>
          <section className="sticker-detail-sheet" role="dialog" aria-modal="true" aria-label={`${selectedSticker.label}详情`} onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <Sticker src={selectedSticker.src} alt={`${selectedSticker.label}贴纸`} className="big-sticker-preview" />
            <h2>{selectedSticker.label}</h2>
            <span className="sticker-detail-scene">{selectedSticker.scene}</span>
            <p>{quoteForSticker(selectedSticker).text}</p>
            <div className="detail-sheet-actions sticker-actions">
              <button className="secondary" onClick={() => setSelectedSticker(null)} type="button">收起</button>
              <button className="primary" onClick={() => toggleFavorite(selectedSticker.label)} type="button">
                {favorites.includes(selectedSticker.label) ? '取消收藏' : '收藏这张'}
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
