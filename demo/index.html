import React from 'react';
import { createRoot } from 'react-dom/client';
import { WorksCalendar } from '../src/index';
import '../src/index.css';

const events = [
  { id: '1', title: 'Team Sync', start: new Date(2026, 4, 11, 9), end: new Date(2026, 4, 11, 10) },
  { id: '2', title: 'Design Review', start: new Date(2026, 4, 13, 14), end: new Date(2026, 4, 13, 15) },
  { id: '3', title: 'Sprint Planning', start: new Date(2026, 4, 15, 10), end: new Date(2026, 4, 15, 11) },
  { id: '4', title: 'Retrospective', start: new Date(2026, 4, 11, 11), end: new Date(2026, 4, 11, 12) },
];

function App() {
  const [evts, setEvts] = React.useState(events);
  return (
    <div style={{ height: '100vh', padding: 16 }}>
      <WorksCalendar
        defaultView="month"
        events={evts}
        permissions={{ canDrag: true }}
        onEventMove={(ev, newStart, newEnd) =>
          setEvts(prev => prev.map(e => e.id === ev.id ? { ...e, start: newStart, end: newEnd } : e))
        }
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
