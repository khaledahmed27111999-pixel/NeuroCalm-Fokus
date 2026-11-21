import React from 'react';
import { LayoutDashboard, Plus } from 'lucide-react';
import { DashboardMetrics } from '../../types/dashboard';
import { useLocale } from '../../context/LocaleContext';
import { WorkloadSummaryCard } from './WorkloadSummaryCard';
import { PriorityDistributionCard } from './PriorityDistributionCard';
import { UpcomingDeadlinesCard } from './UpcomingDeadlinesCard';
import { RecentActivityCard } from './RecentActivityCard';
import { WisdomCard } from '../wisdom/WisdomCard';

interface DashboardViewProps {
  metrics: DashboardMetrics;
  onToggleStatus: (id: string) => void;
  onNavigateToCreateTask: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  onToggleStatus,
  onNavigateToCreateTask,
}) => {
  const { t } = useLocale();

  if (metrics.totalTasks === 0) {
    return (
      <div className="space-y-5 sm:space-y-6">
        <div className="p-8 sm:p-12 rounded-2xl bg-calm-card border border-calm-border text-center space-y-4 shadow-sm">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-calm-surface border border-calm-border flex items-center justify-center text-calm-primary">
            <LayoutDashboard className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-base sm:text-lg font-semibold text-calm-text">
              {t('dashboardEmptyTitle')}
            </h3>
            <p className="text-sm text-calm-muted leading-relaxed">
              {t('dashboardEmptyDescription')}
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={onNavigateToCreateTask}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-calm-primary text-white text-sm font-medium hover:bg-emerald-600 active:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-calm-primary shadow-sm"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              {t('createFirstTask')}
            </button>
          </div>
        </div>

        {/* Persistent Wisdom Card in Empty State */}
        <WisdomCard />
      </div>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* 1. Workload Summary (Full Width) */}
      <WorkloadSummaryCard metrics={metrics} />

      {/* 2. Deadlines and Distribution / Recent Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        {/* Deadlines Column */}
        <div>
          <UpcomingDeadlinesCard
            metrics={metrics}
            onToggleStatus={onToggleStatus}
          />
        </div>

        {/* Priority, Wisdom & Recent Activity Column */}
        <div className="space-y-5 sm:space-y-6">
          <PriorityDistributionCard metrics={metrics} />
          <WisdomCard />
          <RecentActivityCard
            metrics={metrics}
            onToggleStatus={onToggleStatus}
          />
        </div>
      </div>
    </div>
  );
};
