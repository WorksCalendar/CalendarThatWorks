import { useState } from 'react';
import { Settings, Eye, EyeOff } from 'lucide-react';
import styles from './OwnerLock.module.css';

export default function OwnerLock({ isOwner, authError, isAuthLoading, onAuthenticate, onOpen }) {
  const [show, setShow] = useState(false);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);

  function handleGearClick() {
    if (isOwner) {
      onOpen();
    } else {
      setShow(s => !s);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    onAuthenticate(password);
    setPassword('');
  }

  return (
    <div className={styles.wrap}>
      <button
        className={styles.gear}
        onClick={handleGearClick}
        aria-label={isOwner ? 'Open settings' : 'Owner login'}
        title={isOwner ? 'Settings' : 'Owner access'}
      >
        <Settings size={16} />
      </button>

      {show && !isOwner && (
        <div className={styles.prompt}>
          <form onSubmit={handleSubmit} className={styles.form}>
            <label className={styles.label}>Owner password</label>
            <div className={styles.inputRow}>
              <input
                type={showPw ? 'text' : 'password'}
                className={styles.input}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password…"
                autoFocus
              />
              <button type="button" className={styles.togglePw} onClick={() => setShowPw(p => !p)} tabIndex={-1}>
                {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
            {authError && <span className={styles.error}>{authError}</span>}
            <button type="submit" className={styles.submit} disabled={isAuthLoading}>
              {isAuthLoading ? 'Checking…' : 'Unlock'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
