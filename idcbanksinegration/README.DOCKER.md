Running the app with Docker Compose

Prerequisites
- Docker and Docker Compose installed on your machine.

Quick start

1. Configure external databases

If your MySQL and Sage databases already exist (not running as containers), create a `.env` file in the project root and set the connection values. You can copy the example:

```bash
cp .env.example .env
# then edit .env and set DB_HOST / SAGE_DB_HOST to your existing servers
```

2. Build and start services (web, redis, agents)

```bash
docker compose up --build
```

This will start:
- `web` (Next.js) on port `3000` (connects to your external DBs using values in `.env`).
- `redis` on port `6379` (used by agents) unless you configure `REDIS_HOST` to an external instance.
- `zicb-agent` on port `4001`.

2. Open http://localhost:3000

Notes
- Since the central MySQL and Sage DBs are external, the Compose file does not create them. Set `DB_HOST` and `SAGE_DB_HOST` in `.env` to point to the existing database hosts.
- If you wish the Compose stack to run MySQL or SQL Server locally, I can restore those service definitions — currently Compose assumes external DBs.
- For SQL Server initialization, you'll need to restore your Sage schema or supply scripts; I can add an init job if required.

Developers
- For development with live reload, run `npm run dev` locally, or modify the `web` service to use a development command and mount the source as a volume.

Common commands
- Stop and remove containers: `docker compose down`
- Rebuild images: `docker compose build --no-cache`

If you'd like, I can:
- add a `docker-compose.override.yml` tailored for development (hot reload), or
- add a small healthcheck/wait script for the Next app to retry DB connections before starting.
