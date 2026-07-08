import logoCat from '../../assets/stickers/cat-companion/illustrations_clean/02_sailor_flag_cat.png';
import planCat from '../../assets/stickers/cat-companion/illustrations_clean/05_magic_wand_cat.png';
import umbrellaCat from '../../assets/stickers/cat-companion/illustrations_clean/09_kimono_umbrella_cat.png';
import cheerRabbit from '../../assets/stickers/cute-energy/illustrations_clean/10_cheer_rabbit.png';
import goodnightSheep from '../../assets/stickers/cute-energy/illustrations_clean/07_goodnight_sheep.png';
import okBear from '../../assets/stickers/cute-energy/illustrations_clean/22_ok_bear.png';
import healingCat from '../../assets/stickers/cute-energy/illustrations_clean/11_healing_cat.png';
import workingRabbit from '../../assets/stickers/cute-energy/illustrations_clean/19_working_rabbit.png';
import loveBear from '../../assets/stickers/cute-energy/illustrations_clean/01_love_bear.png';

export const stickerCategories = ['今日推荐', '夜班后', '训练前', '完成后', '很累', '鼓励', '白班日'];

export const stickerCatalog = [
  {
    id: 'slowly_today',
    label: '慢慢来',
    category: '今日推荐',
    src: umbrellaCat,
    tone: 'mint',
    scene: '适合打开 App 的第一眼',
    quoteIds: ['general_slow_001'],
  },
  {
    id: 'night_recover',
    label: '夜班后先恢复',
    category: '夜班后',
    src: goodnightSheep,
    tone: 'lavender',
    scene: '适合下夜班回家前',
    quoteIds: ['night_shift_001', 'night_shift_002'],
  },
  {
    id: 'tiny_cheer',
    label: '加油一点点',
    category: '训练前',
    src: cheerRabbit,
    tone: 'pink',
    scene: '适合训练前没动力时',
    quoteIds: ['training_start_001'],
  },
  {
    id: 'recovering',
    label: '恢复中',
    category: '很累',
    src: healingCat,
    tone: 'mint',
    scene: '适合疲劳和头晕时',
    quoteIds: ['tired_001', 'tired_002'],
  },
  {
    id: 'done_ok',
    label: 'OK啦',
    category: '完成后',
    src: okBear,
    tone: 'lemon',
    scene: '适合完成记录后',
    quoteIds: ['done_001'],
  },
  {
    id: 'workday',
    label: '工作中',
    category: '白班日',
    src: workingRabbit,
    tone: 'lavender',
    scene: '适合白班下班后',
    quoteIds: ['day_shift_001'],
  },
  {
    id: 'love_you',
    label: '喜欢你',
    category: '鼓励',
    src: loveBear,
    tone: 'pink',
    scene: '适合情绪低落时',
    quoteIds: ['comfort_001'],
  },
  {
    id: 'magic_plan',
    label: '魔法一下',
    category: '鼓励',
    src: planCat,
    tone: 'lemon',
    scene: '适合生成计划前',
    quoteIds: ['plan_001'],
  },
];

export const stickerAssets = {
  logoCat,
  planCat,
  umbrellaCat,
  cheerRabbit,
  goodnightSheep,
  okBear,
  healingCat,
  workingRabbit,
  loveBear,
};

export function stickerByLabel(label) {
  return stickerCatalog.find((item) => item.label === label);
}
