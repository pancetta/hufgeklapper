## Game rules for this repo

- All player-facing text is German, for children aged 8–12: short sentences, simple words, no irony. Every string lives in the strings file.
- Rules live in the Sim, never in screen or canvas code (see `docs/adr/0001-no-engine.md`). New rules get Vitest tests; touch flows get a Playwright test (WebKit, iPad landscape).
- Only freely licensed art, each file in `CREDITS.md` (see `docs/adr/0003-lpc-art.md`). Nothing copied from or modelled on other games.

## Code review

Always run a ponytail review (`/ponytail:ponytail-review`) on new code before considering it done.

Keep review effort in proportion to risk:

- Per ticket: one fresh-context QA pass and one code review, with depth set by the diff's risk.
- Fix P0–P2 findings. Fix P3s in one batch if they're cheap, otherwise list them; don't re-review them.
- Run follow-up QA or review only when a fix changes player-visible behaviour or the CI/deploy path, and scope it to that fix.

## Testing on iPad

- Default QA: Vitest plus Playwright WebKit, and Chrome in the built-in browser.
- Boot the iOS simulator only for a ticket that changes touch input, layout, iPad-specific CSS or the home-screen/offline flow. Shut it down (`xcrun simctl shutdown all`) right after that check.
- Run one heavy process at a time, and stop dev servers you started when you're done.

## Agent skills

### Issue tracker

Issues are tracked in GitHub Issues on pancetta/hufgeklapper via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: bug, enhancement, needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` at the root, ADRs in `docs/adr/`. See `docs/agents/domain.md`.

### External peers

host-only: no external peer CLI is called. See `docs/agents/cross-model.json`.
