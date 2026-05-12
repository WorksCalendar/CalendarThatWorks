import { WifiOff } from 'lucide-react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import styles from './OfflineIndicator.module.css';

/**
 * Renders a subtle banner at the top of the calendar when the browser reports
 * no network connectivity. Disappears automatically when the connection
 * is restored.
 */
export default function OfflineIndicator() {
  const { isOnline, isInitializing } = useNetworkStatus();

  if (isInitializing || isOnline) return null;

  return (
    <div className={styles['banner']} role="status" aria-live="polite">
      <WifiOff size={13} aria-hidden="true" />
      <span>You're offline — changes will sync when you reconnect.</span>
    </div>
  );
}
