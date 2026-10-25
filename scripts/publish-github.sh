#!/usr/bin/env bash
set -euo pipefail
repo="${1:-medhiblk/patentradar}"
[[ "$repo" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] || { echo 'Use owner/repository.' >&2; exit 2; }
[[ -z "$(git status --porcelain)" ]] || { echo 'Commit/review changes before publishing.' >&2; exit 2; }
release_dir="$(mktemp -d)"
trap 'rm -rf "$release_dir"' EXIT
gh auth setup-git
gh repo clone "$repo" "$release_dir/repo" -- --depth=1
if [[ -f "$release_dir/repo/package.json" ]] && ! grep -q '"name": "patentradar"' "$release_dir/repo/package.json"; then
  echo 'Refusing to replace an unrelated application.' >&2; exit 2
fi
if [[ -f "$release_dir/repo/LICENSE" ]]; then cp "$release_dir/repo/LICENSE" "$release_dir/original-license"; fi
git archive HEAD | tar -x -C "$release_dir/repo"
if [[ -f "$release_dir/original-license" ]]; then cp "$release_dir/original-license" "$release_dir/repo/LICENSE"; fi
rm -f "$release_dir/repo/artifacts/digital-twin-live.json" "$release_dir/repo/artifacts/digital-twin-report.pdf"
git -C "$release_dir/repo" add .
git -C "$release_dir/repo" -c user.name='PatentRadar Engineering' -c user.email='engineering@patentradar.local' commit -m 'Publish PatentRadar API, MCP and browser CAD studio'
git -C "$release_dir/repo" push origin HEAD:main
printf 'Published: https://github.com/%s\n' "$repo"
