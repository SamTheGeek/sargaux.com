#!/usr/bin/env bash
# Lightweight secret-scan for CI / pre-push. Exits non-zero if likely secrets
# or sensitive artifacts are staged/present in the working tree (tracked files).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

check() {
  local label="$1"
  local pattern="$2"
  # Search tracked files only; ignore .env.local and scripts/output
  if git grep -nE "$pattern" -- . ':(exclude).env*' ':(exclude)scripts/output/**' ':(exclude)**/*.lock' >/tmp/secret-scan-hits 2>/dev/null; then
    echo "FAIL: $label"
    head -n 20 /tmp/secret-scan-hits
    FAILED=1
  fi
}

# Notion integration tokens
check "Notion API token (ntn_)" 'ntn_[A-Za-z0-9]{20,}'

# Resend API keys
check "Resend API key (re_)" 're_[A-Za-z0-9]{20,}'

# Accidental .env.local commits (filename check)
if git ls-files --error-unmatch .env.local >/dev/null 2>&1; then
  echo "FAIL: .env.local is tracked by git"
  FAILED=1
fi

# scripts/output should stay untracked / gitignored
if git ls-files 'scripts/output/*' 2>/dev/null | grep -q .; then
  echo "FAIL: scripts/output/ contains tracked files"
  git ls-files 'scripts/output/*'
  FAILED=1
fi

if [[ "$FAILED" -ne 0 ]]; then
  echo "Secret scan failed."
  exit 1
fi

echo "Secret scan OK."
