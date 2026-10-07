#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Cần Docker Engine + Docker Compose trên máy đích." >&2
  exit 1
fi
if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose plugin chưa sẵn sàng." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon chưa chạy hoặc tài khoản hiện tại chưa có quyền." >&2
  exit 1
fi

export JAPANO_HOST_UID="$(id -u)"
export JAPANO_HOST_GID="$(id -g)"

if [[ ! -f .env.docker ]]; then
  jwt_secret="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
  admin_password="$(od -An -N18 -tx1 /dev/urandom | tr -d ' \n')"
  sed \
    -e "s/^JWT_SECRET=.*/JWT_SECRET=${jwt_secret}/" \
    -e "s/^JAPANO_ADMIN_PASSWORD=.*/JAPANO_ADMIN_PASSWORD=${admin_password}/" \
    .env.docker.example >.env.docker
  chmod 600 .env.docker
  echo "Đã tạo .env.docker với secret ngẫu nhiên."
  echo "Tài khoản admin: admin@japano.local"
  echo "Mật khẩu admin: ${admin_password}"
fi

docker compose pull
docker compose --profile tools run --rm restore
docker compose up -d
docker compose ps

echo "JAPANO Docker đã khởi động. Web: http://127.0.0.1:4200 | Admin/API: http://127.0.0.1:4100/admin/"
