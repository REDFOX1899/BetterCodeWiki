#!/usr/bin/env bash
# ============================================================
# GitUnderstand — Local Development Helper
# ============================================================
# Starts both the Next.js frontend and FastAPI backend in
# parallel. Ctrl-C stops both processes.
#
# Usage:  ./scripts/dev.sh
# ============================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

cleanup() {
  echo ""
  echo "==> Shutting down dev servers..."
  kill 0 2>/dev/null
  wait 2>/dev/null
  echo "==> Done."
}

trap cleanup SIGINT SIGTERM EXIT

echo "==> Starting FastAPI backend on :8001..."
(cd "${ROOT_DIR}" && python -m api.main) &
BACKEND_PID=$!

echo "==> Starting Next.js frontend on :3000..."
(cd "${ROOT_DIR}" && yarn dev) &
FRONTEND_PID=$!

echo ""
echo "============================================================"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:8001"
echo "  Press Ctrl-C to stop both."
echo "============================================================"
echo ""

# Wait for either process to exit
wait -n
exit $?
