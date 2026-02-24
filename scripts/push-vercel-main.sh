#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${1:-https://github.com/meoncu/zekat.git}"
TARGET_BRANCH="${2:-main}"

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "$REPO_URL"
fi

git fetch origin "$TARGET_BRANCH" || true

git branch -f "$TARGET_BRANCH" HEAD

git push -u origin "$TARGET_BRANCH"

echo "Pushed current commit to origin/$TARGET_BRANCH for Vercel auto-deploy."
