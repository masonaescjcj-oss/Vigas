# Deploying the worker

The agent runs on a small Linux box rather than an Edge Function, because Edge
Functions cannot spawn processes and the agent needs `bash` — see
`server-worker.ts` for why that matters.

Everything here mirrors what is installed on that machine. It lived only on the
server until a two-minute `TimeoutStopSec` was found killing in-flight builds on
every deploy; config that exists in exactly one place drifts, and nobody can
review a file they cannot see.

## Files

| File | Installed at |
| --- | --- |
| `retrocode-worker.service` | `/etc/systemd/system/retrocode-worker.service` |

## Installing a change

```bash
scp deploy/retrocode-worker.service root@<host>:/etc/systemd/system/
ssh root@<host> 'systemctl daemon-reload && systemctl restart retrocode-worker'
```

## Deploying code

There is no git remote on the server. Copy the changed files and restart:

```bash
scp <changed files> root@<host>:/opt/retrocode/<same path>
ssh root@<host> 'systemctl restart retrocode-worker'
```

**A restart waits for the job in flight.** That is deliberate — killing a run
leaves its job locked until the stale-lease sweep releases it, and the user sees
a build that stopped for no reason. A build takes minutes, so a restart can take
minutes. Let it finish rather than reaching for `-s KILL`.

## What is not in this repo

`/opt/retrocode/.env` — mode 600, root only. It holds the service-role key, the
model provider key and the worker secret, and deliberately does **not** hold
`SUPABASE_ACCESS_TOKEN` or `LOCAL_DEV_BYPASS`. The worker has no use for either,
and `LOCAL_DEV_BYPASS` on a reachable machine is a full authentication bypass.
