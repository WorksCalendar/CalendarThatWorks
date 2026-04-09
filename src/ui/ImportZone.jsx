/**
 * ImportZone — drag-and-drop + file-picker for .ics imports.
 * Parses the file and shows ImportPreview for confirmation.
 */
import { useState, useRef } from 'react';
import { Upload } from 'lucide-react';
import { parseICS } from '../core/icalParser.js';
import ImportPreview from './ImportPreview.jsx';
import styles from './ImportZone.module.css';

export default function ImportZone({ onImport, onClose }) {
  const [dragging,  setDragging]  = useState(false);
  const [parsed,    setParsed]    = useState(null);
  const [error,     setError]     = useState(null);
  const inputRef = useRef(null);

  function processFile(file) {
    if (!file) return;
    const isICS = file.name?.toLowerCase().endsWith('.ics')
               || file.type?.includes('calendar');
    if (!isICS) {
      setError('Please choose a .ics calendar file.');
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const events = parseICS(e.target.result);
        if (!events.length) {
          setError('No events found in this file.');
          return;
        }
        setParsed(events);
      } catch (err) {
        setError(`Could not parse file: ${err.message}`);
      }
    };
    reader.onerror = () => setError('Could not read file.');
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }

  if (parsed) {
    return (
      <ImportPreview
        events={parsed}
        onImport={onImport}
        onClose={onClose}
      />
    );
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={[styles.zone, dragging && styles.dragging].filter(Boolean).join(' ')}
        onClick={e => e.stopPropagation()}
        onDrop={handleDrop}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDragEnter={e => { e.preventDefault(); setDragging(true); }}
      >
        <div className={styles.iconWrap}>
          <Upload size={32} />
        </div>
        <h2 className={styles.heading}>Import iCal / ICS</h2>
        <p className={styles.hint}>
          Drag &amp; drop a <code>.ics</code> file here, or click to browse
        </p>

        {error && <p className={styles.error}>{error}</p>}

        <button
          className={styles.browseBtn}
          onClick={() => inputRef.current?.click()}
        >
          Choose File
        </button>

        <input
          ref={inputRef}
          type="file"
          accept=".ics,text/calendar"
          className={styles.hiddenInput}
          onChange={e => processFile(e.target.files[0])}
        />

        <button className={styles.cancelLink} onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}
