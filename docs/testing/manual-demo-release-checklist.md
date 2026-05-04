# Manual Demo Release Checklist

Use this checklist before approving a demo release.

## Demo reset and guided tour

- [ ] Open the demo with `?resetDemo=1` (for example: `/app?resetDemo=1`).
- [ ] Start (or restart) the guided tour.
- [ ] Confirm **Mission Alpha** is visible.
- [ ] Move **Mission Alpha**.
- [ ] Confirm the guided tour advances after moving the mission.

## Mission Alpha editing and conflict handling

- [ ] Open and edit **Mission Alpha**.
- [ ] Assign pilot `emp-james`.
- [ ] Save the mission.
- [ ] Confirm a conflict dialog appears.
- [ ] Proceed/override the conflict.
- [ ] Reassign **Mission Alpha** to `emp-rivera` (or another non-conflicting pilot).

## Schedule validation

- [ ] Switch to **Schedule** view.
- [ ] Confirm **Mission Alpha** appears under the updated assignment.

## Stability check

- [ ] Check for obvious browser console/runtime errors during the flow.
