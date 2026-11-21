/**
 * NeuroCalm & Fokus — PresetBar Component
 * Provides one-click access to curated soundscape presets and custom mix saving/deletion.
 */

import React, { useState } from 'react';
import { Sparkles, BookmarkPlus, Trash2, Check, X } from 'lucide-react';
import { SoundscapePreset } from '../../types/audio';
import { useLocale } from '../../context/LocaleContext';
import { TranslationKey } from '../../types/locale';

interface PresetBarProps {
  presets: SoundscapePreset[];
  activeSoundIds: string[];
  activeCount: number;
  onApplyPreset: (preset: SoundscapePreset) => void;
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
}

export const PresetBar: React.FC<PresetBarProps> = ({
  presets,
  activeSoundIds,
  activeCount,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}) => {
  const { t } = useLocale();
  const [isSaving, setIsSaving] = useState(false);
  const [customName, setCustomName] = useState('');

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) return;
    onSavePreset(customName.trim());
    setCustomName('');
    setIsSaving(false);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-calm-primary" aria-hidden="true" />
          <h3 className="font-semibold text-sm text-calm-text">
            {t('mixerPresetsTitle')}
          </h3>
        </div>

        {/* Save Mix Trigger */}
        {!isSaving ? (
          <button
            type="button"
            onClick={() => setIsSaving(true)}
            disabled={activeCount === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium text-calm-primary bg-calm-primary/10 hover:bg-calm-primary/20 border border-calm-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <BookmarkPlus className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('mixerPresetSaveButton')}</span>
          </button>
        ) : null}
      </div>

      {/* Inline Save Form */}
      {isSaving && (
        <form
          onSubmit={handleSaveSubmit}
          className="p-3 rounded-xl bg-calm-surface border border-calm-primary/30 flex flex-wrap items-center gap-2 text-xs animate-fade-in"
        >
          <span className="text-calm-muted font-medium">{t('mixerPresetSaveTitle')}:</span>
          <input
            type="text"
            autoFocus
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder={t('mixerPresetNamePlaceholder')}
            maxLength={35}
            className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg bg-calm-card border border-calm-border text-calm-text placeholder-calm-muted focus:outline-none focus:ring-1 focus:ring-calm-primary text-xs"
          />
          <div className="flex items-center gap-1.5">
            <button
              type="submit"
              disabled={!customName.trim()}
              className="p-1.5 rounded-lg bg-calm-primary text-slate-900 hover:bg-emerald-400 font-medium disabled:opacity-50 transition-colors"
              aria-label={t('save')}
            >
              <Check className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSaving(false);
                setCustomName('');
              }}
              className="p-1.5 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-card transition-colors"
              aria-label={t('cancel')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </form>
      )}

      {/* Preset Pills List */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {presets.map((preset) => {
          // Check if preset matches current active sounds
          const isCurrent =
            preset.tracks.length === activeSoundIds.length &&
            preset.tracks.every((pt) => activeSoundIds.includes(pt.soundId));

          const displayName = preset.nameKey
            ? t(preset.nameKey as TranslationKey)
            : preset.name || 'Custom Mix';

          return (
            <div
              key={preset.id}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                isCurrent
                  ? 'bg-calm-primary/15 border-calm-primary text-calm-primary shadow-sm'
                  : 'bg-calm-card hover:bg-calm-surface text-calm-text border-calm-border'
              }`}
            >
              <button
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="hover:underline flex items-center gap-1.5 focus:outline-none"
              >
                <span>{displayName}</span>
              </button>

              {!preset.isBuiltIn && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeletePreset(preset.id);
                  }}
                  aria-label={`${t('mixerPresetDelete')} ${displayName}`}
                  className="p-0.5 rounded text-calm-muted hover:text-red-400 transition-colors ml-1"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
