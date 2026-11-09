# Deploy to homework.nightcoding.dev

## Live setup (Fly.io + Cloudflare Worker)

This is what runs today. Three Fly apps in `fra`, talking over Fly's private IPv6 network:

| App | Config | What it is |
|---|---|---|
| `nightcoding-homework-db` | `deploy/fly/db.toml` | `pgvector/pgvector:pg16` with a 1 GB volume. No public address. |
| `nightcoding-homework-api` | `backend/fly.toml` | The backend image; listens on `[::]:5001`, private only. 1 GB RAM (the model). |
| `nightcoding-homework-web` | `frontend/fly.toml` | nginx with the built frontend, public at `nightcoding-homework-web.fly.dev`. |

The Worker (`deploy/worker`, `ORIGIN = https://nightcoding-homework-web.fly.dev`) serves
`homework.nightcoding.dev`. nginx answers 403 to any request without the Worker's `X-Origin-Secret`,
and limits POST/DELETE to 10 per minute per visitor (`limit_req` on the `X-Client-IP` the Worker
sends; the Workers rate-limit binding returned "allowed" for every request in testing, so the
origin enforces the limit).

Secrets (values in `~/.nightcoding-homework-secrets.env` on the deploying machine, mode 600):
`POSTGRES_PASSWORD` (db), `DATABASE_URL` (api), `ORIGIN_SECRET` (web and the Worker).

```bash
fly apps create nightcoding-homework-db   # and -api, -web
fly volumes create pgdata --app nightcoding-homework-db --region fra --size 1
fly secrets set --stage POSTGRES_PASSWORD=… --app nightcoding-homework-db
fly secrets set --stage DATABASE_URL=postgresql+asyncpg://postgres:…@nightcoding-homework-db.internal:5432/space_explorer --app nightcoding-homework-api
fly secrets set --stage ORIGIN_SECRET=… --app nightcoding-homework-web
(cd deploy/fly && fly deploy --config db.toml --ha=false)
(cd backend && fly deploy --ha=false)
(cd frontend && fly deploy --ha=false)
fly ips allocate-v4 --shared --app nightcoding-homework-web && fly ips allocate-v6 --app nightcoding-homework-web
cd deploy/worker && printf %s "$ORIGIN_SECRET" | npx wrangler secret put ORIGIN_SECRET && npx wrangler deploy
```

Update: run the matching `fly deploy` again. Delete: `fly apps destroy` for the three apps and
`npx wrangler delete homework`.

## Alternative: one VM with Docker Compose

Architecture: one Linux VM runs the Docker Compose stack (Postgres with pgvector, FastAPI, nginx).
A Cloudflare Worker on `homework.nightcoding.dev` gives HTTPS and forwards all requests to the VM.

Any host with Docker works. Choose route A (GCE) or route B (Fly.io). Then do step C.

Requirements for the VM:
- 2 GB RAM or more. The backend image bakes the ~90 MB embedding model at build time.
- Outbound internet during the build.
- Port 80 open to the internet.

## A. Google Compute Engine

1. Log in.

   ```bash
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID
   ```

2. Create a firewall rule for port 80.

   ```bash
   gcloud compute firewall-rules create homework-http \
     --allow tcp:80 --target-tags homework-http
   ```

3. Create the VM.

   ```bash
   gcloud compute instances create homework \
     --zone us-central1-a \
     --machine-type e2-small \
     --image-family debian-12 --image-project debian-cloud \
     --boot-disk-size 20GB \
     --tags homework-http
   ```

4. Get the external IP.

   ```bash
   gcloud compute instances describe homework --zone us-central1-a \
     --format 'get(networkInterfaces[0].accessConfigs[0].natIP)'
   ```

   Write the IP down. The sslip.io host name uses dashes: `34.123.45.67` becomes `34-123-45-67.sslip.io`.

5. Connect to the VM.

   ```bash
   gcloud compute ssh homework --zone us-central1-a
   ```

6. Install Docker (run on the VM).

   ```bash
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   exit
   ```

   Connect again so the group change applies.

7. Get the repo onto the VM. Use one of these two ways.

   Clone (run on the VM):

   ```bash
   sudo apt-get install -y git
   git clone REPO_URL space-explorer && cd space-explorer
   ```

   Or copy from your laptop (run on the laptop, from the repo parent folder):

   ```bash
   gcloud compute scp --recurse --zone us-central1-a \
     --exclude 'node_modules' conntour-space-explorer homework:~/space-explorer
   ```

   The `--exclude` flag needs a recent gcloud. If it fails, use `git clone`.

