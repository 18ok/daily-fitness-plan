import { BarChart3, CalendarDays, CircleUserRound, Folder, MessageCircle } from 'lucide-react';

const tabs = [
  { id: 'today', label: '今日计划', icon: CalendarDays },
  { id: 'record', label: '记录', icon: BarChart3 },
  { id: 'library', label: '计划库', icon: Folder },
  { id: 'stickers', label: '能量贴纸', icon: MessageCircle },
  { id: 'profile', label: '我的', icon: CircleUserRound },
];

export function BottomNavigation({ activeTab, onTabChange }) {
  return (
    <nav className="bottom-nav" aria-label="底部导航">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button className={activeTab === id ? 'is-active' : ''} key={id} onClick={() => onTabChange(id)} type="button">
          <Icon size={21} strokeWidth={activeTab === id ? 2.6 : 2.2} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
