#!/usr/bin/env bash
#
# Create or update .env.local for Notion-backed local development.
#
# Secrets are read with `read -s`: they are never echoed, never printed back,
# never passed as command-line arguments, and only ever written to .env.local
# (mode 600). The script refuses to run inside a Claude Code shell — including
# the `!` prompt prefix — because that output is captured into the session
# transcript. Run it in your own terminal window.
#
# Re-running is safe: every prompt defaults to the value already in
# .env.local (press Enter to keep it), and keys this script doesn't manage
# are carried over untouched.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$REPO_ROOT/.env.local"

if [[ -n "${CLAUDECODE:-}" ]]; then
  echo "This script prompts for API keys, so it won't run inside Claude Code:" >&2
  echo "anything shown here would be saved in the session transcript." >&2
  echo "Open your own terminal window and run:" >&2
  echo "  cd \"$REPO_ROOT\" && ./scripts/setup-local-env.sh" >&2
  exit 1
fi

if [[ ! -t 0 || ! -t 1 ]]; then
  echo "This script is interactive. Run it directly in a terminal:" >&2
  echo "  ./scripts/setup-local-env.sh" >&2
  exit 1
fi

# Never let a stray `set -x` from the caller trace secret values.
set +x
umask 077

# ---------- existing values ----------
# Parsed, never sourced: .env.local is data, not a script.
existing() {
  local key="$1"
  [[ -f "$ENV_FILE" ]] || return 0
  grep -E "^[[:space:]]*${key}[[:space:]]*=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- \
    | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' || true
}

# bash 3.2 (stock macOS) has no associative arrays, so each value lives in
# its own VAL_<KEY> variable, set with printf -v and read with ${!name}.
MANAGED_KEYS=()

set_value() {
  printf -v "VAL_$1" '%s' "$2"
  MANAGED_KEYS+=("$1")
}

get_value() {
  local name="VAL_$1"
  printf '%s' "${!name}"
}

# Keep the existing value, else use the default. No prompt.
keep_or_default() {
  local key="$1" default="$2" current
  current="$(existing "$key")"
  set_value "$key" "${current:-$default}"
}

# Visible prompt for non-secret values (IDs, handles, addresses).
ask() {
  local key="$1" label="$2" default="${3:-}" current answer
  current="$(existing "$key")"
  current="${current:-$default}"
  if [[ -n "$current" ]]; then
    read -r -p "$label [$current]: " answer
  else
    read -r -p "$label: " answer
  fi
  set_value "$key" "${answer:-$current}"
}

# Hidden prompt for secrets. The value is never echoed or displayed.
ask_secret() {
  local key="$1" label="$2" current answer
  current="$(existing "$key")"
  if [[ -n "$current" ]]; then
    read -rs -p "$label (hidden; Enter keeps current): " answer
  else
    read -rs -p "$label (hidden; Enter to skip): " answer
  fi
  echo
  set_value "$key" "${answer:-$current}"
}

# Generated locally unless one already exists. Never displayed.
generated_secret() {
  local key="$1" current
  current="$(existing "$key")"
  set_value "$key" "${current:-$(openssl rand -hex 32)}"
}

if [[ -f "$ENV_FILE" ]]; then
  echo "Updating $ENV_FILE — press Enter at any prompt to keep the current value."
else
  echo "Creating $ENV_FILE."
fi
echo "Secret prompts don't echo what you type or paste."

# ---------- feature flags ----------
keep_or_default FEATURE_GLOBAL_WEDDING_SITE_ENABLED true
keep_or_default FEATURE_GLOBAL_NOTION_BACKEND true
keep_or_default FEATURE_GLOBAL_I18N true
keep_or_default FEATURE_NYC_RSVP_ENABLED true
keep_or_default FEATURE_FRANCE_RSVP_ENABLED true
keep_or_default FEATURE_GLOBAL_RSVP_DELETE_ENABLED true
keep_or_default FEATURE_GLOBAL_ENVELOPE_LOGIN true
keep_or_default FEATURE_REGISTRY_ENABLED true

