import React from 'react';
import { ScanBarcode } from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';

export type AppTab = 'home' | 'scan' | 'search' | 'diary' | 'profile';

interface TopBarProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  language: LanguageCode;
}

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  onNavigate,
  language,
}) => {
  const t = TRANSLATIONS[language];

  const links: Array<{ id: AppTab; label: string }> = [
    { id: 'home', label: t.nav.home },
    { id: 'scan', label: t.nav.scan },
    { id: 'search', label: t.nav.search },
    { id: 'diary', label: t.nav.diary },
    { id: 'profile', label: t.nav.profile },
  ];

  return (
    <header className="sticky top-0 z-30 h-14 sm:h-16 bg-white/90 dark:bg-[#0B120E]/90 backdrop-blur-md border-b border-emerald-950/10 dark:border-emerald-100/10">
      <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2.5 text-lg font-bold tracking-tight text-[#14532D] dark:text-[#EDF4EF] whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] rounded-lg py-1"
        >
          <img
            src="/src/assets/images/nutriscan_app_icon_1794893955486.jpg"
            alt="NutriScan AI"
            referrerPolicy="no-referrer"
            className="w-7 h-7 rounded-lg object-cover border border-emerald-950/10 dark:border-emerald-100/15"
          />
          <span className="font-display">{t.brand}</span>
        </button>

        <nav
          aria-label="Primary Navigation"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4C6154] dark:text-[#9BB5A4]"
        >
          {links.map((link) => {
            const active = activeTab === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate(link.id)}
                className={`py-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D] ${
                  active
                    ? 'text-[#14532D] dark:text-[#4ADE80] border-[#15803D] dark:border-[#4ADE80] font-semibold'
                    : 'border-transparent hover:text-[#111C16] dark:hover:text-[#EDF4EF]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('scan')}
            className="inline-flex items-center gap-2 px-4 py-2 min-h-[40px] rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] dark:hover:bg-[#16A34A] text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15803D]"
          >
            <ScanBarcode className="w-4 h-4" />
            <span>{t.nav.scan}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
