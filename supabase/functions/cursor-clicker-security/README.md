# Cursor Clicker Security Server

Phase 1 is additive and deliberately leaves current gameplay unchanged.

The JWT-protected `cursor-clicker-security` Edge Function supports:
- `status`
- `request_legacy_migration`
- `owner_trade_history` (owner only, checked in Edge Function and Postgres)

Browser roles have no grants on any `cc_*` table. RLS and FORCE RLS are enabled.
Every write needs a UUID `clientActionId`; repeats return the recorded result.
Legacy saves only enter a review queue and are never trusted or imported automatically.
Trading and the authoritative economy stay disabled until migration and gameplay actions are complete.
