import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { WisdomMessage, WisdomContextType } from '../types/wisdom';
import { WISDOM_MESSAGES } from '../data/wisdom';
import { selectRandomWisdom, getWisdomById, getDefaultWisdom } from '../utils/wisdom';
import { loadLatestWisdomIdFromStorage, saveLatestWisdomIdToStorage } from '../storage/wisdomStorage';

const WisdomContext = createContext<WisdomContextType | undefined>(undefined);

export const WisdomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentWisdom, setCurrentWisdom] = useState<WisdomMessage>(() => {
    const savedId = loadLatestWisdomIdFromStorage();
    if (savedId) {
      const match = getWisdomById(WISDOM_MESSAGES, savedId);
      if (match) return match;
    }
    return getDefaultWisdom(WISDOM_MESSAGES);
  });

  const [activeToast, setActiveToast] = useState<WisdomMessage | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setActiveToast(null);
  }, []);

  const triggerWisdom = useCallback(() => {
    setCurrentWisdom((prev) => {
      const next = selectRandomWisdom(WISDOM_MESSAGES, prev.id);
      saveLatestWisdomIdToStorage(next.id);

      // Show toast and reset auto-dismiss timer
      setActiveToast(next);

      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }

      toastTimerRef.current = window.setTimeout(() => {
        setActiveToast(null);
        toastTimerRef.current = null;
      }, 4500);

      return next;
    });
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  return (
    <WisdomContext.Provider
      value={{
        currentWisdom,
        activeToast,
        triggerWisdom,
        dismissToast,
      }}
    >
      {children}
    </WisdomContext.Provider>
  );
};

export function useWisdom(): WisdomContextType {
  const context = useContext(WisdomContext);
  if (!context) {
    throw new Error('useWisdom must be used within a WisdomProvider');
  }
  return context;
}
