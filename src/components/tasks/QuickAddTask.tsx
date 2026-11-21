import React, { useState, useRef, useEffect } from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';

interface QuickAddTaskProps {
  onAdd: (title: string) => boolean;
  onOpenDetailed: () => void;
  autoFocus?: boolean;
  onFocused?: () => void;
}

export const QuickAddTask: React.FC<QuickAddTaskProps> = ({
  onAdd,
  onOpenDetailed,
  autoFocus,
  onFocused,
}) => {
  const { t } = useLocale();
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        onFocused?.();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [autoFocus, onFocused]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    const trimmed = title.trim();
    if (!trimmed) {
      setError(t('taskTitleRequired'));
      inputRef.current?.focus();
      return;
    }

    const success = onAdd(trimmed);
    if (success) {
      setTitle('');
      setError(null);
      // Retain focus for consecutive quick entries
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-1.5">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-1.5 bg-calm-card rounded-xl border border-calm-border shadow-sm focus-within:ring-2 focus-within:ring-calm-primary/40 focus-within:border-calm-primary transition-all"
      >
        <div className="ps-2 text-calm-muted">
          <Plus className="w-5 h-5 text-calm-primary" aria-hidden="true" />
        </div>

        <input
          ref={inputRef}
          type="text"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={t('quickAddPlaceholder')}
          aria-label={t('taskTitleLabel')}
          className="flex-1 bg-transparent py-2 px-1 text-sm text-calm-text placeholder:text-calm-muted/70 focus:outline-none"
        />

        <div className="flex items-center gap-1.5 pe-1">
          <button
            type="submit"
            aria-label={t('quickAddButton')}
            className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-calm-primary text-white hover:bg-emerald-600 active:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
          >
            {t('quickAddButton')}
          </button>

          <button
            type="button"
            onClick={onOpenDetailed}
            aria-label={t('detailedAddButton')}
            title={t('detailedAddButton')}
            className="p-1.5 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-surface border border-transparent hover:border-calm-border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary"
          >
            <SlidersHorizontal className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </form>

      {error && (
        <p className="text-xs text-rose-500 ps-3 font-medium animate-fadeIn">{error}</p>
      )}
    </div>
  );
};
