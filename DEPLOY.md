# Deploying Bloom on the shared server

Server: Ubuntu 24.04, shared with other students' sites, ~4 GB free disk.
Address: **medhub.softclub.tj**. The server's own nginx handles HTTPS and proxies
`medhub.softclub.tj` → `127.0.0.1:8038`. Our stack publishes **only** that port, on localhost;
nothing of ours binds 80 or 443.

```
browser ─https─▶ server nginx ─▶ 127.0.0.1:8038 nginx-frontend ─▶ nginx-backend ─▶ gunicorn/Django ─▶ PostgreSQL
                 (not ours)       └──────────────── docker compose project "bloom-muna" ────────────────┘
```

> ## ⚠️ Shared server — read first
> - **Never run** `docker system prune`, `docker builder prune`, `docker image prune`,
>   `docker volume prune` or `docker network prune`. They delete **other students'**
>   images, build cache, volumes and data.
> - **Never stop, restart, remove or `exec` into containers that are not `bloom-muna-…`.**
> - Always run docker commands **from `~/bloom-muna`** with `sudo docker compose …`;
>   compose then only touches this project (`bloom-muna`).
> - Do not edit the server's nginx configuration unless it is yours to manage.
> - Never use `sudo docker compose down -v` unless you really want to **delete the database**.

---

## 1. First deployment

```bash
# get the code
cd ~
git clone https://github.com/treyreri/bloom-study-planner.git bloom-muna
cd ~/bloom-muna

# create .env with random secrets (only once; keep this file private)
cat > .env <<EOF
DEBUG=False
SECRET_KEY=$(python3 -c 'import secrets; print(secrets.token_urlsafe(50))')
ALLOWED_HOSTS=medhub.softclub.tj
CSRF_TRUSTED_ORIGINS=http://medhub.softclub.tj,https://medhub.softclub.tj
TIME_ZONE=Europe/Moscow
DB_NAME=bloom
DB_USER=bloom
DB_PASSWORD=$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')
GUNICORN_WORKERS=2
SECURE_SSL_REDIRECT=False
SECURE_COOKIES=False
EOF
chmod 600 .env

# check free disk first (the pulled images need roughly 450 MB; nothing is built here)
df -h ~

# download the prebuilt images and start — never build on the server
sudo docker compose pull
sudo docker compose up -d --no-build

# all four containers should be "running" / db "healthy"
sudo docker compose ps
```

Check it from the server:

```bash
curl -I http://127.0.0.1:8038/                                          # 200, the React page
curl -s -o /dev/null -w "%{http_code}\n" -H "Host: medhub.softclub.tj" \
     http://127.0.0.1:8038/api/v1/dashboard/                            # 401 = Django answers
```

Then open **https://medhub.softclub.tj**.

Create the administrator account (for https://medhub.softclub.tj/admin/):

```bash
sudo docker compose exec backend python manage.py createsuperuser
```

Optional demo data (user `demo` / `bloom-demo-2026` — the password is public, so change it in
the admin or skip this on a public site):

```bash
sudo docker compose exec backend python manage.py seed_demo
```

## 2. Updating after a new push to GitHub

The server never builds images. Every push to `main` makes GitHub Actions
(`.github/workflows/docker.yml`) build and publish two images:

- `ghcr.io/treyreri/bloom-muna-backend` (tags `latest` and the commit SHA)
- `ghcr.io/treyreri/bloom-muna-frontend` (tags `latest` and the commit SHA)

Wait until that run is green (repository → **Actions** → "Docker images"), then:

```bash
cd ~/bloom-muna
git pull                                          # compose file + nginx configs
sudo docker compose pull backend nginx-frontend   # the new prebuilt images
sudo docker compose up -d --no-build              # recreate only what changed
sudo docker compose ps

# remove only bloom-muna's old, now untagged (dangling) images
sudo docker image ls -q --filter dangling=true \
     --filter label=org.opencontainers.image.source=https://github.com/treyreri/bloom-study-planner \
  | xargs -r sudo docker image rm
```

Migrations and `collectstatic` run automatically when the backend container starts.
Never use `--build` and never run any `docker … prune` on the server.

To go back to an earlier version, put its commit SHA instead of `latest` for the two images in
`docker-compose.yml` (e.g. `ghcr.io/treyreri/bloom-muna-backend:<sha>`) and run the pull/up commands.

### Once: switching from images built on the server

Images built on the server earlier are named `bloom-muna-backend` and `bloom-muna-nginx-frontend`.
After the first `pull` + `up -d --no-build` above they are no longer used; remove exactly these two
(and their leftover dangling layers) to free the disk:

```bash
sudo docker image rm bloom-muna-backend bloom-muna-nginx-frontend
sudo docker image ls -q --filter dangling=true --filter label=com.docker.compose.project=bloom-muna \
  | xargs -r sudo docker image rm
```

## 3. Everyday commands (always inside ~/bloom-muna)

```bash
sudo docker compose ps                         # status
sudo docker compose logs --tail=100 backend    # Django / gunicorn log
sudo docker compose logs --tail=100 nginx-frontend
sudo docker compose restart backend            # restart only our backend
sudo docker compose stop                       # stop our containers (data is kept)
sudo docker compose start                      # start them again
sudo docker compose down                       # remove our containers (volumes/data are kept)
```

Logs are limited to 3 × 10 MB per container (see `docker-compose.yml`), so they cannot fill the disk.

### Backup of the database

```bash
cd ~/bloom-muna
sudo docker compose exec -T db pg_dump -U bloom bloom > ~/bloom-backup-$(date +%F).sql
```

### Disk usage (read-only commands are fine)

```bash
df -h ~
sudo docker system df                           # shows usage, deletes nothing
sudo docker images 'ghcr.io/treyreri/bloom-muna-*'   # our images (old ones show TAG <none>)
```

The cleanup command in section 2 already removes our old images after each update. If one is left,
remove it by its IMAGE ID from the list above (only `<none>` entries of `bloom-muna-*`):

```bash
sudo docker image rm <IMAGE_ID>
```

Never remove base images such as `postgres`, `nginx`, `python` or `node` — other projects may use them.

## 4. Settings explained

| `.env` value | Why |
|---|---|
| `DEBUG=False` | production mode (`config.settings.prod` always forces it off) |
| `ALLOWED_HOSTS=medhub.softclub.tj` | Django answers only for this domain |
| `CSRF_TRUSTED_ORIGINS=http://…,https://…` | admin login works from both addresses |
| `SECURE_SSL_REDIRECT=False` | the server's nginx is responsible for redirecting to https |
| `SECURE_COOKIES=False` | set to `True` (and restart: `sudo docker compose up -d`) once the site is used only over https |

Django trusts the `X-Forwarded-Proto` header (`SECURE_PROXY_SSL_HEADER`) and
`X-Forwarded-Host` (`USE_X_FORWARDED_HOST`). nginx-frontend passes them through unchanged from
the server's nginx, so Django knows the original request was https on medhub.softclub.tj (correct
avatar URLs, admin CSRF checks). This is safe because port 8038 only listens on 127.0.0.1.

For the server administrator — the server's nginx site for medhub.softclub.tj should forward
these headers (usually already the case):

```nginx
location / {
    proxy_pass http://127.0.0.1:8038;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
    client_max_body_size 5m;      # avatar uploads
}
```
