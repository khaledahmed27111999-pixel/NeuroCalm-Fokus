/**
 * NeuroCalm & Fokus — ActiveTrackCard Component
 * Displays an active soundscape track with independent volume fader, status indicator, and stop control.
 */

import React from 'react';
import { Volume2, VolumeX, X, AlertCircle, Loader2 } from 'lucide-react';
import { SoundscapeId } from '../../types/audio';
import { getSoundIcon } from './SoundCard';
import { useLocale } from '../../context/LocaleContext';

export interface ActiveTrackCardProps {
  soundId: SoundscapeId;
  name: string;
  volume: number; // [0.0, 1.0]
  isLoading: boolean;
  error: string | null;
  onVolumeChange: (volume: number) => void;
  onStop: () => void;
}

export const ActiveTrackCard: React.FC<ActiveTrackCardProps> = ({
  soundId,
  name,
  volume,
  isLoading,
  error,
  onVolumeChange,
  onStop,
}) => {
  const { t } = useLocale();
  const icon = getSoundIcon(soundId);
  const percent = Math.round(volume * 100);

  return (
    <div className="p-4 rounded-xl bg-calm-surface border border-calm-border/80 shadow-sm flex flex-col justify-between gap-3 text-start transition-all">
      {/* Track Header: Icon, Name, Loading/Error Badges & Stop Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-lg bg-calm-primary/20 text-calm-primary shrink-0">
            {icon}
          </div>
          <div className="min-w-0">
            <h4 className="font-medium text-sm text-calm-text truncate leading-tight">
              {name}
            </h4>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isLoading ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                  <span>{t('mixerSoundLoading')}</span>
                </span>
              ) : error ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-red-400 font-medium">
                  <AlertCircle className="w-3 h-3" aria-hidden="true" />
                  <span className="truncate max-w-[140px]">{error}</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] text-calm-primary">
                  <span className="w-1.5 h-1.5 rounded-full bg-calm-primary animate-pulse" />
                  <span>{t('mixerSoundActive')}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStop}
          aria-label={`${t('mixerSoundStop')} ${name}`}
          className="p-1.5 rounded-lg text-calm-muted hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      {/* Volume Slider Section */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs text-calm-muted">
          <span className="flex items-center gap-1">
            {percent === 0 ? (
              <VolumeX className="w-3.5 h-3.5 text-calm-muted" aria-hidden="true" />
            ) : (
              <Volume2 className="w-3.5 h-3.5 text-calm-primary" aria-hidden="true" />
            )}
            <span>{t('mixerMasterVolume')}</span>
          </span>
          <span className="font-mono font-medium text-calm-text text-xs">
            {percent}%
          </span>
        </div>

        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={percent}
            disabled={isLoading}
            onChange={(e) => onVolumeChange(Number(e.target.value) / 100)}
            aria-label={`${name} ${t('mixerMasterVolume')}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="w-full h-1.5 bg-calm-border rounded-lg appearance-none cursor-pointer accent-calm-primary transition-all focus:outline-none focus:ring-2 focus:ring-calm-primary/40 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
};
