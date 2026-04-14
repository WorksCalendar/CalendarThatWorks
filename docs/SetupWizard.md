# Setup Wizard

The Setup Wizard is a first-time onboarding modal for calendar owners.

## Behavior

- Opens automatically once for owners when `setupCompleted` is missing/false.
- Can be reopened manually from the toolbar (magic-wand button).
- Persists setup state through owner config.

## What it configures

1. **Theme selection**
2. **Team setup** (members/profile metadata)
3. **Categories** for event taxonomy
4. **Starter smart views** using advanced filter logic

## Typical flow

1. Render `WorksCalendar` with a stable `calendarId`.
2. Provide an `ownerPassword` so owner mode can authenticate.
3. Complete wizard once; config persists under that `calendarId`.

```jsx
<WorksCalendar
  calendarId="team-alpha"
  ownerPassword={process.env.REACT_APP_OWNER_PASSWORD}
  events={events}
  onEventSave={saveEvent}
/>
```

## Tips

- Seed a few categories/resources before onboarding demos.
- Pair wizard onboarding with saved-view defaults for new teams.
- Never use demo passwords in production.
