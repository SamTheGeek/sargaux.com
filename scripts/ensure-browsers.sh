#!/usr/bin/env bash
# Ensure Playwright browsers are installed before running tests

set -e

echo "Checking for Playwright browsers..."

# Check if chromium is installed by trying to get browser path
if npx playwright install --dry-run chromium 2>&1 | grep -q "is already installed"; then
  echo "✓ Playwright browsers already installed"
else
  echo "Installing Playwright browsers..."
  npx playwright install --with-deps chromium
  echo "✓ Playwright browsers installed successfully"
fi
