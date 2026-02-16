#!/usr/bin/env bash
set -euo pipefail

ENV_FILE=".env.local"

if [[ -f "$ENV_FILE" ]]; then
  echo "$ENV_FILE already exists."
  read -r -p "Overwrite it with fresh values? [y/N]: " overwrite
  if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
    echo "No changes made."
    exit 0
  fi
fi

read -r -p "Notion API key (starts with secret_): " NOTION_API_KEY
read -r -p "Guest List data source ID: " NOTION_GUEST_LIST_DB
read -r -p "Event Catalog data source ID: " NOTION_EVENT_CATALOG_DB
read -r -p "RSVP Responses data source ID: " NOTION_RSVP_RESPONSES_DB

cat > "$ENV_FILE" <<EOT
FEATURE_GLOBAL_WEDDING_SITE_ENABLED=true
FEATURE_GLOBAL_NOTION_BACKEND=true
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
