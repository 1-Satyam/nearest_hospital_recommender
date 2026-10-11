#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-5000}"
export PORT

cd "$(dirname "$0")"

python -m pip install --upgrade pip >/dev/null 2>&1 || true
python -m pip install -r backend/requirements.txt

cd frontend
npm install
npm run build
cd ..

python -m uvicorn backend.main:app --host 0.0.0.0 --port "${PORT}"
