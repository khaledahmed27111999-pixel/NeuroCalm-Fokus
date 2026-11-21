import React, { useState } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { LocaleProvider } from './context/LocaleContext';
import { WisdomProvider } from './context/WisdomContext';
import { FocusProvider } from './context/FocusContext';
import { AudioProvider } from './context/AudioProvider';
import { BreathingProvider } from './context/BreathingContext';
import { RelaxationSessionProvider } from './context/RelaxationSessionContext';
import { SleepTimerProvider } from './context/SleepTimerContext';
import { SleepProvider } from './context/SleepContext';
import { AppShell } from './components/layout/AppShell';
import { PillarTab } from './types/navigation';
import { PlanView } from './views/PlanView';
import { FocusView } from './views/FocusView';
import { RecoverView } from './views/RecoverView';
import { SleepView } from './views/SleepView';
import { WisdomToast } from './components/wisdom/WisdomToast';
import { GlobalAudioBar } from './components/audio/GlobalAudioBar';

const MainApp: React.FC = () => {
  const [activeTab, setActiveTab] = useState<PillarTab>('plan');

  return (
    <>
      <AppShell activeTab={activeTab} onTabChange={setActiveTab}>
        {activeTab === 'plan' && <PlanView />}
        {activeTab === 'focus' && <FocusView />}
        {activeTab === 'recover' && <RecoverView />}
        {activeTab === 'sleep' && <SleepView />}
      </AppShell>
      <GlobalAudioBar
        currentTab={activeTab}
        onNavigateToRecover={() => setActiveTab('recover')}
      />
      <WisdomToast />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <WisdomProvider>
          <FocusProvider>
            <AudioProvider>
              <BreathingProvider>
                <RelaxationSessionProvider>
                  <SleepTimerProvider>
                    <SleepProvider>
                      <MainApp />
                    </SleepProvider>
                  </SleepTimerProvider>
                </RelaxationSessionProvider>
              </BreathingProvider>
            </AudioProvider>
          </FocusProvider>
        </WisdomProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
};

export default App;
