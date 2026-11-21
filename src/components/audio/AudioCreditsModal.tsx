/**
 * NeuroCalm & Fokus — Audio Credits & Attributions Modal
 * Displays transparent source attribution and Creative Commons licenses for offline soundscapes.
 */

import React, { useEffect } from 'react';
import { X, ExternalLink, ShieldCheck } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import audioAttributions from '../../data/audioAttributions.json';
import { AudioAttribution } from '../../types/audio';

interface AudioCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioCreditsModal: React.FC<AudioCreditsModalProps> = ({ isOpen, onClose }) => {
  const { t } = useLocale();

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

  const attributions = audioAttributions as AudioAttribution[];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="credits-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
    >
      <div
        className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl bg-calm-card border border-calm-border shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-calm-border">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="w-5 h-5 text-calm-primary" aria-hidden="true" />
            <div>
              <h2 id="credits-title" className="text-base sm:text-lg font-semibold text-calm-text">
                {t('mixerCreditsTitle')}
              </h2>
              <p className="text-xs text-calm-muted">
                {t('mixerCreditsSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('mixerCreditsClose')}
            className="p-1.5 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Body: List of Attributions */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {attributions.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-xl bg-calm-surface/60 border border-calm-border/70 space-y-2 text-start"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-medium text-sm sm:text-base text-calm-text">
                    {item.name} <span className="text-xs text-calm-muted font-normal">({item.title})</span>
                  </h3>
                  <div className="text-xs text-calm-muted mt-0.5">
                    {t('mixerCreditsCreator')}: <span className="text-calm-text font-medium">{item.creator}</span>
                  </div>
                </div>
                <span className="shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full bg-calm-primary/10 text-calm-primary border border-calm-primary/20">
                  {item.licenseType}
                </span>
              </div>

              <p className="text-xs text-calm-muted leading-relaxed">
                {item.description}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-calm-border/40 text-xs">
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-calm-primary hover:underline font-medium"
                >
                  <span>{t('mixerCreditsSource')}</span>
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                </a>
                <span className="font-mono text-[10px] text-calm-muted/80 truncate max-w-[220px]" title={item.processedSha256}>
                  SHA: {item.processedSha256.substring(0, 16)}...
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-calm-border bg-calm-surface/40 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-calm-surface hover:bg-calm-border text-calm-text transition-colors"
          >
            {t('mixerCreditsClose')}
          </button>
        </div>
      </div>
    </div>
  );
};
