#!/usr/bin/env bash
set -euo pipefail

echo "== Git remote check =="
if git remote get-url origin >/dev/null 2>&1; then
  echo "origin: $(git remote get-url origin)"
else
  echo "origin remote is NOT configured"
fi

echo

echo "== Branch tracking check =="
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "current branch: $CURRENT_BRANCH"
git branch -vv

echo

echo "== Recent commits =="
git log --oneline -n 5

echo
cat <<'MSG'
If Vercel is not auto-deploying:
1) Ensure Vercel project is connected to the correct GitHub repo.
2) Ensure pushes are going to the branch Vercel watches (usually main).
3) If commits are local only, push them to GitHub.
MSG
