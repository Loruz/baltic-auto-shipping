# infra

| Path                                     | What it is                                                                                                                        |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `compose.yml`                            | Local Postgres 17, Redis 7 (AOF) and Mailpit (inbox at http://localhost:8025)                                                     |
| `compose.prod.yml`, `Caddyfile`          | Production/staging stack (draft until the M1 staging deploy)                                                                      |
| `docker/Dockerfile.{web,worker,migrate}` | Images built by CI, tagged with the git SHA                                                                                       |
| `backup/`                                | Plan §6 "Backups": daily + hourly `pg_dump`, `age`-encrypted, to a Hetzner Storage Box; monthly restore drill. Scripts land in M9 |
| `runbooks/`                              | One file per operational procedure (deploy, rollback, restore, alerts from §7.2). Finished in M9                                  |
