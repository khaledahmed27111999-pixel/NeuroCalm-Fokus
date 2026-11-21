export type WisdomCategory =
  | 'perseverance'
  | 'starting'
  | 'recovery'
  | 'rest'
  | 'patience'
  | 'small_steps';

export interface WisdomMessage {
  id: string;
  category: WisdomCategory;
  text: {
    ar: string;
    en: string;
  };
  author?: {
    ar: string;
    en: string;
  };
}

export interface StoredWisdom {
  id: string;
  selectedAt: number;
}

export interface WisdomContextType {
  currentWisdom: WisdomMessage;
  activeToast: WisdomMessage | null;
  triggerWisdom: () => void;
  dismissToast: () => void;
}
