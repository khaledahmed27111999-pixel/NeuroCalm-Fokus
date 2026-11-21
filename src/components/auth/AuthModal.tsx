import React, { useState, useEffect } from 'react';
import {
  X,
  Cloud,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  LogOut,
  Mail,
  Lock,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { useLocale } from '../../context/LocaleContext';
import { useAuth } from '../../hooks/useAuth';
import { useSync } from '../../hooks/useSync';
import { linkGuestMutationsToUser } from '../../services/outboxService';
import { Button } from '../common/Button';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type AuthTab = 'signin' | 'signup' | 'reset';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { t, direction } = useLocale();
  const { user, isAuthenticated, signIn, signUp, signOut, resetPassword } = useAuth();
  const { isSyncing, lastSyncedAt, pendingOutboxCount, lastError, syncNow } = useSync();

  const [activeTab, setActiveTab] = useState<AuthTab>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [linkLocalData, setLinkLocalData] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset internal states on open
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setSuccessNotice(null);
      setPassword('');
      setConfirmPassword('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (!email.trim() || !password) {
      setErrorMsg(t('authInvalidCredentials'));
      return;
    }

    setIsSubmitting(true);
    const res = await signIn(email, password);
    setIsSubmitting(false);

    if (res.success) {
      if (linkLocalData && user?.id) {
        linkGuestMutationsToUser(user.id);
      }
      syncNow().catch(() => {});
      onClose();
    } else {
      const err = res.error || '';
      if (err.toLowerCase().includes('invalid login credentials')) {
        setErrorMsg(t('authInvalidCredentials'));
      } else if (err.toLowerCase().includes('rate limit')) {
        setErrorMsg(t('authRateLimitError'));
      } else {
        setErrorMsg(err);
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (!email.trim() || !password) {
      setErrorMsg(t('authInvalidCredentials'));
      return;
    }

    if (password.length < 6) {
      setErrorMsg(t('authPasswordTooShort'));
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg(t('authPasswordMismatch'));
      return;
    }

    setIsSubmitting(true);
    const res = await signUp(email, password);
    setIsSubmitting(false);

    if (res.success) {
      if (res.requiresEmailConfirmation) {
        setSuccessNotice(t('authCheckEmailConfirmation'));
      } else {
        if (linkLocalData && user?.id) {
          linkGuestMutationsToUser(user.id);
        }
        syncNow().catch(() => {});
        onClose();
      }
    } else {
      const err = res.error || '';
      if (err.toLowerCase().includes('rate limit')) {
        setErrorMsg(t('authRateLimitError'));
      } else {
        setErrorMsg(err);
      }
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessNotice(null);

    if (!email.trim()) {
      setErrorMsg(t('authInvalidCredentials'));
      return;
    }

    setIsSubmitting(true);
    const res = await resetPassword(email);
    setIsSubmitting(false);

    if (res.success) {
      setSuccessNotice(t('authResetEmailSent'));
    } else {
      const err = res.error || '';
      if (err.toLowerCase().includes('rate limit')) {
        setErrorMsg(t('authRateLimitError'));
      } else {
        setErrorMsg(err);
      }
    }
  };

  const handleSignOut = async () => {
    setIsSubmitting(true);
    await signOut();
    setIsSubmitting(false);
    onClose();
  };

  const BackIcon = direction === 'rtl' ? ArrowRight : ArrowLeft;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div className="relative w-full max-w-md bg-calm-card border border-calm-border rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-calm-border mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-calm-primary/10 text-calm-primary flex items-center justify-center border border-calm-primary/20">
              <Cloud className="w-4 h-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="auth-modal-title" className="text-base font-semibold text-calm-text leading-tight">
                {isAuthenticated ? t('authAccountTitle') : t('authModalTitle')}
              </h2>
              <p className="text-xs text-calm-muted leading-tight">
                {isAuthenticated ? user?.email : t('authModalSubtitle')}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-calm-muted hover:text-calm-text p-1.5 rounded-lg hover:bg-calm-surface transition-colors"
            aria-label={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Authenticated View */}
        {isAuthenticated ? (
          <div className="space-y-5">
            <div className="p-4 rounded-xl bg-calm-surface/70 border border-calm-border space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-calm-muted">{t('authAccountSignedInAs')}</span>
                <span className="font-medium text-calm-text font-mono text-xs">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between text-xs pt-2 border-t border-calm-border/60">
                <span className="text-calm-muted">{t('syncStatusButtonTitle')}</span>
                <span className="flex items-center gap-1.5 font-medium text-calm-primary">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {t('syncStatusSynced')}
                </span>
              </div>
              {pendingOutboxCount > 0 && (
                <div className="text-xs text-amber-500 font-medium">
                  {t('syncStatusPending', { count: pendingOutboxCount })}
                </div>
              )}
              {lastSyncedAt && (
                <div className="text-[11px] text-calm-muted">
                  Last synced: {new Date(lastSyncedAt).toLocaleTimeString()}
                </div>
              )}
              {lastError && (
                <div className="text-xs text-rose-400">
                  {t('syncStatusError', { error: lastError })}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                size="md"
                className="flex-1 gap-2"
                onClick={() => syncNow()}
                disabled={isSyncing}
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                {t('syncNowButton')}
              </Button>
              <Button
                variant="secondary"
                size="md"
                className="gap-2 text-rose-400 hover:text-rose-300"
                onClick={handleSignOut}
                disabled={isSubmitting}
              >
                <LogOut className="w-4 h-4" />
                {t('authSignOutButton')}
              </Button>
            </div>

            <p className="text-xs text-calm-muted text-center leading-relaxed">
              {t('authSignOutConfirmMessage')}
            </p>
          </div>
        ) : (
          /* Unauthenticated Tabs & Forms */
          <div>
            {/* Tabs */}
            {activeTab !== 'reset' && (
              <div className="flex rounded-xl bg-calm-surface p-1 mb-5 border border-calm-border">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signin');
                    setErrorMsg(null);
                    setSuccessNotice(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'signin'
                      ? 'bg-calm-card text-calm-text shadow-sm'
                      : 'text-calm-muted hover:text-calm-text'
                  }`}
                >
                  {t('authTabSignIn')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('signup');
                    setErrorMsg(null);
                    setSuccessNotice(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    activeTab === 'signup'
                      ? 'bg-calm-card text-calm-text shadow-sm'
                      : 'text-calm-muted hover:text-calm-text'
                  }`}
                >
                  {t('authTabSignUp')}
                </button>
              </div>
            )}

            {/* Error & Success Feedback Banners */}
            {errorMsg && (
              <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMsg}</span>
              </div>
            )}

            {successNotice && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{successNotice}</span>
              </div>
            )}

            {/* Sign In Form */}
            {activeTab === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-calm-text mb-1">
                    {t('authEmailLabel')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-calm-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('authEmailPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 text-sm bg-calm-surface border border-calm-border rounded-lg text-calm-text placeholder-calm-muted focus:outline-none focus:ring-2 focus:ring-calm-primary"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-medium text-calm-text">
                      {t('authPasswordLabel')}
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('reset');
                        setErrorMsg(null);
                        setSuccessNotice(null);
                      }}
                      className="text-xs text-calm-primary hover:underline"
                    >
                      {t('authForgotPassword')}
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-calm-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('authPasswordPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 text-sm bg-calm-surface border border-calm-border rounded-lg text-calm-text placeholder-calm-muted focus:outline-none focus:ring-2 focus:ring-calm-primary"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="link-data-signin"
                    checked={linkLocalData}
                    onChange={(e) => setLinkLocalData(e.target.checked)}
                    className="rounded border-calm-border text-calm-primary focus:ring-calm-primary"
                  />
                  <label htmlFor="link-data-signin" className="text-xs text-calm-muted select-none">
                    {t('authLinkLocalDataLabel')}
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    t('authSignInButton')
                  )}
                </Button>
              </form>
            )}

            {/* Sign Up Form */}
            {activeTab === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-medium text-calm-text mb-1">
                    {t('authEmailLabel')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-calm-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('authEmailPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 text-sm bg-calm-surface border border-calm-border rounded-lg text-calm-text placeholder-calm-muted focus:outline-none focus:ring-2 focus:ring-calm-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-calm-text mb-1">
                    {t('authPasswordLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-calm-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t('authPasswordPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 text-sm bg-calm-surface border border-calm-border rounded-lg text-calm-text placeholder-calm-muted focus:outline-none focus:ring-2 focus:ring-calm-primary"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-calm-text mb-1">
                    {t('authConfirmPasswordLabel')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-calm-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder={t('authConfirmPasswordPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 text-sm bg-calm-surface border border-calm-border rounded-lg text-calm-text placeholder-calm-muted focus:outline-none focus:ring-2 focus:ring-calm-primary"
                    />
                  </div>
                </div>

                <div className="pt-1 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="link-data-signup"
                    checked={linkLocalData}
                    onChange={(e) => setLinkLocalData(e.target.checked)}
                    className="rounded border-calm-border text-calm-primary focus:ring-calm-primary"
                  />
                  <label htmlFor="link-data-signup" className="text-xs text-calm-muted select-none">
                    {t('authLinkLocalDataLabel')}
                  </label>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full mt-2"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    t('authSignUpButton')
                  )}
                </Button>
              </form>
            )}

            {/* Reset Password Form */}
            {activeTab === 'reset' && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-calm-text mb-1">
                    {t('authEmailLabel')}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-calm-muted absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t('authEmailPlaceholder')}
                      className="w-full ps-9 pe-3 py-2 text-sm bg-calm-surface border border-calm-border rounded-lg text-calm-text placeholder-calm-muted focus:outline-none focus:ring-2 focus:ring-calm-primary"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    t('authResetButton')
                  )}
                </Button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('signin');
                      setErrorMsg(null);
                      setSuccessNotice(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-xs text-calm-muted hover:text-calm-text"
                  >
                    <BackIcon className="w-3.5 h-3.5" />
                    {t('authBackToSignIn')}
                  </button>
                </div>
              </form>
            )}

            {/* Local-First Privacy Notice */}
            <div className="mt-5 pt-4 border-t border-calm-border flex items-start gap-2 text-[11px] text-calm-muted">
              <ShieldCheck className="w-4 h-4 shrink-0 text-calm-primary mt-0.5" />
              <p className="leading-relaxed">{t('authLocalFirstNotice')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
