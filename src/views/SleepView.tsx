/**
 * NeuroCalm & Fokus — Sleep View (Pillar 4)
 * Phase S4–S8: Top-level view container for the complete Sleep section.
 * Supports smooth subview transitions between:
 * - Sleep Dashboard
 * - Sleep Preparation (Wind-down routine)
 * - Sleep Sounds & Night Soundscapes
 * - Sleep Schedule & Preferences
 * - Sleep Insights & Analytics
 */

import React, { useState } from 'react';
import { SleepDashboard } from '../components/sleep/SleepDashboard';
import { SleepPreparationRoutine } from '../components/sleep/SleepPreparationRoutine';
import { SleepSoundsView } from '../components/sleep/SleepSoundsView';
import { SleepScheduleView } from '../components/sleep/SleepScheduleView';
import { SleepInsightsView } from '../components/sleep/SleepInsightsView';

export type SleepSubView =
  | 'dashboard'
  | 'preparation'
  | 'sounds'
  | 'schedule'
  | 'insights';

export const SleepView: React.FC = () => {
  const [subView, setSubView] = useState<SleepSubView>('dashboard');

  return (
    <div
      role="tabpanel"
      id="panel-sleep"
      aria-labelledby="tab-sleep"
      className="space-y-6"
    >
      {subView === 'dashboard' && (
        <SleepDashboard
          onOpenPreparation={() => setSubView('preparation')}
          onOpenSounds={() => setSubView('sounds')}
          onOpenSchedule={() => setSubView('schedule')}
          onOpenInsights={() => setSubView('insights')}
        />
      )}
      {subView === 'preparation' && (
        <SleepPreparationRoutine onBack={() => setSubView('dashboard')} />
      )}
      {subView === 'sounds' && (
        <SleepSoundsView onBack={() => setSubView('dashboard')} />
      )}
      {subView === 'schedule' && (
        <SleepScheduleView onBack={() => setSubView('dashboard')} />
      )}
      {subView === 'insights' && (
        <SleepInsightsView onBack={() => setSubView('dashboard')} />
      )}
    </div>
  );
};
