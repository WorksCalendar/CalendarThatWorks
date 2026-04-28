# ConfigWizard

The `ConfigWizard` is the capstone UI for issue #386 — a guided
five-step modal that walks a host (or end user) through producing
a complete `CalendarConfig`. It composes every primitive that
landed earlier in the v2 work: profile presets, the resource +
pool catalogs, `PoolBuilder` for individual pool authoring,
`validateConfig` for the review step, and `serializeConfig` for
the JSON output.

> Distinct from the existing `SetupWizardModal` (the first-time
> owner setup flow documented in `docs/SetupWizard.md`).
> `ConfigWizard` is specifically for editing the standard
> `CalendarConfig` shape introduced in #440.

## Mounting

```tsx
import { ConfigWizard } from 'works-calendar';
import { useState } from 'react';

function OnboardingButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Set up calendar</button>
      {open && (
        <ConfigWizard
          onComplete={(config) => {
            persist(config);
            setOpen(false);
          }}
          onCancel={() => setOpen(false)}
        />
      )}
    </>
  );
}
```

Pass `initialConfig` to edit an existing setup; the wizard seeds
every step from it. Round-trip is total — opening, walking
through, and finishing without changes returns the config
unchanged.

## Steps

| # | Step              | What it does                                                                                          |
|---|-------------------|--------------------------------------------------------------------------------------------------------|
| 1 | Profile           | Pick a starter preset (Trucking / Aviation / Scheduling / Custom). Uses `applyProfilePreset` so seeding never overwrites edits the user already made. |
| 2 | Types & roles     | Edit the `resourceTypes` and `roles` catalogs. Add / remove / rename inline.                           |
| 3 | Resources         | Edit the resource registry. Each row captures id, name, type (dropdown sourced from step 2), and lat/lon. |
| 4 | Pools             | List of `PoolCard`s with edit / disable / delete affordances. "+ Add pool" opens the existing `PoolBuilder` modal. The wizard adapts the config's resources to the engine shape so the live preview / capability discovery work normally. |
| 5 | Review            | Settings (`conflictMode`, `timezone`), live `validateConfig` results with paths, and the serialized JSON. The "Finish" button hands the final config to `onComplete`. |

The breadcrumbs are clickable — users can jump to any step at any
time. The wizard never blocks navigation on the current step's
state; the Review step's validation pane is the single source of
truth for "is this config OK to ship?".

## Composition with existing primitives

The wizard intentionally re-uses what's already in the library:

- **Profile picker** → `applyProfilePreset` / `listProfilePresets`
- **Pools step** → `PoolCard` + `PoolBuilder` (live preview, advanced rules editor, range pickers, path autocomplete — all of it)
- **Review step** → `validateConfig` + `serializeConfig`

Anything those components already do (capability discovery,
preserved-clause round-trip, distance pools, etc.) just works
inside the wizard for free.

## Out of scope

- **Sample data generation** — the user fills the registry; the wizard doesn't seed concrete resources.
- **Industry-specific capability lists** — `PoolBuilder` already auto-derives capabilities from the live registry, so the wizard doesn't curate.
- **Per-resource `meta.roles` editor** — hosts wire role tags via JSON for now; a chip picker is a follow-up.
- **File-system download** — the Review step exposes a JSON code block users can copy. No `<a download>` plumbing.
- **i18n** — labels are English-only for v1.
