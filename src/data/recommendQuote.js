import { getQuoteById, quotesForSticker } from './quoteLibrary';
import { stickerCatalog } from './stickerCatalog';

export { quotesForSticker } from './quoteLibrary';
export { stickerByLabel } from './stickerCatalog';

export function recommendStickerForState(state) {
  if (state?.status === '夜班后') {
    return stickerCatalog.find((item) => item.id === 'night_recover');
  }

  if (state?.status === '很累') {
    return stickerCatalog.find((item) => item.id === 'recovering');
  }

  if (state?.status === '白班') {
    return stickerCatalog.find((item) => item.id === 'workday');
  }

  return stickerCatalog.find((item) => item.id === 'slowly_today') || stickerCatalog[0];
}

export function quoteForSticker(sticker, quoteId) {
  if (quoteId) return getQuoteById(quoteId);
  const quoteIds = sticker?.quoteIds?.[0];
  return getQuoteById(quoteIds);
}

export function nextTodayContent(sticker, quoteId, state) {
  const quotes = quotesForSticker(sticker);
  const quoteIndex = quotes.findIndex((item) => item.id === quoteId);

  if (quotes.length > 1) {
    const nextQuote = quotes[(quoteIndex + 1) % quotes.length];
    return { sticker, quoteId: nextQuote.id };
  }

  const pool = stickersForCategory('今日推荐', state);
  const stickerIndex = pool.findIndex((item) => item.id === sticker.id);
  const nextSticker = pool[(stickerIndex + 1) % pool.length] || pool[0];
  const nextQuotes = quotesForSticker(nextSticker);
  return { sticker: nextSticker, quoteId: nextQuotes[0].id };
}

export function stickersForCategory(category, state) {
  if (category !== '今日推荐') {
    return stickerCatalog.filter((item) => item.category === category);
  }

  const recommended = recommendStickerForState(state);
  const recommendedIds = new Set([recommended?.id, 'slowly_today', 'love_you', 'magic_plan']);
  return stickerCatalog.filter((item) => recommendedIds.has(item.id)).slice(0, 6);
}
