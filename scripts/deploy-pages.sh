#!/usr/bin/env bash
# Build Prismatonal and publish dist/ to the gh-pages branch (GitHub Pages).
# Usage: scripts/deploy-pages.sh
# Fails loudly: set -euo pipefail and every step echoes what it did.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing dependencies (npm ci)"
npm ci

echo "==> Building (tsc && vite build)"
npm run build
test -f dist/index.html || { echo "ERROR: dist/index.html missing after build" >&2; exit 1; }

WORKTREE="$(mktemp -d)"
cleanup() { git worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true; rm -rf "$WORKTREE"; }
trap cleanup EXIT

echo "==> Preparing gh-pages worktree at $WORKTREE"
if git ls-remote --exit-code origin gh-pages >/dev/null 2>&1; then
  git worktree add -B gh-pages "$WORKTREE" origin/gh-pages
else
  git worktree add --detach "$WORKTREE"
  git -C "$WORKTREE" checkout --orphan gh-pages
fi

echo "==> Copying dist into gh-pages"
find "$WORKTREE" -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
cp -a dist/. "$WORKTREE"/
touch "$WORKTREE/.nojekyll"

git -C "$WORKTREE" add -A
if git -C "$WORKTREE" diff --cached --quiet; then
  echo "==> No changes to publish"
  exit 0
fi
git -C "$WORKTREE" -c user.email=miken277@users.noreply.github.com -c user.name=miken277 \
  commit -m "Deploy $(git rev-parse --short HEAD) ($(date -u +%Y-%m-%dT%H:%M:%SZ))"

echo "==> Pushing gh-pages"
git -C "$WORKTREE" push origin gh-pages
echo "==> Published: https://miken277.github.io/Prismatonal/"
