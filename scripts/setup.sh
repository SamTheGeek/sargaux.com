#!/usr/bin/env bash
#
# sargaux.com — Development Environment Setup
#
# Sets up a Mac from scratch for working on this repository.
# Prerequisites: macOS (latest) with default system binaries.
# Run from the repository root:  ./scripts/setup.sh
#
set -euo pipefail

# ---------- helpers ----------
info()  { printf "\033[1;34m==> %s\033[0m\n" "$*"; }
ok()    { printf "\033[1;32m  ✓ %s\033[0m\n" "$*"; }
warn()  { printf "\033[1;33m  ⚠ %s\033[0m\n" "$*"; }
fail()  { printf "\033[1;31m  ✗ %s\033[0m\n" "$*"; exit 1; }

# ---------- Xcode Command Line Tools ----------
info "Checking Xcode Command Line Tools..."
if xcode-select -p &>/dev/null; then
  ok "Xcode CLT already installed"
else
  info "Installing Xcode Command Line Tools (this may take a few minutes)..."
  xcode-select --install 2>/dev/null || true
  # Wait for the installation to complete
  until xcode-select -p &>/dev/null; do
    sleep 5
  done
  ok "Xcode CLT installed"
fi

# ---------- Homebrew ----------
info "Checking Homebrew..."
if command -v brew &>/dev/null; then
  ok "Homebrew already installed"
else
  info "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  # Add brew to PATH for this session (Apple Silicon vs Intel)
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi
  ok "Homebrew installed"
fi

# ---------- Git (ensure recent version) ----------
info "Checking Git..."
if brew list git &>/dev/null; then
  ok "Git (Homebrew) already installed"
else
  brew install git
  ok "Git installed via Homebrew"
fi

# ---------- NVM + Node ----------
info "Checking nvm..."
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  ok "nvm already installed"
else
  info "Installing nvm..."
  brew install nvm
  mkdir -p "$NVM_DIR"
  ok "nvm installed"
fi

# Source nvm for this session
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && source "$NVM_DIR/nvm.sh"
# Also try the Homebrew path
if ! command -v nvm &>/dev/null; then
  NVM_BREW_PREFIX="$(brew --prefix nvm 2>/dev/null || true)"
  if [[ -s "$NVM_BREW_PREFIX/nvm.sh" ]]; then
    source "$NVM_BREW_PREFIX/nvm.sh"
  fi
fi

if ! command -v nvm &>/dev/null; then
  fail "nvm installed but not available in this session. Open a new terminal and re-run this script."
fi

# Install the Node version from .nvmrc
REQUIRED_NODE_VERSION=$(cat .nvmrc 2>/dev/null || echo "22")
info "Installing Node.js v${REQUIRED_NODE_VERSION} (from .nvmrc)..."
nvm install "$REQUIRED_NODE_VERSION"
nvm use "$REQUIRED_NODE_VERSION"
ok "Node.js $(node --version) active"

# ---------- npm dependencies ----------
info "Installing npm dependencies..."
npm install
ok "npm dependencies installed"

# ---------- Playwright browsers ----------
info "Installing Playwright browsers..."
npx playwright install --with-deps chromium
ok "Playwright browsers installed"

# ---------- Netlify CLI ----------
info "Checking Netlify CLI..."
if command -v netlify &>/dev/null; then
  ok "Netlify CLI already installed ($(netlify --version))"
else
  info "Installing Netlify CLI..."
  npm install -g netlify-cli
  ok "Netlify CLI installed"
fi

# ---------- GitHub CLI ----------
info "Checking GitHub CLI..."
if command -v gh &>/dev/null; then
  ok "GitHub CLI already installed"
else
  info "Installing GitHub CLI..."
  brew install gh
  ok "GitHub CLI installed"
fi

# ---------- Summary ----------
echo ""
info "Setup complete! Here's what's ready:"
echo ""
ok "Xcode CLT    — $(xcode-select -p)"
ok "Homebrew     — $(brew --version | head -1)"
ok "Git          — $(git --version)"
ok "nvm          — $(nvm --version 2>/dev/null || echo 'installed')"
ok "Node.js      — $(node --version)"
ok "npm          — $(npm --version)"
ok "Playwright   — chromium installed"
ok "Netlify CLI  — $(netlify --version 2>/dev/null || echo 'installed')"
ok "GitHub CLI   — $(gh --version 2>/dev/null | head -1)"
echo ""
info "Next steps:"
echo "  1. npm run dev          — Start the dev server at http://localhost:1213"
echo "  2. npm run verify       — Build + run all 51 tests"
echo "  3. netlify login        — Authenticate with Netlify (one-time)"
echo "  4. gh auth login        — Authenticate with GitHub (one-time)"
echo ""
echo "  Notion API keys are stored in Netlify Dashboard — never commit them."
echo ""
