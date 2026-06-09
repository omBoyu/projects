#!/bin/bash
set -Eeuo pipefail

COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-$(pwd)}"

cd "${COZE_WORKSPACE_PATH}"

if [[ "${VERCEL:-}" == "1" ]]; then
    echo "Skipping dependency install on Vercel; dependencies are installed before build."
else
    echo "Installing dependencies..."
    pnpm install --prefer-frozen-lockfile --prefer-offline --loglevel debug --reporter=append-only
fi

echo "Building the Next.js project..."
pnpm next build

echo "Bundling server with tsup..."
pnpm tsup src/server.ts --format cjs --platform node --target node20 --outDir dist --no-splitting --no-minify

echo "Build completed successfully!"
