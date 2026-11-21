import React, { useState } from 'react';
import { Clock, Sliders } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';

interface FocusDurationPickerProps {
  selectedMinutes: number;
  onSelectMinutes: (minutes: number) => void;
  suggestedTaskMinutes?: number;
}

const PRESETS = [15, 25, 45, 60];

export const FocusDurationPicker: React.FC<FocusDurationPickerProps> = ({
  selectedMinutes,
  onSelectMinutes,
  suggestedTaskMinutes,
}) => {
  const { t } = useLocale();
  const [isCustomMode, setIsCustomMode] = useState(!PRESETS.includes(selectedMinutes));
  const [customInput, setCustomInput] = useState(String(selectedMinutes));

  const handlePresetClick = (preset: number) => {
    setIsCustomMode(false);
    onSelectMinutes(preset);
  };

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomInput(val);
    const parsed = parseInt(val, 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 180) {
      onSelectMinutes(parsed);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold uppercase tracking-wider text-calm-muted flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
          {t('focusDurationPresets')}
        </label>

        {suggestedTaskMinutes && suggestedTaskMinutes > 0 && (
          <button
            type="button"
            onClick={() => onSelectMinutes(suggestedTaskMinutes)}
            className="text-xs font-medium text-calm-primary hover:text-emerald-400 transition-colors"
          >
            {t('matchTaskEstimate', { minutes: suggestedTaskMinutes })}
          </button>
        )}
      </div>

      {/* Preset Pill Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {PRESETS.map((preset) => {
          const isSelected = !isCustomMode && selectedMinutes === preset;
          return (
            <button
              key={preset}
              type="button"
              onClick={() => handlePresetClick(preset)}
              className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
                isSelected
                  ? 'bg-calm-primary text-white border-calm-primary shadow-sm'
                  : 'bg-calm-surface text-calm-muted border-calm-border hover:text-calm-text hover:border-calm-border/80'
              }`}
            >
              {t('focusMinutes', { count: preset })}
            </button>
          );
        })}

        {/* Custom Duration Button */}
        <button
          type="button"
          onClick={() => setIsCustomMode(true)}
          className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all flex items-center justify-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary ${
            isCustomMode
              ? 'bg-calm-primary text-white border-calm-primary shadow-sm'
              : 'bg-calm-surface text-calm-muted border-calm-border hover:text-calm-text hover:border-calm-border/80'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{t('customDuration')}</span>
        </button>
      </div>

      {/* Custom Input Field when active */}
      {isCustomMode && (
        <div className="p-3.5 rounded-xl bg-calm-surface border border-calm-border flex items-center justify-between gap-3 animate-fadeIn">
          <span className="text-xs text-calm-muted">
            {t('enterMinutesRange', { min: 1, max: 180 })}
          </span>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={180}
              value={customInput}
              onChange={handleCustomChange}
              className="w-20 px-3 py-1.5 bg-calm-card border border-calm-border rounded-lg text-sm text-calm-text font-mono text-center focus:outline-none focus:ring-2 focus:ring-calm-primary/50"
            />
            <span className="text-xs font-medium text-calm-text">{t('minutesUnit')}</span>
          </div>
        </div>
      )}
    </div>
  );
};
