export type PillarTab = 'plan' | 'focus' | 'recover' | 'sleep';

export interface NavigationItem {
  id: PillarTab;
  labelKey: 'navPlan' | 'navFocus' | 'navRecover' | 'navSleep';
  descriptionKey: 'planSubtitle' | 'focusSubtitle' | 'recoverSubtitle' | 'sleepSubtitle';
}

