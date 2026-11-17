import React, { useState } from 'react';
import {
  Check,
  Cloud,
  Download,
  LogOut,
  RefreshCw,
  Settings,
  UserCheck,
} from 'lucide-react';
import type { LanguageCode } from '../i18n/translations';
import { TRANSLATIONS } from '../i18n/translations';
import type {
  ActivityLevel,
  AppSettings,
  AuthUser,
  BiologicalSex,
  FitnessGoal,
  FoodLogEntry,
  FoodProduct,
  NutritionGoals,
  UserProfile,
} from '../types/nutrition';
import { calculateEstimatedGoals } from '../utils/nutritionMath';

interface ProfileAccountViewProps {
  language: LanguageCode;
  profile: UserProfile;
  goals: NutritionGoals;
  settings: AppSettings;
  authUser: AuthUser | null;
  lastSynced: string | null;
  logs: FoodLogEntry[];
  favorites: FoodProduct[];
  onSaveProfileAndGoals: (profile: UserProfile, goals: NutritionGoals) => void;
  onLogin: (email: string, password: string) => Promise<void>;
  onRegister: (name: string, email: string, password: string) => Promise<void>;
  onLogout: () => void;
  onSyncNow: () => Promise<void>;
  onOpenSettings: () => void;
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export const ProfileAccountView: React.FC<ProfileAccountViewProps> = ({
  language,
  profile,
  goals,
  settings,
  authUser,
  lastSynced,
  logs,
  favorites,
  onSaveProfileAndGoals,
  onLogin,
  onRegister,
  onLogout,
  onSyncNow,
  onOpenSettings,
}) => {
  const t = TRANSLATIONS[language];
  const [draftProfile, setDraftProfile] = useState<UserProfile>(profile);
  const [draftGoals, setDraftGoals] = useState<NutritionGoals>(goals);
  const [savedNotice, setSavedNotice] = useState(false);

  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState('');
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  const handleRecalculate = () => {
    const calculated = calculateEstimatedGoals(draftProfile, {
      sugarThresholdPer100g: draftGoals.sugarThresholdPer100g,
      sodiumThresholdMgPer100g: draftGoals.sodiumThresholdMgPer100g,
      satFatThresholdPer100g: draftGoals.satFatThresholdPer100g,
    });
    setDraftGoals(calculated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfileAndGoals(
      { ...draftProfile, onboardingCompleted: true },
      draftGoals
    );
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthBusy(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        await onLogin(authEmail, authPassword);
      } else {
        await onRegister(authName, authEmail, authPassword);
      }
      setAuthPassword('');
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSyncClick = async () => {
    setSyncBusy(true);
    setSyncMessage('');
    try {
      await onSyncNow();
      setSyncMessage(t.profile.syncSuccess);
    } catch (err) {
      setSyncMessage(err instanceof Error ? err.message : 'Sync failed.');
    } finally {
      setSyncBusy(false);
    }
  };

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      profile: draftProfile,
      goals: draftGoals,
      settings,
      logs,
      favorites,
    };
    downloadFile(
      `nutriscan-export-${new Date().toISOString().split('T')[0]}.json`,
      JSON.stringify(payload, null, 2),
      'application/json'
    );
  };

  const handleExportCsv = () => {
    const header = [
      'Date',
      'Meal',
      'Product',
      'Brand',
      'Serving',
      'Grams',
      'Calories_kcal',
      'Protein_g',
      'Carbs_g',
      'Sugars_g',
      'Fat_g',
      'Fiber_g',
      'Sodium_mg',
      'Source',
    ];
    const rows = logs.map((l) =>
      [
        l.dateKey,
        l.mealType,
        `"${(l.name || '').replace(/"/g, '""')}"`,
        `"${(l.brand || '').replace(/"/g, '""')}"`,
        `"${(l.servingLabel || '').replace(/"/g, '""')}"`,
        l.gramsConsumed,
        l.nutrients.caloriesKcal ?? '',
        l.nutrients.proteinG ?? '',
        l.nutrients.carbsG ?? '',
        l.nutrients.sugarsG ?? '',
        l.nutrients.fatG ?? '',
        l.nutrients.fiberG ?? '',
        l.nutrients.sodiumMg ?? '',
        l.dataSource,
      ].join(',')
    );
    downloadFile(
      `nutriscan-diary-${new Date().toISOString().split('T')[0]}.csv`,
      [header.join(','), ...rows].join('\n'),
      'text/csv'
    );
  };

  const isImperial = settings.unitSystem === 'imperial';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#111C16] dark:text-[#EDF4EF]">
            {t.profile.title}
          </h1>
          <p className="text-sm text-[#4C6154] dark:text-[#9BB5A4]">
            {t.profile.onboardingSubtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#132019] border border-emerald-950/15 dark:border-emerald-100/15 text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
        >
          <Settings className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
          <span>{t.settings.title}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Personalized Profile & Targets Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-6"
        >
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.profile.onboardingTitle}
            </h2>
            <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4]">
              {t.profile.medicalDisclaimer}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.name}
              </span>
              <input
                type="text"
                value={draftProfile.name}
                onChange={(e) =>
                  setDraftProfile({ ...draftProfile, name: e.target.value })
                }
                placeholder="e.g. Amina / Alex"
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.age}
              </span>
              <input
                type="number"
                min={13}
                max={100}
                value={draftProfile.age}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    age: Number(e.target.value) || 28,
                  })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.sex}
              </span>
              <select
                value={draftProfile.sex}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    sex: e.target.value as BiologicalSex,
                  })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              >
                <option value="unspecified">{t.profile.sexUnspecified}</option>
                <option value="female">{t.profile.sexFemale}</option>
                <option value="male">{t.profile.sexMale}</option>
              </select>
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.height} ({isImperial ? 'in' : 'cm'})
              </span>
              <input
                type="number"
                step="0.5"
                value={
                  isImperial
                    ? Math.round((draftProfile.heightCm / 2.54) * 10) / 10
                    : draftProfile.heightCm
                }
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setDraftProfile({
                    ...draftProfile,
                    heightCm: isImperial ? Math.round(val * 2.54) : val,
                  });
                }}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.weight} ({isImperial ? 'lb' : 'kg'})
              </span>
              <input
                type="number"
                step="0.5"
                value={
                  isImperial
                    ? Math.round(draftProfile.weightKg * 2.20462 * 10) / 10
                    : draftProfile.weightKg
                }
                onChange={(e) => {
                  const val = Number(e.target.value) || 0;
                  setDraftProfile({
                    ...draftProfile,
                    weightKg: isImperial
                      ? Math.round((val / 2.20462) * 10) / 10
                      : val,
                  });
                }}
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.activity}
              </span>
              <select
                value={draftProfile.activityLevel}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    activityLevel: e.target.value as ActivityLevel,
                  })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              >
                <option value="sedentary">{t.profile.activitySedentary}</option>
                <option value="light">{t.profile.activityLight}</option>
                <option value="moderate">{t.profile.activityModerate}</option>
                <option value="active">{t.profile.activityActive}</option>
                <option value="very_active">{t.profile.activityVeryActive}</option>
              </select>
            </label>
            <label className="sm:col-span-2 space-y-1">
              <span className="font-medium text-[#4C6154] dark:text-[#9BB5A4]">
                {t.profile.goal}
              </span>
              <select
                value={draftProfile.fitnessGoal}
                onChange={(e) =>
                  setDraftProfile({
                    ...draftProfile,
                    fitnessGoal: e.target.value as FitnessGoal,
                  })
                }
                className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
              >
                <option value="maintain">{t.profile.goalMaintain}</option>
                <option value="lose">{t.profile.goalLose}</option>
                <option value="gain">{t.profile.goalGain}</option>
                <option value="muscle">{t.profile.goalMuscle}</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={handleRecalculate}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-[#14532D] dark:text-[#4ADE80] text-xs font-semibold inline-flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{t.profile.recalculateBtn}</span>
          </button>

          {/* Editable Daily Targets */}
          <div className="pt-4 border-t border-emerald-950/10 dark:border-emerald-100/10 space-y-3">
            <h3 className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.profile.targetsSection}
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
              {(
                [
                  ['caloriesKcal', 'kcal'],
                  ['proteinG', `${t.home.protein} (g)`],
                  ['carbsG', `${t.home.carbs} (g)`],
                  ['fatG', `${t.home.fat} (g)`],
                  ['fiberG', `${t.home.fiber} (g)`],
                ] as const
              ).map(([field, label]) => (
                <label key={field} className="space-y-1">
                  <span className="text-[#4C6154] dark:text-[#9BB5A4]">{label}</span>
                  <input
                    type="number"
                    value={draftGoals[field]}
                    onChange={(e) =>
                      setDraftGoals({
                        ...draftGoals,
                        [field]: Number(e.target.value) || 0,
                        isCustomTargets: true,
                      })
                    }
                    className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Configurable Indicator Thresholds */}
          <div className="pt-4 border-t border-emerald-950/10 dark:border-emerald-100/10 space-y-3">
            <h3 className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              {t.profile.thresholdsSection}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <label className="space-y-1">
                <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                  {t.product.highSugar} (g/100g)
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={draftGoals.sugarThresholdPer100g}
                  onChange={(e) =>
                    setDraftGoals({
                      ...draftGoals,
                      sugarThresholdPer100g: Number(e.target.value) || 22.5,
                    })
                  }
                  className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                  {t.product.highSodium} (mg/100g)
                </span>
                <input
                  type="number"
                  step="10"
                  value={draftGoals.sodiumThresholdMgPer100g}
                  onChange={(e) =>
                    setDraftGoals({
                      ...draftGoals,
                      sodiumThresholdMgPer100g: Number(e.target.value) || 600,
                    })
                  }
                  className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                />
              </label>
              <label className="space-y-1">
                <span className="text-[#4C6154] dark:text-[#9BB5A4]">
                  {t.product.highSatFat} (g/100g)
                </span>
                <input
                  type="number"
                  step="0.5"
                  value={draftGoals.satFatThresholdPer100g}
                  onChange={(e) =>
                    setDraftGoals({
                      ...draftGoals,
                      satFatThresholdPer100g: Number(e.target.value) || 5,
                    })
                  }
                  className="w-full min-h-[40px] px-2.5 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 font-mono tabular-nums text-sm"
                />
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2">
            {savedNotice ? (
              <span className="text-xs font-semibold text-[#15803D] dark:text-[#4ADE80] inline-flex items-center gap-1">
                <Check className="w-4 h-4" />
                <span>Saved</span>
              </span>
            ) : (
              <span />
            )}
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold cursor-pointer"
            >
              {t.profile.saveTargetsBtn}
            </button>
          </div>
        </form>

        {/* Account, Sync & Export Card */}
        <div className="lg:col-span-5 space-y-6">
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#111C16] dark:text-[#EDF4EF] flex items-center gap-2">
              <Cloud className="w-5 h-5 text-[#15803D] dark:text-[#4ADE80]" />
              <span>{t.profile.accountSection}</span>
            </h2>

            {authUser ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#F6F8F7] dark:bg-[#192A20] flex items-center gap-3">
                  <UserCheck className="w-5 h-5 text-[#15803D] dark:text-[#4ADE80] shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{authUser.name}</p>
                    <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] truncate">
                      {authUser.email}
                    </p>
                    {lastSynced && (
                      <p className="text-[11px] text-[#4C6154] dark:text-[#9BB5A4] mt-0.5 tabular-nums">
                        Last synced: {new Date(lastSynced).toLocaleString()}
                      </p>
                    )}
                  </div>
                </div>

                {syncMessage && (
                  <p className="text-xs text-[#15803D] dark:text-[#4ADE80]">
                    {syncMessage}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    disabled={syncBusy}
                    onClick={() => void handleSyncClick()}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-[#14532D] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${syncBusy ? 'animate-spin' : ''}`}
                    />
                    <span>{t.profile.syncNowBtn}</span>
                  </button>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="min-h-[42px] px-4 py-2 rounded-xl border border-emerald-950/15 dark:border-emerald-100/15 text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t.profile.signOutBtn}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[#4C6154] dark:text-[#9BB5A4] leading-relaxed">
                  {t.profile.guestModeMsg}
                </p>

                <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20]">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer ${
                      authMode === 'login'
                        ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                        : 'text-[#4C6154] dark:text-[#9BB5A4]'
                    }`}
                  >
                    {t.profile.signInBtn}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`min-h-[36px] rounded-lg text-xs font-semibold cursor-pointer ${
                      authMode === 'register'
                        ? 'bg-white dark:bg-[#132019] text-[#14532D] dark:text-[#4ADE80]'
                        : 'text-[#4C6154] dark:text-[#9BB5A4]'
                    }`}
                  >
                    {t.profile.createAccountBtn}
                  </button>
                </div>

                <form onSubmit={(e) => void handleAuthSubmit(e)} className="space-y-3 text-xs">
                  {authMode === 'register' && (
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder={t.profile.name}
                      className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                    />
                  )}
                  <input
                    type="email"
                    required
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder={t.profile.email}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                  />
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={`${t.profile.password} (min 8 chars)`}
                    className="w-full min-h-[42px] px-3 rounded-xl bg-[#F6F8F7] dark:bg-[#0B120E] border border-emerald-950/15 text-sm"
                  />
                  {authError && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {authError}
                    </p>
                  )}
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-[#14532D] hover:bg-[#166534] dark:bg-[#15803D] text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
                  >
                    {authBusy
                      ? t.common.loading
                      : authMode === 'login'
                        ? t.profile.signInBtn
                        : t.profile.createAccountBtn}
                  </button>
                </form>
              </div>
            )}
          </section>

          {/* Data Export Card */}
          <section className="rounded-3xl bg-white dark:bg-[#132019] border border-emerald-950/10 dark:border-emerald-100/10 p-6 space-y-3">
            <h3 className="text-sm font-semibold text-[#111C16] dark:text-[#EDF4EF]">
              Data Portability
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{t.profile.exportJsonBtn}</span>
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                className="min-h-[42px] px-3.5 py-2 rounded-xl bg-[#F2F6F3] dark:bg-[#192A20] text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#15803D] dark:text-[#4ADE80]" />
                <span>{t.profile.exportCsvBtn}</span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
