/**
 * useRealtimeEvents — subscribe to Supabase Realtime postgres_changes.
 * Returns live events and connection status.
 *
 * Usage:
 *   const { events, status } = useRealtimeEvents({
 *     supabaseClient,
 *     table: 'calendar_events',
 *     filter: 'calendar_id=eq.my-cal',
 *   });
 */
import { useState, useEffect, useRef } from 'react';

export function useRealtimeEvents({ supabaseClient, table, filter }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('disabled');
  const channelRef = useRef(null);

  useEffect(() => {
    if (!supabaseClient || !table) {
      setStatus('disabled');
      setEvents([]);
      return;
    }

    setStatus('connecting');

    const chanName = `wc-rt-${table}-${filter ?? 'all'}`;
    const pgFilter = { event: '*', schema: 'public', table };
    if (filter) pgFilter.filter = filter;

    const channel = supabaseClient
      .channel(chanName)
      .on('postgres_changes', pgFilter, (payload) => {
        const { eventType, new: newRow, old: oldRow } = payload;
        setEvents(prev => {
          switch (eventType) {
            case 'INSERT': return [...prev, newRow];
            case 'UPDATE': return prev.map(e => String(e.id) === String(newRow.id) ? newRow : e);
            case 'DELETE': return prev.filter(e => String(e.id) !== String(oldRow.id));
            default: return prev;
          }
        });
      })
      .subscribe((s) => {
        if (s === 'SUBSCRIBED')    setStatus('live');
        else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') setStatus('error');
      });

    channelRef.current = channel;

    // Also do an initial fetch if possible
    supabaseClient
      .from(table)
      .select('*')
      .then(({ data, error }) => {
        if (!error && data) setEvents(data);
      })
      .catch(() => { /* optional, may not have select permissions */ });

    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [supabaseClient, table, filter]);

  return { events, status };
}
