# Manual Demo Release Checklist

The full guided demo walkthrough is intentionally **manual-only**.

Reason: this scenario has proven too brittle for reliable automation (drag + guided-tour overlays + conflict modal timing), and should not block PR CI. Automated E2E remains focused on stable smoke coverage.

## Full demo walkthrough verification

1. Open the demo with a reset state: `/?resetDemo=1`.
2. Start or restart the guided tour.
3. Confirm **Mission Alpha** is visible.
4. Move Mission Alpha in the calendar UI.
5. Confirm the tour advances after the move.
6. Open Mission Alpha details/edit.
7. Assign `emp-james`.
8. Save.
9. Confirm the conflict dialog appears.
10. Click the conflict override button.
11. Reassign Mission Alpha to `emp-rivera` (or another non-conflicting pilot).
12. Switch to **Schedule** view.
13. Confirm Mission Alpha appears in Schedule view under the updated assignment.
14. Confirm there are no obvious console/runtime errors.

## Automated E2E policy

Automated E2E should remain small and stable:
- demo loads
- calendar root renders
- Month / Week / Day / Schedule navigation works
- normal event click/edit/save only where already stable
- WeekView multi-day span click only where already stable

Do **not** reintroduce the full guided walkthrough as an automated CI gate.