# ---------- Notion ----------
echo ""
echo "Notion — use database page IDs, not data source/collection IDs."
ask_secret NOTION_API_KEY "Notion API key"
ask NOTION_GUEST_LIST_DB "Guest List database page ID"
ask NOTION_EVENT_CATALOG_DB "Event Catalog database page ID"
ask NOTION_RSVP_RESPONSES_DB "RSVP Responses database page ID"

# ---------- signing secrets ----------
# Local-only values; deliberately not copies of the deployed secrets.
generated_secret SESSION_HMAC_SECRET
generated_secret CALENDAR_HMAC_SECRET

# ---------- admin / email ----------
echo ""
echo "Admin and email — must match the deployed values to call production."
echo "(Netlify stores RESEND_ADMIN_SECRET write-only; netlify env:get can't read it back.)"
ask_secret RESEND_ADMIN_SECRET "Admin bearer secret (RESEND_ADMIN_SECRET)"
ask_secret RESEND_API_KEY "Resend API key"
ask RESEND_FROM_ADDRESS "Resend from address" "hello@mail.sargaux.com"

# ---------- integrations ----------
echo ""
echo "Optional integrations — leave blank to use the site's fallbacks."
ask_secret GOOGLE_MAPS_STATIC_API_KEY "Google Maps Static API key"
ask JOY_EVENT_ID "Joy registry event ID"
ask JOY_EVENT_HANDLE "Joy registry event handle"

# ---------- test login ----------
# Always a synthetic 🤖 guest — never a real one (tests write RSVP rows for
# this party). See docs/test-guests.md.
keep_or_default LOCAL_TESTING_USERNAME "Alex Rivera"

# ---------- write ----------
is_managed() {
  local key="$1" k
  for k in "${MANAGED_KEYS[@]}"; do [[ "$k" == "$key" ]] && return 0; done
  return 1
}

TMP_FILE="$(mktemp "$REPO_ROOT/.env.local.XXXXXX")"
trap 'rm -f "$TMP_FILE"' EXIT

{
  echo "# Generated by scripts/setup-local-env.sh — re-run it to update."
  echo "# See .env.example for what each value is for."
  for key in "${MANAGED_KEYS[@]}"; do
    printf '%s=%s\n' "$key" "$(get_value "$key")"
  done

  # Carry over anything else (e.g. USPS credentials) unchanged.
  if [[ -f "$ENV_FILE" ]]; then
    preserved=()
    while IFS= read -r line || [[ -n "$line" ]]; do
      trimmed="${line#"${line%%[![:space:]]*}"}"
      [[ -z "$trimmed" || "$trimmed" == \#* || "$trimmed" != *=* ]] && continue
      key="${trimmed%%=*}"
      key="${key%"${key##*[![:space:]]}"}"
      is_managed "$key" || preserved+=("$line")
    done < "$ENV_FILE"
    if (( ${#preserved[@]} > 0 )); then
      echo ""
      echo "# Preserved from the previous .env.local"
      printf '%s\n' "${preserved[@]}"
    fi
  fi
} > "$TMP_FILE"

mv "$TMP_FILE" "$ENV_FILE"
trap - EXIT
chmod 600 "$ENV_FILE"

# ---------- summary (names only, never values) ----------
echo ""
echo "Wrote $ENV_FILE (readable only by you). Status:"
for key in "${MANAGED_KEYS[@]}"; do
  [[ "$key" == FEATURE_* ]] && continue
  if [[ -n "$(get_value "$key")" ]]; then
    printf '  ✓ %s\n' "$key"
  else
    printf '  – %s (empty)\n' "$key"
  fi
done
echo ""
echo "Next: npm run dev   — start the dev server"
echo "      npm test      — run all tests"
