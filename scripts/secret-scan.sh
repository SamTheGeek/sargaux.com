#!/usr/bin/env bash
# Lightweight secret-scan for CI / pre-push. Exits non-zero if likely secrets
# or sensitive artifacts are staged/present in the working tree (tracked files).
#
# Patterns are deliberately high-signal to keep false positives near zero:
# the repo legitimately contains non-hex Playwright fallback secrets
# (e.g. 'test-session-hmac-secret-for-playwright' in playwright.config.ts)
# and empty placeholders in .env.example — none of these should trip the scan.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

FAILED=0

check() {
  local label="$1"
  local pattern="$2"
  # Search tracked files only (-I skips binaries); ignore .env.local,
  # scripts/output, lockfiles, and this script's own pattern definitions.
  if git grep -nIE -e "$pattern" -- . \
    ':(exclude).env*' \
    ':(exclude)scripts/output/**' \
    ':(exclude)**/*.lock' \
    ':(exclude)package-lock.json' \
    ':(exclude)scripts/secret-scan.sh' \
    >/tmp/secret-scan-hits 2>/dev/null; then
    echo "FAIL: $label"
    head -n 20 /tmp/secret-scan-hits
    FAILED=1
  fi
}

# Notion integration tokens
check "Notion API token (ntn_)" 'ntn_[A-Za-z0-9]{20,}'

# Resend API keys
check "Resend API key (re_)" 're_[A-Za-z0-9]{20,}'

# Netlify personal access tokens
check "Netlify token (nfp_)" 'nfp_[A-Za-z0-9]{20,}'

# GitHub tokens (classic ghp_/gho_/ghu_/ghs_/ghr_ and fine-grained github_pat_)
check "GitHub token" 'gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}'

# Generic sk- keys (OpenAI, Stripe secret keys, etc.)
check "Generic sk- API key" 'sk-[A-Za-z0-9_-]{20,}'

# AWS access key IDs
check "AWS access key (AKIA)" 'AKIA[0-9A-Z]{16}'

# PEM private key material
check "Private key block" '\-\-\-\-\-BEGIN [A-Z ]*PRIVATE KEY\-\-\-\-\-'

# Long hex values assigned to secret-looking variables. Catches real HMAC
# secrets (openssl rand -hex 32) pasted into code/docs/config, while bare hex
# (Notion page IDs, tampered-signature test fixtures) stays allowed.
check "Hex secret assignment" '(SECRET|TOKEN|PASSWORD|API_?KEY|_KEY)["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?[0-9a-fA-F]{32,}'

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
