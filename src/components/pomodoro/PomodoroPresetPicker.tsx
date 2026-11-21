import React from 'react';
import { Sparkles, Brain, Sliders, Check } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { CustomPomodoroConfig, PomodoroPresetId } from '../../types/pomodoro';
import { POMODORO_PRESETS } from '../../utils/pomodoroSequence';

interface PomodoroPresetPickerProps {
  selectedPreset: PomodoroPresetId;
  onSelectPreset: (presetId: PomodoroPresetId) => void;
  customConfig: CustomPomodoroConfig;
  onCustomConfigChange: (config: CustomPomodoroConfig) => void;
  disabled?: boolean;
}

export const PomodoroPresetPicker: React.FC<PomodoroPresetPickerProps> = ({
  selectedPreset,
  onSelectPreset,
  customConfig,
  onCustomConfigChange,
  disabled = false,
}) => {
  const { t } = useLocale();

  const presets: { id: PomodoroPresetId; icon: React.ReactNode }[] = [
    {
      id: 'classic',
      icon: <Sparkles className="w-4 h-4 text-emerald-400" aria-hidden="true" />,
    },
    {
      id: 'deep_work',
      icon: <Brain className="w-4 h-4 text-blue-400" aria-hidden="true" />,
    },
    {
      id: 'custom',
      icon: <Sliders className="w-4 h-4 text-purple-400" aria-hidden="true" />,
    },
  ];

  const handleCustomNumberChange = (
    key: keyof CustomPomodoroConfig,
    min: number,
    max: number,
    valStr: string
  ) => {
    const parsed = parseInt(valStr, 10);
    if (!isNaN(parsed)) {
      const clamped = Math.min(max, Math.max(min, parsed));
      onCustomConfigChange({
        ...customConfig,
        [key]: clamped,
      });
    }
  };

  const handleCustomToggle = (key: 'autoStartBreaks' | 'autoStartWork') => {
    onCustomConfigChange({
      ...customConfig,
      [key]: !customConfig[key],
    });
  };

  return (
    <div className="space-y-4">
      {/* Preset Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {presets.map(({ id, icon }) => {
          const preset = POMODORO_PRESETS[id];
          const isSelected = selectedPreset === id;

          return (
            <button
              key={id}
              type="button"
              disabled={disabled}
              onClick={() => onSelectPreset(id)}
              className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between ${
                isSelected
                  ? 'bg-slate-800/90 border-calm-primary/60 shadow-sm ring-1 ring-calm-primary/30'
                  : 'bg-slate-800/30 border-calm-border hover:border-slate-600 hover:bg-slate-800/50'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              aria-pressed={isSelected}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="p-1.5 rounded-lg bg-slate-700/50">{icon}</span>
                  {isSelected && (
                    <span className="p-0.5 rounded-full bg-calm-primary/20 text-calm-primary">
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-calm-text">
                  {t(preset.labelKey)}
                </h3>
                <p className="text-xs text-calm-muted leading-relaxed">
                  {t(preset.descriptionKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Collapsible Custom Configuration Form */}
      {selectedPreset === 'custom' && (
        <div className="p-4 rounded-xl bg-slate-800/40 border border-calm-border space-y-4 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Work Duration */}
            <div className="space-y-1.5">
              <label
                htmlFor="custom-work-duration"
                className="text-xs font-medium text-calm-muted flex items-center justify-between"
              >
                <span>{t('pomoWorkDuration')}</span>
                <span className="text-calm-text font-semibold">
                  {customConfig.workDurationMinutes} {t('minutesUnit')}
                </span>
              </label>
              <input
                id="custom-work-duration"
                type="number"
                min={1}
                max={180}
                value={customConfig.workDurationMinutes}
                onChange={(e) =>
                  handleCustomNumberChange('workDurationMinutes', 1, 180, e.target.value)
                }
                disabled={disabled}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/60 border border-calm-border text-calm-text text-sm focus:border-calm-primary focus:outline-none"
              />
              <span className="text-[11px] text-calm-muted/70">1–180 {t('minutesUnit')}</span>
            </div>

            {/* Short Break */}
            <div className="space-y-1.5">
              <label
                htmlFor="custom-short-break"
                className="text-xs font-medium text-calm-muted flex items-center justify-between"
              >
                <span>{t('pomoShortBreakDuration')}</span>
                <span className="text-calm-text font-semibold">
                  {customConfig.shortBreakMinutes} {t('minutesUnit')}
                </span>
              </label>
              <input
                id="custom-short-break"
                type="number"
                min={1}
                max={45}
                value={customConfig.shortBreakMinutes}
                onChange={(e) =>
                  handleCustomNumberChange('shortBreakMinutes', 1, 45, e.target.value)
                }
                disabled={disabled}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/60 border border-calm-border text-calm-text text-sm focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-[11px] text-calm-muted/70">1–45 {t('minutesUnit')}</span>
            </div>

            {/* Long Break */}
            <div className="space-y-1.5">
              <label
                htmlFor="custom-long-break"
                className="text-xs font-medium text-calm-muted flex items-center justify-between"
              >
                <span>{t('pomoLongBreakDuration')}</span>
                <span className="text-calm-text font-semibold">
                  {customConfig.longBreakMinutes} {t('minutesUnit')}
                </span>
              </label>
              <input
                id="custom-long-break"
                type="number"
                min={1}
                max={60}
                value={customConfig.longBreakMinutes}
                onChange={(e) =>
                  handleCustomNumberChange('longBreakMinutes', 1, 60, e.target.value)
                }
                disabled={disabled}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/60 border border-calm-border text-calm-text text-sm focus:border-cyan-400 focus:outline-none"
              />
              <span className="text-[11px] text-calm-muted/70">1–60 {t('minutesUnit')}</span>
            </div>

            {/* Long Break Interval */}
            <div className="space-y-1.5">
              <label
                htmlFor="custom-interval-count"
                className="text-xs font-medium text-calm-muted flex items-center justify-between"
              >
                <span>{t('pomoLongBreakInterval')}</span>
                <span className="text-calm-text font-semibold">
                  {customConfig.intervalsBeforeLongBreak} {t('pomoIntervalsUnit')}
                </span>
              </label>
              <input
                id="custom-interval-count"
                type="number"
                min={1}
                max={12}
                value={customConfig.intervalsBeforeLongBreak}
                onChange={(e) =>
                  handleCustomNumberChange('intervalsBeforeLongBreak', 1, 12, e.target.value)
                }
                disabled={disabled}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-900/60 border border-calm-border text-calm-text text-sm focus:border-purple-400 focus:outline-none"
              />
              <span className="text-[11px] text-calm-muted/70">1–12 {t('pomoIntervalsUnit')}</span>
            </div>
          </div>

          {/* Automation Checkboxes */}
          <div className="pt-2 border-t border-calm-border/60 flex flex-col sm:flex-row gap-4">
            <label className="flex items-center gap-2 cursor-pointer text-xs text-calm-muted hover:text-calm-text select-none">
              <input
                type="checkbox"
                checked={customConfig.autoStartBreaks}
                onChange={() => handleCustomToggle('autoStartBreaks')}
                disabled={disabled}
                className="rounded border-calm-border text-calm-primary focus:ring-0 focus:ring-offset-0 bg-slate-900/60"
              />
              <span>{t('pomoAutoStartBreaks')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs text-calm-muted hover:text-calm-text select-none">
              <input
                type="checkbox"
                checked={customConfig.autoStartWork}
                onChange={() => handleCustomToggle('autoStartWork')}
                disabled={disabled}
                className="rounded border-calm-border text-calm-primary focus:ring-0 focus:ring-offset-0 bg-slate-900/60"
              />
              <span>{t('pomoAutoStartWork')}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
