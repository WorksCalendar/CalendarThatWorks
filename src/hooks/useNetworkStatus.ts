import { useState, useEffect } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  /** True on first render before the browser status is known. */
  isInitializing: boolean;
}

/**
 * Reactively tracks navigator.onLine. Returns the current connectivity state
 * and subscribes to the browser's online/offline events so the value stays
 * up-to-date without polling.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );
  const [isInitializing, setIsInitializing] = useState(
    typeof navigator === 'undefined',
  );

  useEffect(() => {
    setIsOnline(navigator.onLine);
    setIsInitializing(false);

    const handleOnline  = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online',  handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online',  handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, isInitializing };
}
