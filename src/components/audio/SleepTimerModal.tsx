/**
 * NeuroCalm & Fokus — Sleep Timer Configuration Modal
 * Phase 4C: Accessible, compact configuration modal for time-before-fade and fade duration.
 * Adheres to WCAG 2.5.5 touch target guidelines and full RTL/LTR bilingual parity.
 */

import React, { useState, useEffect, useRef, useId } from 'react';
import { Moon, X, Clock, Sparkles, Volume2, AlertCircle } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useSleepTimer } from '../../hooks/useSleepTimer';
import { useAudio } from '../../hooks/useAudio';
import { formatTimeDisplay } from '../../utils/focusTimer';

interface SleepTimerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TIMER_PRESETS = [15, 30, 45, 60, 90] as const;
const FADE_PRESETS = [
  { labelMinutes: 1, seconds: 60 },
  { labelMinutes: 3, seconds: 180 },
  { labelMinutes: 5, seconds: 300 },
  { labelMinutes: 10, seconds: 600 },
] as const;

export const SleepTimerModal: React.FC<SleepTimerModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLocale();
  const { state, preferences, startTimer, cancelTimer, updatePreferences } = useSleepTimer();
  const { state: audioState } = useAudio();

  const titleId = useId();
  const descId = useId();

  const [selectedDuration, setSelectedDuration] = useState<number>(preferences.preferredDurationMinutes);
  const [isCustomDuration, setIsCustomDuration] = useState<boolean>(
    !TIMER_PRESETS.includes(preferences.preferredDurationMinutes as (typeof TIMER_PRESETS)[number])
  );
  const [customDurationInput, setCustomDurationInput] = useState<string>(
    String(preferences.preferredDurationMinutes)
  );

  const [selectedFadeSec, setSelectedFadeSec] = useState<number>(preferences.preferredFadeDurationSeconds);
  const [isCustomFade, setIsCustomFade] = useState<boolean>(
    !FADE_PRESETS.some((p) => p.seconds === preferences.preferredFadeDurationSeconds)
  );
  const [customFadeInput, setCustomFadeInput] = useState<string>(
    String(Math.round(preferences.preferredFadeDurationSeconds / 60) || 5)
  );

  const initialFocusRef = useRef<HTMLButtonElement | null>(null);

  // Sync with preferences when opened
  useEffect(() => {
    if (isOpen) {
      const dur = preferences.preferredDurationMinutes;
      setSelectedDuration(dur);
      setIsCustomDuration(!TIMER_PRESETS.includes(dur as (typeof TIMER_PRESETS)[number]));
      setCustomDurationInput(String(dur));

      const fade = preferences.preferredFadeDurationSeconds;
      setSelectedFadeSec(fade);
      setIsCustomFade(!FADE_PRESETS.some((p) => p.seconds === fade));
      setCustomFadeInput(String(Math.round(fade / 60) || 5));

      // Gentle focus on the primary action or first element
      setTimeout(() => {
        initialFocusRef.current?.focus();
      }, 50);
    }
  }, [isOpen, preferences]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPresetDuration = (mins: number) => {
    setIsCustomDuration(false);
    setSelectedDuration(mins);
  };

  const handleCustomDurationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomDurationInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      setSelectedDuration(Math.min(180, Math.max(1, num)));
    }
  };

  const handleSelectPresetFade = (seconds: number) => {
    setIsCustomFade(false);
    setSelectedFadeSec(seconds);
  };

  const handleCustomFadeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomFadeInput(val);
    const num = parseInt(val, 10);
    if (!isNaN(num) && num > 0) {
      // Input is in minutes, stored in seconds
      setSelectedFadeSec(Math.min(600, Math.max(10, num * 60)));
    }
  };

  const handleStart = () => {
    const finalDuration = isCustomDuration
      ? Math.min(180, Math.max(1, parseInt(customDurationInput, 10) || 30))
      : selectedDuration;

    const finalFade = isCustomFade
      ? Math.min(600, Math.max(10, (parseInt(customFadeInput, 10) || 5) * 60))
      : selectedFadeSec;

    // Update user preferences for future sessions
    updatePreferences({
      preferredDurationMinutes: finalDuration,
      preferredFadeDurationSeconds: finalFade,
    });

    // Start timer via central Phase 4B context
    startTimer(finalDuration, finalFade);
    onClose();
  };

  const fadeMinutesDisplay = Math.round((selectedFadeSec / 60) * 10) / 10;
  const totalMinutesApprox = selectedDuration + Math.round(selectedFadeSec / 60);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-3xl bg-calm-card border border-calm-border/90 shadow-2xl overflow-hidden text-start space-y-5 p-6 sm:p-7 animate-scaleIn max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-calm-border/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-400 border border-teal-500/20 flex items-center justify-center shrink-0">
              <Moon className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-base sm:text-lg font-bold text-calm-text leading-tight">
                {t('sleepTimerTitle')}
              </h2>
              <p id={descId} className="text-xs text-calm-muted mt-0.5 line-clamp-1">
                {t('sleepTimerSubtitle')}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={t('sleepTimerClose')}
            className="min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 p-2 rounded-xl text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors flex items-center justify-center"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pe-1">
          {/* Active Status Banner if already running/fading */}
          {state.status !== 'idle' && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-2 ${
                state.isFading
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                  : 'bg-teal-500/10 border-teal-500/30 text-teal-300'
              }`}
            >
              <div className="flex items-center gap-2">
                <Moon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span className="font-semibold">
                  {state.isFading
                    ? t('sleepTimerFadingStatus')
                    : t('sleepTimerRunningStatus')}
                </span>
              </div>
              <span className="font-mono text-[11px] text-calm-muted shrink-0">
                {state.isFading
                  ? t('sleepTimerUntilSilence', {
                      time: formatTimeDisplay(state.remainingSeconds),
                    })
                  : t('sleepTimerUntilFade', {
                      time: formatTimeDisplay(state.remainingSecondsBeforeFade),
                    })}
              </span>
            </div>
          )}

          {/* No audio warning */}
          {audioState.activeCount === 0 && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{t('sleepTimerNoAudioWarning')}</span>
            </div>
          )}

          {/* Section 1: Listening Duration Before Fade */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-calm-text flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
                <span>{t('sleepTimerDurationLabel')}</span>
              </label>
              <span className="font-mono text-xs font-bold text-calm-primary bg-calm-primary/10 border border-calm-primary/20 px-2 py-0.5 rounded-md">
                {selectedDuration} {t('sleepTimerMinutesUnit')}
              </span>
            </div>

            {/* Presets Grid */}
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {TIMER_PRESETS.map((mins) => {
                const isSelected = !isCustomDuration && selectedDuration === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleSelectPresetDuration(mins)}
                    className={`min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border text-center ${
                      isSelected
                        ? 'bg-calm-primary text-slate-900 border-calm-primary shadow-sm font-bold'
                        : 'bg-calm-surface/80 text-calm-text border-calm-border hover:bg-calm-border/60'
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}

              {/* Custom Preset Button */}
              <button
                type="button"
                onClick={() => setIsCustomDuration(true)}
                className={`min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border text-center ${
                  isCustomDuration
                    ? 'bg-calm-primary text-slate-900 border-calm-primary shadow-sm font-bold'
                    : 'bg-calm-surface/80 text-calm-text border-calm-border hover:bg-calm-border/60'
                }`}
              >
                {t('sleepTimerCustom')}
              </button>
            </div>

            {/* Custom Input */}
            {isCustomDuration && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-calm-surface border border-calm-primary/40 animate-fadeIn">
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={customDurationInput}
                  onChange={handleCustomDurationChange}
                  className="w-20 px-2.5 py-1 rounded-lg bg-calm-card border border-calm-border text-calm-text text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-calm-primary"
                  aria-label={t('sleepTimerDurationLabel')}
                />
                <span className="text-xs text-calm-muted">{t('sleepTimerMinutesUnit')} (1–180)</span>
              </div>
            )}
          </div>

          {/* Section 2: Fade-out Duration */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-calm-text flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
                <span>{t('sleepTimerFadeLabel')}</span>
              </label>
              <span className="font-mono text-xs font-bold text-teal-400 bg-teal-500/10 border border-teal-500/20 px-2 py-0.5 rounded-md">
                {fadeMinutesDisplay} {t('sleepTimerMinutesUnit')}
              </span>
            </div>

            {/* Fade Presets Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {FADE_PRESETS.map((preset) => {
                const isSelected = !isCustomFade && selectedFadeSec === preset.seconds;
                return (
                  <button
                    key={preset.seconds}
                    type="button"
                    onClick={() => handleSelectPresetFade(preset.seconds)}
                    className={`min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border text-center ${
                      isSelected
                        ? 'bg-teal-500 text-slate-900 border-teal-500 shadow-sm font-bold'
                        : 'bg-calm-surface/80 text-calm-text border-calm-border hover:bg-calm-border/60'
                    }`}
                  >
                    {preset.labelMinutes}m
                  </button>
                );
              })}

              {/* Custom Fade Button */}
              <button
                type="button"
                onClick={() => setIsCustomFade(true)}
                className={`min-h-[44px] sm:min-h-[38px] px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-all border text-center ${
                  isCustomFade
                    ? 'bg-teal-500 text-slate-900 border-teal-500 shadow-sm font-bold'
                    : 'bg-calm-surface/80 text-calm-text border-calm-border hover:bg-calm-border/60'
                }`}
              >
                {t('sleepTimerCustom')}
              </button>
            </div>

            {/* Custom Fade Input */}
            {isCustomFade && (
              <div className="flex items-center gap-2 p-2.5 rounded-xl bg-calm-surface border border-teal-500/40 animate-fadeIn">
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={customFadeInput}
                  onChange={handleCustomFadeChange}
                  className="w-20 px-2.5 py-1 rounded-lg bg-calm-card border border-calm-border text-calm-text text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-teal-400"
                  aria-label={t('sleepTimerFadeLabel')}
                />
                <span className="text-xs text-calm-muted">{t('sleepTimerMinutesUnit')} (1–10)</span>
              </div>
            )}
          </div>

          {/* Educational Callout & Real-Time Calculation */}
          <div className="p-3.5 rounded-2xl bg-calm-surface/90 border border-calm-border/80 space-y-2 text-start">
            <div className="flex items-start gap-2 text-calm-text text-xs font-medium">
              <Sparkles className="w-4 h-4 text-calm-primary shrink-0 mt-0.5" aria-hidden="true" />
              <p className="leading-relaxed">{t('sleepTimerExplanation')}</p>
            </div>

            <div className="ps-6 text-[11px] font-mono text-teal-300/90 font-medium border-t border-calm-border/50 pt-2">
              {t('sleepTimerExample', {
                timer: selectedDuration,
                fade: fadeMinutesDisplay,
                total: totalMinutesApprox,
              })}
            </div>
          </div>
        </div>

        {/* Footer / Actions */}
        <div className="flex items-center gap-3 pt-3 border-t border-calm-border/60 shrink-0">
          {state.status !== 'idle' ? (
            <>
              <button
                type="button"
                onClick={() => {
                  cancelTimer();
                  onClose();
                }}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors text-center inline-flex items-center justify-center gap-1.5"
                aria-label={t('sleepTimerCancel')}
              >
                <X className="w-4 h-4" aria-hidden="true" />
                <span>{t('sleepTimerCancel')}</span>
              </button>

              <button
                ref={initialFocusRef}
                type="button"
                onClick={handleStart}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-calm-primary text-slate-900 hover:bg-emerald-400 transition-colors shadow-md text-center inline-flex items-center justify-center gap-1.5"
              >
                <Moon className="w-4 h-4" aria-hidden="true" />
                <span>{t('save')}</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={onClose}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-semibold bg-calm-surface hover:bg-calm-border text-calm-text border border-calm-border transition-colors text-center"
              >
                {t('cancel')}
              </button>

              <button
                id="sleep-timer-start-btn"
                ref={initialFocusRef}
                type="button"
                onClick={handleStart}
                className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold bg-calm-primary text-slate-900 hover:bg-emerald-400 transition-colors shadow-md text-center inline-flex items-center justify-center gap-1.5"
              >
                <Moon className="w-4 h-4" aria-hidden="true" />
                <span>{t('sleepTimerStart')}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
