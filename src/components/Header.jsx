import { CalendarDays, ChevronLeft } from 'lucide-react';
import logoCat from '../../assets/stickers/cat-companion/illustrations_clean/02_sailor_flag_cat.png';
import { Sticker } from './common/Sticker';

export function Header({ calendarOpen, onCalendarToggle }) {
  return (
    <header className="app-header">
      <div className="brand">
        <span className="brand-avatar">
          <Sticker src={logoCat} alt="今日可爱能量头像" />
        </span>
        <strong>今日可爱能量</strong>
      </div>
      <button className="calendar-link" onClick={onCalendarToggle} type="button">
        {calendarOpen ? <ChevronLeft size={18} /> : <CalendarDays size={18} />}
        {calendarOpen ? '返回' : '计划日历'}
      </button>
    </header>
  );
}
