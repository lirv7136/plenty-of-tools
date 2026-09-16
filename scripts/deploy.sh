#!/usr/bin/env bash
# Build and deploy to Cloudflare Pages (personal account). Project: plenty-of-tools
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.nvm/versions/node/v20.19.6/bin:$PATH"
python3 build.py
npx wrangler pages deploy dist --project-name plenty-of-tools --branch main --commit-dirty=true
