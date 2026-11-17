import React from 'react';
import { BookOpen, Home, ScanBarcode, Search, User } from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type { AppTab } from './TopBar';

interface BottomNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  language: LanguageCode;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onNavigate,
  language,
}) => {
  const t = TRANSLATIONS[language];

  const items: Array<{ id: AppTab; label: string; Icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'home', label: t.nav.home, Icon: Home },
    { id: 'search', label: t.nav.search, Icon: Search },
    { id: 'scan', label: t.nav.scan, Icon: ScanBarcode },
    { id: 'diary', label: t.nav.diary, Icon: BookOpen },
    { id: 'profile', label: t.nav.profile, Icon: User },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B120E]/95 backdrop-blur-md border-t border-emerald-950/10 dark:border-emerald-100/10 pb-safe"
    >
      <div className="grid grid-cols-5 items-center h-16 px-1">
        {items.map(({ id, label, Icon }) => {
          const active = activeTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 rounded-xl transition-colors cursor-pointer ${
                active
                  ? 'text-[#14532D] dark:text-[#4ADE80] font-semibold'
                  : 'text-[#4C6154] dark:text-[#9BB5A4]'
              }`}
            >
              <Icon className={`w-5 h-5 ${id === 'scan' && active ? 'scale-105' : ''}`} />
              <span className="text-[11px] leading-tight whitespace-nowrap">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
