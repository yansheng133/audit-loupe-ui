#!/usr/bin/env bash
# Rancher dashboard dev server with this extension, in a SUSE BCI Node.js 24 container, so the
# Mac needs no local Node 24 (same approach as laoban). Edits under pkg/ reload in the browser.
#
#   API=https://rancher.example.com scripts/dev.sh
#   then open https://127.0.0.1:8005 (self-signed certificate) and log in to Rancher there.
#
# AL_LOCAL_API=http://host.docker.internal:18090 sends the Audit Loupe backend path to a backend
# on this Mac (bound to 127.0.0.1 there) instead of the one in Rancher; AL_LOCAL_API=<directory>
# answers it from saved fixture-<day>-<tab>.json files (mounted read-only). See vue.config.js.
# PORT and NAME change the published port and container name, to run next to another copy.
#
# Needs a running container engine (Rancher Desktop). node_modules live in a named volume, not
# in the working tree, so Linux packages never mix with anything installed on the Mac.
set -euo pipefail

: "${API:?set API to the Rancher URL, e.g. API=https://rancher.example.com scripts/dev.sh}"
# Pinned by tag and digest; update both together.
IMAGE="${IMAGE:-registry.suse.com/bci/nodejs:24.18.1-base-20.1@sha256:701cc603ed67fe41a408a5f5618a04912cc2d130f12dbd0005f7b13285367f5f}"
YARN="yarn@1.22.22"
# macOS bind mounts do not deliver file-change events into the container, so poll by default.
# Measured 2026-10-20 (Rancher Desktop, Apple silicon): without polling an edit under pkg/ did
# not recompile within 30s; with polling it recompiled in about 5-7s.
POLL="${WATCHPACK_POLLING:-true}"

cd "$(dirname "$0")/.."
tty=()
[ -t 0 ] && tty=(-it)
local_api="${AL_LOCAL_API:-}"
mounts=()
if [ -n "$local_api" ] && [ -d "$local_api" ]; then
  mounts=(-v "$(cd "$local_api" && pwd)":/al-fixtures:ro)
  local_api=/al-fixtures
fi

exec docker run --rm --init "${tty[@]}" \
  --name "${NAME:-audit-loupe-ui-dev}" \
  -p "127.0.0.1:${PORT:-8005}:8005" \
  -v "$PWD":/work -w /work \
  -v audit-loupe-ui-node-modules:/work/node_modules \
  -v audit-loupe-ui-npm-cache:/root/.npm \
  -v audit-loupe-ui-yarn-cache:/usr/local/share/.cache/yarn \
  ${mounts[@]+"${mounts[@]}"} \
  -e API -e AL_LOCAL_API="$local_api" -e WATCHPACK_POLLING="$POLL" \
  "$IMAGE" \
  sh -c "npx -y $YARN install --frozen-lockfile && exec npx -y $YARN dev"
