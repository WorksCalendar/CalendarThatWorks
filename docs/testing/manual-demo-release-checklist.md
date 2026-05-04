# Manual Demo Release Checklist (Guided Tour)

Use this checklist before releasing the public demo.

## Setup

1. Open the deployed demo build.
2. Reset demo state (clear local storage/service worker cache using the built-in reset path or browser storage tools).

## Guided tour verification

1. Start or restart the guided tour.
2. Confirm **Mission Alpha** is visible.
3. Move **Mission Alpha** to a different slot.
4. Confirm the tour advances after the move.
5. Open/edit **Mission Alpha**.
6. Assign pilot **emp-james**.
7. Save.
8. Confirm conflict prompt appears.
9. Proceed/override conflict (**Apply anyway** or equivalent).
10. Reassign Mission Alpha to **emp-rivera** or another non-conflicting pilot.
11. Switch to **Schedule** view.
12. Confirm Mission Alpha appears under the updated assignment.

## Runtime sanity check

1. Open browser devtools console.
2. Verify there are no obvious uncaught runtime errors during the flow above.
