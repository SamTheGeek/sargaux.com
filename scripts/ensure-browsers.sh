#!/usr/bin/env bash
# Ensure Playwright browsers are installed before running tests

set -e

echo "Checking for Playwright browsers..."

install_args=(chromium)

# --with-deps is only supported for Linux package managers and can hang on macOS.
if [[ "$(uname -s)" == "Linux" ]]; then
  install_args=(--with-deps chromium)
fi

dry_run_output="$(npx playwright install --dry-run chromium 2>&1)"
missing_browser=0

while IFS= read -r line; do
  if [[ "$line" =~ Install\ location:[[:space:]]+(.+)$ ]]; then
    browser_path="${BASH_REMATCH[1]}"
    if [[ ! -d "$browser_path" ]]; then
      missing_browser=1
      break
    fi
  fi
done <<< "$dry_run_output"

if [[ $missing_browser -eq 0 ]]; then
  echo "✓ Playwright browsers are ready"
else
  echo "Installing Playwright browsers..."
  npx playwright install "${install_args[@]}"
  echo "✓ Playwright browsers are ready"
fi
