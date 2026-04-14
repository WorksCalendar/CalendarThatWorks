# Advanced Filters & Smart Views

WorksCalendar filtering is schema-driven, so host apps can extend filter dimensions without rewriting filter UI.

## Built-in capabilities

- Multi-select filters (`categories`, `resources`, `sources`)
- Search text filter
- Active filter pills
- Clear-all and per-pill clearing
- Saved views with optional pinned view mode

## Smart Views

Saved views capture:
- filter state
- optional preferred calendar view
- optional color/tag metadata

These views are ideal for team-specific presets like:
- "On-call this week"
- "Incidents only"
- "Operations timeline"

## Advanced Builder (Wizard)

The Setup Wizard includes a visual builder for nested logic groups:
- `AND` groups
- `OR` groups
- Live filter previews before save

Use this to create robust starter presets during onboarding.

## Custom schema example

```jsx
import {
  priorityField,
  ownerField,
  tagsField,
  DEFAULT_FILTER_SCHEMA,
} from 'works-calendar';

const schema = [
  ...DEFAULT_FILTER_SCHEMA,
  priorityField(),
  ownerField(),
  tagsField(),
];

<WorksCalendar filterSchema={schema} events={events} />
```
