import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Hourglass, Flag, AlertCircle } from 'lucide-react';
import { Task, TaskPriority, CreateTaskInput, UpdateTaskInput } from '../../types/task';
import { useLocale } from '../../context/LocaleContext';
import { Button } from '../common/Button';

interface DetailedTaskFormProps {
  initialData?: Task;
  isOpen: boolean;
  onSave: (data: CreateTaskInput | UpdateTaskInput) => boolean;
  onCancel: () => void;
}

export const DetailedTaskForm: React.FC<DetailedTaskFormProps> = ({
  initialData,
  isOpen,
  onSave,
  onCancel,
}) => {
  const { t } = useLocale();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [duration, setDuration] = useState('');
  const [errors, setErrors] = useState<{ title?: string; duration?: string }>({});
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Initialize or reset form when initialData or isOpen changes
  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title);
      setDescription(initialData.description || '');
      setPriority(initialData.priority);
      setDueDate(initialData.dueDate || '');
      setDueTime(initialData.dueTime || '');
      setDuration(
        initialData.estimatedDurationMinutes !== undefined
          ? String(initialData.estimatedDurationMinutes)
          : ''
      );
    } else {
      setTitle('');
      setDescription('');
      setPriority('medium');
      setDueDate('');
      setDueTime('');
      setDuration('');
    }
    setErrors({});
    setShowDiscardConfirm(false);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Check if user made unsaved changes
  const hasChanges = () => {
    if (initialData) {
      return (
        title !== initialData.title ||
        description !== (initialData.description || '') ||
        priority !== initialData.priority ||
        dueDate !== (initialData.dueDate || '') ||
        dueTime !== (initialData.dueTime || '') ||
        duration !==
          (initialData.estimatedDurationMinutes !== undefined
            ? String(initialData.estimatedDurationMinutes)
            : '')
      );
    }
    return (
      title.trim().length > 0 ||
      description.trim().length > 0 ||
      priority !== 'medium' ||
      dueDate.length > 0 ||
      dueTime.length > 0 ||
      duration.length > 0
    );
  };

  const handleCancelClick = () => {
    if (hasChanges()) {
      setShowDiscardConfirm(true);
    } else {
      onCancel();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { title?: string; duration?: string } = {};

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      newErrors.title = t('taskTitleRequired');
    }

    let parsedDuration: number | undefined = undefined;
    if (duration.trim().length > 0) {
      const num = Number(duration);
      if (isNaN(num) || num <= 0 || !Number.isInteger(num)) {
        newErrors.duration = t('taskDurationInvalid');
      } else {
        parsedDuration = num;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const payload: CreateTaskInput | UpdateTaskInput = {
      title: trimmedTitle,
      description: description.trim() || undefined,
      priority,
      dueDate: dueDate || undefined,
      dueTime: dueTime || undefined,
      estimatedDurationMinutes: parsedDuration,
    };

    const success = onSave(payload);
    if (success) {
      onCancel();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="detailed-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
    >
      <div className="w-full max-w-lg bg-calm-card border border-calm-border rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-calm-border bg-calm-surface/40">
          <h2 id="detailed-form-title" className="text-base sm:text-lg font-semibold text-calm-text">
            {initialData ? t('edit') : t('detailedAddButton')}
          </h2>
          <button
            type="button"
            onClick={handleCancelClick}
            aria-label={t('cancel')}
            className="p-1 rounded-lg text-calm-muted hover:text-calm-text hover:bg-calm-surface transition-colors"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Title */}
          <div className="space-y-1.5">
            <label htmlFor="task-title" className="block text-xs font-semibold text-calm-text">
              {t('taskTitleLabel')} <span className="text-emerald-500">*</span>
            </label>
            <input
              id="task-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (errors.title) setErrors((prev) => ({ ...prev, title: undefined }));
              }}
              placeholder={t('taskTitlePlaceholder')}
              className={`w-full px-3.5 py-2 text-sm rounded-xl bg-calm-surface border ${
                errors.title ? 'border-rose-500' : 'border-calm-border'
              } text-calm-text placeholder:text-calm-muted/60 focus:outline-none focus:ring-2 focus:ring-calm-primary/50`}
            />
            {errors.title && <p className="text-xs text-rose-500 font-medium">{errors.title}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label htmlFor="task-desc" className="block text-xs font-semibold text-calm-text">
              {t('taskDescriptionLabel')}
            </label>
            <textarea
              id="task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('taskDescriptionPlaceholder')}
              className="w-full px-3.5 py-2 text-sm rounded-xl bg-calm-surface border border-calm-border text-calm-text placeholder:text-calm-muted/60 focus:outline-none focus:ring-2 focus:ring-calm-primary/50 resize-none"
            />
          </div>

          {/* Priority (Accessible Segmented Control with Icons & Text) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-calm-text">
              {t('taskPriorityLabel')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['low', 'medium', 'high'] as TaskPriority[]).map((p) => {
                const isSelected = priority === p;
                const priorityLabels = {
                  low: t('priorityLow'),
                  medium: t('priorityMedium'),
                  high: t('priorityHigh'),
                };
                const badgeStyles = {
                  low: isSelected
                    ? 'bg-slate-500/20 text-slate-300 border-slate-400'
                    : 'bg-calm-surface text-calm-muted border-calm-border',
                  medium: isSelected
                    ? 'bg-blue-500/20 text-blue-400 border-blue-400'
                    : 'bg-calm-surface text-calm-muted border-calm-border',
                  high: isSelected
                    ? 'bg-amber-500/20 text-amber-400 border-amber-400'
                    : 'bg-calm-surface text-calm-muted border-calm-border',
                };
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-medium transition-all ${badgeStyles[p]}`}
                  >
                    <Flag className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{priorityLabels[p]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Due Date & Time Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label htmlFor="task-due-date" className="flex items-center gap-1.5 text-xs font-semibold text-calm-text">
                <Calendar className="w-3.5 h-3.5 text-calm-muted" aria-hidden="true" />
                <span>{t('taskDueDateLabel')}</span>
              </label>
              <input
                id="task-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-calm-surface border border-calm-border text-calm-text focus:outline-none focus:ring-2 focus:ring-calm-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="task-due-time" className="flex items-center gap-1.5 text-xs font-semibold text-calm-text">
                <Clock className="w-3.5 h-3.5 text-calm-muted" aria-hidden="true" />
                <span>{t('taskDueTimeLabel')}</span>
              </label>
              <input
                id="task-due-time"
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl bg-calm-surface border border-calm-border text-calm-text focus:outline-none focus:ring-2 focus:ring-calm-primary/50"
              />
            </div>
          </div>

          {/* Estimated Duration */}
          <div className="space-y-1.5">
            <label htmlFor="task-duration" className="flex items-center gap-1.5 text-xs font-semibold text-calm-text">
              <Hourglass className="w-3.5 h-3.5 text-calm-muted" aria-hidden="true" />
              <span>{t('taskDurationLabel')}</span>
            </label>
            <input
              id="task-duration"
              type="number"
              min="1"
              step="1"
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value);
                if (errors.duration) setErrors((prev) => ({ ...prev, duration: undefined }));
              }}
              placeholder="e.g. 25"
              className={`w-full px-3.5 py-2 text-sm rounded-xl bg-calm-surface border ${
                errors.duration ? 'border-rose-500' : 'border-calm-border'
              } text-calm-text placeholder:text-calm-muted/60 focus:outline-none focus:ring-2 focus:ring-calm-primary/50`}
            />
            {errors.duration && (
              <p className="text-xs text-rose-500 font-medium">{errors.duration}</p>
            )}
          </div>

          {/* Buttons Footer */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-calm-border">
            <Button type="button" variant="secondary" onClick={handleCancelClick}>
              {t('cancel')}
            </Button>
            <Button type="submit" variant="primary">
              {initialData ? t('save') : t('create')}
            </Button>
          </div>
        </form>
      </div>

      {/* Discard Changes Sub-Dialog */}
      {showDiscardConfirm && (
        <div
          role="alertdialog"
          aria-modal="true"
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm p-6 bg-calm-card border border-calm-border rounded-2xl shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-400">
              <AlertCircle className="w-6 h-6 shrink-0" aria-hidden="true" />
              <h3 className="font-semibold text-calm-text text-base">{t('unsavedChangesTitle')}</h3>
            </div>
            <p className="text-sm text-calm-muted leading-relaxed">
              {t('unsavedChangesMessage')}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowDiscardConfirm(false)}
              >
                {t('keepEditing')}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onCancel();
                }}
              >
                {t('discard')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
