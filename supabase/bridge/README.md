# E2 ephemeral migration bridge prototype

NON-PRODUCTION / DISCARDABLE branch.

Purpose: model the existing production migration history without changing production history or re-executing historical SQL.

Rules:
- The 99 historical files in `supabase/migrations/` are comment-only placeholders keyed by the exact production version/name.
- The only executable new migration is `20261001205000_shipping_carrier_persistence_v11_43_1.sql`, preserved byte-for-byte from base `dad1147c5178a840efd3f1d553992c96ecb41b61`.
- Before any future apply, `supabase migration list --linked` and `supabase db push --linked --dry-run` must show only `20261001205000` as pending.
- If any placeholder appears pending, ABORT.
- NEVER use `--include-all`.
- NEVER use this branch for local DB rebuild/reset; placeholders do not reconstruct historical schema.
- NEVER repair or mutate production history as part of this bridge.
- This branch is proof-of-design only and must not merge into #94.

Snapshot source: `supabase/bridge/remote-history.json`.
