/**
 * MapView smoke tests.
 *
 * The map runtime peers (`react-map-gl`, `maplibre-gl`) are now available in
 * this repo via devDependencies, so we use `vi.mock` to drive both paths:
 *   1. Module-not-found → instructional fallback UI
 *   2. Module resolves with stubbed exports → happy-path renders
 *
 * Real MapLibre rendering needs a WebGL canvas, which happy-dom doesn't
 * provide. We stub the components to plain DOM so we can verify wiring
 * (markers receive coords, popup opens on click) without a real GL context.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import { CalendarContext } from '../../core/CalendarContext';

vi.unmock('react-map-gl/maplibre');

afterEach(() => {
  cleanup();
  vi.resetModules();
  vi.doUnmock('react-map-gl/maplibre');
});

function d(year: number, month: number, day: number) {
  return new Date(year, month - 1, day);
}

async function renderMap(props: Record<string, any> = {}) {
  // Import after any vi.mock in the test so the mock is in effect.
  const { default: MapView } = await import('../MapView');
  return render(
    <CalendarContext.Provider value={null}>
      <MapView events={[]} {...props} />
    </CalendarContext.Provider>,
  );
}

describe('MapView — fallback when map peer cannot be resolved', () => {
  it('renders an install hint when react-map-gl import rejects', async () => {
    vi.doMock('react-map-gl/maplibre', () => {
      throw new Error('Cannot find module react-map-gl/maplibre');
    });
    await renderMap({ events: [] });
    await waitFor(() => {
      expect(screen.getByText(/Map view requires/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/npm install maplibre-gl react-map-gl/)).toBeInTheDocument();
  });
});

describe('MapView — happy path with stubbed runtime', () => {
  function installStub() {
    vi.doMock('react-map-gl/maplibre', () => ({
      Map: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', { 'data-testid': 'map' }, children),
      Marker: ({ children, longitude, latitude, onClick }: any) =>
        React.createElement(
          'button',
          {
            'data-testid': 'marker',
            'data-lng': longitude,
            'data-lat': latitude,
            onClick: (e: any) => onClick?.({ originalEvent: e }),
          },
          children,
        ),
      Popup: ({ children }: { children?: React.ReactNode }) =>
        React.createElement('div', { 'data-testid': 'popup' }, children),
      NavigationControl: () =>
        React.createElement('div', { 'data-testid': 'nav-control' }),
    }));
  }

  it('renders a marker per event with meta.coords', async () => {
    installStub();
    const events = [
      { id: 'a', title: 'Phoenix', start: d(2026, 4, 21),
        meta: { coords: { lat: 33.43, lon: -112.01 } } },
      { id: 'b', title: 'Boston', start: d(2026, 4, 22),
        meta: { coords: { lat: 42.36, lon: -71.06 } } },
    ];
    await renderMap({ events });
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(2);
    });
  });

  it('also accepts loose meta.lat / meta.lon shape', async () => {
    installStub();
    const events = [
      { id: 'a', title: 'Loose', start: d(2026, 4, 21),
        meta: { lat: 33.43, lon: -112.01 } },
    ];
    await renderMap({ events });
    await waitFor(() => {
      expect(screen.getAllByTestId('marker')).toHaveLength(1);
    });
  });

  it('renders the no-coords hint when no events have coordinates', async () => {
    installStub();
    const events = [{ id: 'a', title: 'No coords', start: d(2026, 4, 21) }];
    await renderMap({ events });
    await waitFor(() => {
      expect(screen.getByText(/No events have coordinates yet/i)).toBeInTheDocument();
    });
  });

  it('fires onEventClick when a marker is clicked', async () => {
    installStub();
    const onEventClick = vi.fn();
    const events = [
      { id: 'a', title: 'Phoenix', start: d(2026, 4, 21),
        meta: { coords: { lat: 33.43, lon: -112.01 } } },
    ];
    await renderMap({ events, onEventClick });
    await waitFor(() => {
      expect(screen.getByTestId('marker')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByTestId('marker'));
    expect(onEventClick).toHaveBeenCalledWith(events[0]);
  });
});
