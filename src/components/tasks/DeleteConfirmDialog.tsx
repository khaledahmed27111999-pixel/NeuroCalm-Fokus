import React from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { Button } from '../common/Button';

interface DeleteConfirmDialogProps {
  taskTitle: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  taskTitle,
  isOpen,
  onConfirm,
  onCancel,
}) => {
  const { t } = useLocale();

  if (!isOpen) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-desc"
      className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-sm p-6 bg-calm-card border border-calm-border rounded-2xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3 text-rose-500">
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <AlertTriangle className="w-5 h-5 text-rose-500" aria-hidden="true" />
          </div>
          <h3 id="delete-dialog-title" className="font-semibold text-calm-text text-base">
            {t('deleteConfirmTitle')}
          </h3>
        </div>

        <p id="delete-dialog-desc" className="text-sm text-calm-muted leading-relaxed">
          {t('deleteConfirmMessage')}
        </p>

        <div className="p-2.5 rounded-xl bg-calm-surface border border-calm-border text-xs text-calm-text font-medium truncate">
          &ldquo;{taskTitle}&rdquo;
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 active:bg-rose-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('deleteConfirmButton')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
