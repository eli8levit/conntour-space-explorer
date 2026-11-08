# Deploy to homework.nightcoding.dev

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
   docker compose -f docker-compose.prod.yml up -d --build
   ```

   The first build takes several minutes.

9. Check from the VM.

   ```bash
   docker compose -f docker-compose.prod.yml ps
   curl -s localhost/api/health
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

3. Deploy. Wrangler is already logged in on this machine.

   ```bash
   volta run --node 22 npx wrangler deploy
   ```

   The custom domain creates its own DNS record in the nightcoding.dev zone. HTTPS starts in about a minute.

The Worker limits `POST /api/searches` and `DELETE /api/searches/*` to 10 requests per minute for each client IP.
It uses the Workers Rate Limiting binding `SEARCH_LIMITER` in `wrangler.toml`.
To change the limit, edit `simple = { limit, period }`. The period must be 10 or 60 seconds.

Fallback if wrangler rejects the binding: remove the `[[unsafe.bindings]]` block. The Worker then skips the limit.
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
