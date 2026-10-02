# Freeze-bound production migration cutover bundle — V11.43.1

Auxiliary tooling only. Do **not** merge this bridge history into #94 and never use a bridge worktree for `db reset`.

## Exact flow

`PREPARE → MANUAL LINK → SNAPSHOT → GENERATE BRIDGE → VERIFY HASH → COMPARATOR → CLI LIST → DRY-RUN → HUMAN APPROVAL → APPLY → POSTFLIGHT → SMOKE → RECOVERY IF NEEDED`

### 1. PREPARE — automatic, local-only

From the tooling branch checkout:

```bash
node supabase/bridge-tooling/prepare-worktree.mjs \
  --freeze-sha <FREEZE_SHA> \
  --workspace <NEW_EPHEMERAL_WORKTREE>
```

This creates a detached full Git worktree at the exact FREEZE_SHA. It does not touch Supabase.

### 2. MANUAL LINK — local state only, operator-controlled

Inside the ephemeral worktree, the operator explicitly links the already-approved project using the installed Supabase CLI workflow. The tooling **never** runs `supabase link` automatically.

Required project ref:

`hezjxcxxcjlpmyalftam`

The preflight requires `supabase/.temp/project-ref` to equal this exact value.

### 3. PRECHECK — automatic/read-only

From the tooling checkout:

```bash
node supabase/bridge-tooling/preflight.mjs \
  --freeze-sha <FREEZE_SHA> \
  --workspace <EPHEMERAL_WORKTREE> \
  --repo-root <TOOLING_REPO_CHECKOUT> \
  --artifact <PRECHECK_ARTIFACT.json> \
  --project-ref hezjxcxxcjlpmyalftam
```

The wrapper, in order:

1. verifies CLI and command help;
2. verifies linked project ref;
3. verifies worktree HEAD == FREEZE_SHA;
4. captures a fresh READ-ONLY remote migration-history snapshot from `supabase migration list --linked`;
5. regenerates the bridge in-place;
6. verifies target Git blob + SHA-256;
7. runs the reproduced comparator;
8. runs real `supabase migration list --linked`;
9. runs real `supabase db push --linked --dry-run`;
10. fails on remote-history drift or any unsafe suggestion;
11. writes an immutable precheck artifact and prints `CUTOVER_PRECHECK=PASS` only when the single pending file is V11.43.1.

No apply occurs here.

### 4. HUMAN APPROVAL BOUNDARY

**STOP.** No mutable command is allowed before human change approval.

Capture: FREEZE_SHA, CLI version, expected project ref, snapshot/hash, bridge manifest/hash, comparator report, migration-list output, dry-run output, target blob/SHA-256, PRE function/ACL checksums, operator identity and approved change ticket.

### 5. APPLY — prepared, disabled by default

Only after explicit approval:

```bash
node supabase/bridge-tooling/apply-authorized.mjs \
  --authorized \
  --change-id <APPROVED_CHANGE_ID> \
  --precheck <PRECHECK_ARTIFACT.json> \
  --workspace <EPHEMERAL_WORKTREE> \
  --freeze-sha <FREEZE_SHA> \
  --project-ref hezjxcxxcjlpmyalftam
```

The wrapper validates the PRE artifact, snapshot, manifest, FREEZE_SHA and project ref again, then executes exactly one mutable database command:

```bash
supabase db push --linked
```

It does not use `--include-all`, `--include-seed`, migration-history repair, or SQL Editor.

### 6. POSTFLIGHT / SMOKE

Run `supabase migration list --linked`, then execute only the read-only queries in `postflight.sql`. Complete the approved Shipping business smoke: full save, read-back of canonical columns, exactly-once milestone/event, partial update preservation, non-COP rejection, and no false success.

### Fail-closed abort conditions

Abort on project mismatch, FREEZE_SHA/hash mismatch, target already remote before planned apply, remote-history drift, duplicate remote version, missing historical representation, placeholder reported pending, any second pending migration, out-of-order result, CLI text requesting history repair or `--include-all`, or evidence file change after precheck.

### Recovery

If failure occurs before V11.43.1 is registered, do not retry blindly; inspect history/function/ACL. If it is already registered, never delete migration history. Prefer a versioned forward-fix; use the captured PRE function restore only as controlled operational recovery under the approved recovery runbook.
