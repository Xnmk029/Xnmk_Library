#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
if command -v python3 >/dev/null 2>&1; then
  exec python3 serve.py
elif command -v python >/dev/null 2>&1; then
  exec python serve.py
else
  echo "Python 3 was not found." >&2
  exit 1
fi