8. Create `.env` and start the stack (run on the VM, in the repo folder).

   ```bash
   cp .env.example .env
   sed -i "s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=$(openssl rand -hex 16)/" .env
   sed -i "s/^ORIGIN_SECRET=.*/ORIGIN_SECRET=$(openssl rand -hex 32)/" .env
   grep ORIGIN_SECRET .env   # copy this value for the Worker (section C, step 3)
   docker compose -f docker-compose.prod.yml up -d --build
   ```

   Nginx on the VM answers only requests that carry the `X-Origin-Secret` header.
   The Worker adds it. A request straight to port 80 gets 403, so nobody can skip the
   Worker and its rate limit.

   The first build takes several minutes.

9. Check from the VM.

   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl -s -H "X-Origin-Secret: $(grep ^ORIGIN_SECRET .env | cut -d= -f2)" localhost/api/health
   curl -s -o /dev/null -w '%{http_code}\n' localhost/api/health   # 403: no secret
   ```

## B. Fly.io (alternative)

Fly runs one Machine, not Compose. Use a plain Docker VM instead if you want the exact same stack.
The simplest Fly path is a Fly Machine with Docker installed:

1. Log in: `fly auth login`.
2. Create an app: `fly apps create homework-origin`.
3. Create a VM with 2 GB RAM and a public IP. Open port 80 on it.
4. SSH in with `fly ssh console`, then follow steps 6 to 9 of route A.
5. The origin host name is `homework-origin.fly.dev`. Use `http://homework-origin.fly.dev:80` as `ORIGIN`.

If you prefer, any other VPS with Docker also works. Follow steps 6 to 9 of route A and use its sslip.io name.

## C. Cloudflare Worker

1. Set `ORIGIN` in `deploy/worker/wrangler.toml`. Example:

   ```toml
   ORIGIN = "http://34-123-45-67.sslip.io:80"
   ```

2. Install and type-check.

   ```bash
   cd deploy/worker
   volta run --node 22 npm install
   volta run --node 22 npm run typecheck
   ```

3. Store the origin secret in the Worker (paste the value from the VM's `.env`).

   ```bash
   volta run --node 22 npx wrangler secret put ORIGIN_SECRET
   ```

4. Deploy. Wrangler is already logged in on this machine.

   ```bash
   volta run --node 22 npx wrangler deploy
   ```

   The custom domain creates its own DNS record in the nightcoding.dev zone. HTTPS starts in about a minute.

The Worker limits `POST /api/searches` and `DELETE /api/searches/*` to 10 requests per minute for each client IP.
It uses the Workers Rate Limiting binding `SEARCH_LIMITER` in `wrangler.toml`.
To change the limit, edit `[ratelimits.simple]`. The period must be 10 or 60 seconds.
`wrangler deploy --dry-run` accepts this config (checked with wrangler 4.131).

Fallback if Cloudflare rejects the binding: remove the `[[ratelimits]]` block. The Worker then skips the limit.
Add this to the `http` block of nginx on the origin instead (the frontend image needs a rebuild):

```nginx
limit_req_zone $http_x_forwarded_for zone=writes:10m rate=10r/m;
# in location /api/searches, for POST and DELETE only:
limit_req zone=writes burst=5 nodelay;
```

## D. Verify, update, cost, delete

Verify:

```bash
curl -i http://IP.sslip.io/api/health          # origin direct, expect 200
curl -i https://homework.nightcoding.dev/      # expect 200 and the HTML page
curl -s https://homework.nightcoding.dev/api/health
curl -s -X POST https://homework.nightcoding.dev/api/searches \
  -H 'content-type: application/json' -d '{"query":"mars rover"}'
```

Check the request body of `POST /api/searches` against the backend docs at `/docs` if it returns 422.

Update the app (on the VM, in the repo folder):

```bash
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

Update the Worker: edit `deploy/worker/src/index.ts`, then run `npx wrangler deploy` again.

Logs: `docker compose -f docker-compose.prod.yml logs -f backend`.

Notes on behavior:
- The origin nginx sets `X-Forwarded-Proto` from its own scheme, so the backend sees `http`. The app does not depend on it.
- The database volume `postgres_data` keeps the data across rebuilds. `down -v` deletes it.

Cost: e2-small is about $13 per month, plus about $1 for the 20 GB disk and a small cost for the external IP.

Delete everything:

```bash
# Worker and its custom domain
cd deploy/worker && volta run --node 22 npx wrangler delete homework
# GCE
gcloud compute instances delete homework --zone us-central1-a
gcloud compute firewall-rules delete homework-http
# Fly.io
fly apps destroy homework-origin
```
