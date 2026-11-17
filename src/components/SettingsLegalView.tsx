import React, { useState } from 'react';
import {
  ArrowLeft,
  Bell,
  Globe,
  Info,
  Mail,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import { triggerNutritionNotification } from '../services/apiClient';
import type { AppSettings, AuthUser } from '../types/nutrition';

interface SettingsLegalViewProps {
  settings: AppSettings;
  authUser: AuthUser | null;
  onUpdateSettings: (next: AppSettings) => void;
  onClearHistory: () => void;
  onDeleteAccount: () => Promise<void>;
  onBack: () => void;
}

export const SettingsLegalView: React.FC<SettingsLegalViewProps> = ({
  settings,
  authUser,
  onUpdateSettings,
  onClearHistory,
  onDeleteAccount,
  onBack,
}) => {
  const language: LanguageCode = settings.language;
  const t = TRANSLATIONS[language];

  const [legalTab, setLegalTab] = useState<'privacy' | 'terms' | 'about' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleTestReminder = async () => {
    const ok = await triggerNutritionNotification(
      'NutriScan AI',
      language === 'ur'
        ? 'آج کے کھانے کا لاگ اور غذائی خلاصہ دیکھنے کا وقت ہو گیا ہے۔'
        : 'Reminder: Log your latest meal to keep your daily nutrition summary up to date.'
    );
    setStatusMsg(
      ok
        ? 'Notification sent.'
        : 'Browser or system notification permission was not granted.'
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 text-sm font-medium inline-flex items-center gap-2 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.common.back}</span>
        </button>
        <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
          {t.settings.title}
        </h1>
      </div>

      {statusMsg && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/50 text-xs text-[#14532D] dark:text-emerald-200">
          {statusMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Preferences */}
        <div className="lg:col-span-6 space-y-4">
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-5">
            {/* Language */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span className="text-sm font-medium">{t.settings.language}</span>
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20]">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, language: 'en' })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    settings.language === 'en'
                      ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#4C6154]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, language: 'ur' })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    settings.language === 'ur'
                      ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#4C6154]'
                  }`}
                >
                  اردو
                </button>
              </div>
            </div>

            {/* Theme */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-emerald-950/10 dark:border-emerald-100/10">
              <div className="flex items-center gap-2.5">
                {settings.theme === 'dark' ? (
                  <Moon className="w-4 h-4 text-amber-400" />
                ) : (
                  <Sun className="w-4 h-4 text-[#15803D]" />
                )}
                <span className="text-sm font-medium">{t.settings.theme}</span>
              </div>
              <div className="flex gap-1 p-1 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20]">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, theme: 'light' })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    settings.theme === 'light'
                      ? 'bg-white text-[#14532D]'
                      : 'text-[#4C6154] dark:text-[#9BB5A4]'
                  }`}
                >
                  {t.settings.light}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, theme: 'dark' })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    settings.theme === 'dark'
                      ? 'bg-[#132019] text-[#4ADE80]'
                      : 'text-[#4C6154]'
                  }`}
                >
                  {t.settings.dark}
                </button>
              </div>
            </div>

            {/* Units */}
            <div className="flex items-center justify-between gap-4 pt-4 border-t border-emerald-950/10 dark:border-emerald-100/10">
              <span className="text-sm font-medium">{t.settings.units}</span>
              <div className="flex gap-1 p-1 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20]">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, unitSystem: 'metric' })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    settings.unitSystem === 'metric'
                      ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#4C6154]'
                  }`}
                >
                  {t.settings.metric}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateSettings({ ...settings, unitSystem: 'imperial' })
                  }
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                    settings.unitSystem === 'imperial'
                      ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                      : 'text-[#4C6154]'
                  }`}
                >
                  {t.settings.imperial}
                </button>
              </div>
            </div>
          </section>

          {/* Notifications & Reminders */}
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
              <span>{t.settings.notifications}</span>
            </h2>

            <label className="flex items-center justify-between gap-4 text-sm cursor-pointer">
              <span>{t.settings.enableNotifications}</span>
              <input
                type="checkbox"
                checked={settings.notificationsEnabled}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    notificationsEnabled: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-[#15803D]"
              />
            </label>

            {settings.notificationsEnabled && (
              <div className="space-y-3 pt-2 border-t border-emerald-950/10 dark:border-emerald-100/10 text-xs">
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span>{t.settings.mealReminders}</span>
                  <input
                    type="checkbox"
                    checked={settings.mealReminders}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        mealReminders: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#15803D]"
                  />
                </label>
                <label className="flex items-center justify-between gap-4 cursor-pointer">
                  <span>{t.settings.dailySummary}</span>
                  <input
                    type="checkbox"
                    checked={settings.dailySummaryReminder}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        dailySummaryReminder: e.target.checked,
                      })
                    }
                    className="w-4 h-4 accent-[#15803D]"
                  />
                </label>
                <label className="flex items-center justify-between gap-4">
                  <span>{t.settings.reminderTime}</span>
                  <input
                    type="time"
                    value={settings.reminderTime}
                    onChange={(e) =>
                      onUpdateSettings({
                        ...settings,
                        reminderTime: e.target.value,
                      })
                    }
                    className="px-2.5 py-1 rounded-lg bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void handleTestReminder()}
                  className="min-h-[38px] px-4 py-1.5 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#14532D] dark:text-[#4ADE80] font-semibold cursor-pointer"
                >
                  {t.settings.testNotification}
                </button>
              </div>
            )}
          </section>

          {/* Danger Zone: Clear History & Delete Account */}
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-3">
            {!confirmClear ? (
              <button
                type="button"
                onClick={() => setConfirmClear(true)}
                className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-emerald-950/15 dark:border-emerald-100/15 text-xs font-semibold text-left flex items-center justify-between cursor-pointer"
              >
                <span>{t.settings.clearHistory}</span>
                <Trash2 className="w-4 h-4 text-[#4C6154]" />
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 space-y-2 text-xs">
                <p>Clear local scan and search history?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearHistory();
                      setConfirmClear(false);
                      setStatusMsg('Local scan & search history cleared.');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-700 text-white font-semibold cursor-pointer"
                  >
                    {t.common.confirm}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-3 py-1.5 rounded-lg border border-amber-300 cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                </div>
              </div>
            )}

            {authUser && (
              <>
                {!confirmDelete ? (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="w-full min-h-[42px] px-4 py-2 rounded-xl border border-red-300 dark:border-red-800/60 text-xs font-semibold text-red-700 dark:text-red-300 text-left flex items-center justify-between cursor-pointer"
                  >
                    <span>{t.settings.deleteAccount}</span>
                    <Trash2 className="w-4 h-4" />
                  </button>
                ) : (
                  <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-2.5 text-xs text-red-900 dark:text-red-100">
                    <p>{t.settings.deleteAccountConfirm}</p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void onDeleteAccount().then(() => {
                            setConfirmDelete(false);
                            setStatusMsg('Account and synchronized data deleted.');
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-red-700 text-white font-semibold cursor-pointer"
                      >
                        {t.common.confirm}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-3 py-1.5 rounded-lg border border-red-300 cursor-pointer"
                      >
                        {t.common.cancel}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </div>

        {/* Privacy, Terms, About, Support */}
        <div className="lg:col-span-6 space-y-4">
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setLegalTab(legalTab === 'privacy' ? null : 'privacy')
                }
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-[#15803D]" />
                <span>{t.settings.privacyPolicy}</span>
              </button>
              <button
                type="button"
                onClick={() => setLegalTab(legalTab === 'terms' ? null : 'terms')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Info className="w-4 h-4 text-[#15803D]" />
                <span>{t.settings.terms}</span>
              </button>
              <button
                type="button"
                onClick={() => setLegalTab(legalTab === 'about' ? null : 'about')}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Info className="w-4 h-4 text-[#15803D]" />
                <span>{t.settings.about}</span>
              </button>
            </div>

            {legalTab === 'privacy' && (
              <div className="p-4 rounded-2xl bg-[#F6F8F7] dark:bg-[#0B120E] text-xs space-y-2 leading-relaxed text-[#4C6154] dark:text-[#9BB5A4]">
                <h3 className="text-sm font-bold text-[#111C16] dark:text-[#EDF4EF]">
                  NutriScan AI Privacy Policy
                </h3>
                <p>
                  <strong>Camera Usage:</strong> Camera permission is requested only when you tap Scan Barcode, Take Photo, or Scan Nutrition Label. Camera frames are never recorded silently in the background.
                </p>
                <p>
                  <strong>Data Storage & Sync:</strong> Guest mode stores logs and cached products strictly on your device. If you create an optional account, your profile, daily food logs, and favorites are synchronized over HTTPS to our backend database so you can access or export them across sessions.
                </p>
                <p>
                  <strong>No Data Selling:</strong> NutriScan AI does not sell personal data, health logs, or browsing activity to third parties. You may export or permanently delete your account and cloud data at any time.
                </p>
              </div>
            )}

            {legalTab === 'terms' && (
              <div className="p-4 rounded-2xl bg-[#F6F8F7] dark:bg-[#0B120E] text-xs space-y-2 leading-relaxed text-[#4C6154] dark:text-[#9BB5A4]">
                <h3 className="text-sm font-bold text-[#111C16] dark:text-[#EDF4EF]">
                  Terms & Conditions
                </h3>
                <p>
                  NutriScan AI provides packaged food lookups via Open Food Facts (ODbL) and USDA FoodData Central (CC0), plus optional OCR extraction and visual AI estimates.
                </p>
                <p>
                  <strong>Non-Medical Disclaimer:</strong> Calorie targets, macro splits, and high-sugar/sodium/saturated-fat indicators are general informational estimates—not medical advice, clinical diagnosis, or dietary prescriptions. Always verify allergen and ingredient labels directly on physical packaging.
                </p>
              </div>
            )}

            {(legalTab === 'about' || legalTab === null) && (
              <div className="space-y-4">
                <img
                  src="/src/assets/images/nutriscan_feature_graphic_1794893956536.jpg"
                  alt="NutriScan AI Feature Artwork"
                  referrerPolicy="no-referrer"
                  className="w-full h-40 object-cover rounded-2xl border border-emerald-950/10 dark:border-emerald-100/10"
                />
                <div className="text-xs text-[#4C6154] dark:text-[#9BB5A4] space-y-1.5">
                  <p className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF]">
                    NutriScan AI · Scan. Know. Eat Smart.
                  </p>
                  <p>
                    Package ID: <span className="font-mono">com.nutriscanai.app</span>
                  </p>
                  <p>
                    Nutrition Sources: Open Food Facts (ODbL) · USDA FoodData Central (CC0)
                  </p>
                  <p className="pt-1 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-[#15803D]" />
                    <span>{t.settings.support}: support@nutriscan.ai</span>
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
