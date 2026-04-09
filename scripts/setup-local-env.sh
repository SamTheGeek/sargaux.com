#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

cd "$REPO_ROOT"

if [[ -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE already exists."
  read -r -p "Overwrite it with fresh values? [y/N]: " overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    echo "No changes made."
    exit 0
  fi
fi

echo "Enter the Notion database page IDs used by the app."
echo "Do not use Notion data source/collection IDs here."

read -r -p "Notion API key: " NOTION_API_KEY
read -r -p "Guest List database page ID: " NOTION_GUEST_LIST_DB
read -r -p "Event Catalog database page ID: " NOTION_EVENT_CATALOG_DB
read -r -p "RSVP Responses database page ID: " NOTION_RSVP_RESPONSES_DB

cat > "$ENV_FILE" <<EOT
FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true
FEATURE_GLOBAL_NOTION_BACKEND=true
FEATURE_GLOBAL_I18N=true
FEATURE_NYC_RSVP_ENABLED=true
FEATURE_FRANCE_RSVP_ENABLED=true

NOTION_API_KEY=$NOTION_API_KEY
NOTION_GUEST_LIST_DB=$NOTION_GUEST_LIST_DB
NOTION_EVENT_CATALOG_DB=$NOTION_EVENT_CATALOG_DB
NOTION_RSVP_RESPONSES_DB=$NOTION_RSVP_RESPONSES_DB
EOT

echo "Wrote $ENV_FILE"
echo "You can now run: npm run dev"
echo "And RSVP tests with: npx playwright test tests/rsvp.spec.ts"
