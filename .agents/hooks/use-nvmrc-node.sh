#!/usr/bin/env bash
# SessionStart hook: put the Node pinned in .nvmrc on PATH, via nvm, for every
# Bash command Claude runs in this session — locally and in cloud sessions.
#
# Claude's Bash tool runs a non-interactive shell that never reads ~/.zshrc,
# so on a Mac where nvm is loaded from there, `node` silently resolves to
# whatever else is on PATH (e.g. Homebrew's latest major). Builds and tests then
# run on the wrong Node without any error.
#
# Exporting PATH through $CLAUDE_ENV_FILE is how a SessionStart hook changes the
# environment of later Bash calls.
#
# Local (Mac): nvm comes from scripts/setup.sh (Homebrew). This hook never
# installs anything locally — it only loads nvm and runs `nvm use`.
#
# Cloud (Claude Code on the web, CLAUDE_CODE_REMOTE=true): the image ships no
# nvm and puts /opt/node22 first on PATH. The container is fresh every
# session, so the hook bootstraps a pinned nvm into ~/.nvm and runs
# `nvm install`, which reads .nvmrc and downloads that exact release from
# nodejs.org (nvm verifies its checksum). Both hosts are reachable through the
# default cloud network policy.
#
# Whatever happens, the hook ends by comparing the active major against
# .nvmrc and warns on a mismatch. It always exits 0: a broken hook must never
# block a session.

NVM_VERSION="v0.40.3"

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
nvmrc="$project_dir/.nvmrc"
[ -f "$nvmrc" ] || exit 0
want_major="$(tr -d '[:space:]v' < "$nvmrc" | cut -d. -f1)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"

load_nvm() {
  local f
  for f in "$NVM_DIR/nvm.sh" /opt/homebrew/opt/nvm/nvm.sh /usr/local/opt/nvm/nvm.sh; do
    # --no-use: don't let nvm.sh auto-activate (and fail on) .nvmrc while loading.
    [ -s "$f" ] && . "$f" --no-use >/dev/null 2>&1 && return 0
  done
  return 1
}

# Cloud only: fetch nvm's three runtime files from a pinned tag. Uses curl
# directly rather than nvm's install.sh, which git-clones from github.com and
# edits shell profiles — neither of which a throwaway container needs.
bootstrap_nvm_in_cloud() {
  [ "$CLAUDE_CODE_REMOTE" = "true" ] || return 1
  command -v curl >/dev/null 2>&1 || return 1
  local base="https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}" f
  mkdir -p "$NVM_DIR" || return 1
  for f in nvm.sh nvm-exec bash_completion; do
    curl -fsSL --retry 3 -o "$NVM_DIR/$f.tmp" "$base/$f" || return 1
    mv "$NVM_DIR/$f.tmp" "$NVM_DIR/$f"
  done
  chmod +x "$NVM_DIR/nvm-exec"
  load_nvm
}

if load_nvm || bootstrap_nvm_in_cloud; then
  cd "$project_dir" || exit 0
  if [ "$CLAUDE_CODE_REMOTE" = "true" ]; then
    # Installs the .nvmrc release if missing (no-op once present), then uses it.
    nvm install --no-progress >/dev/null 2>&1
  fi
  if nvm use --silent >/dev/null 2>&1; then
    node_bin="$(dirname "$(nvm which current)")"
    [ -n "$CLAUDE_ENV_FILE" ] && {
      echo "export NVM_DIR=\"$NVM_DIR\""
      echo "export PATH=\"$node_bin\":\"\$PATH\""
    } >> "$CLAUDE_ENV_FILE"
    export PATH="$node_bin:$PATH"
  fi
fi

have="$(node -v 2>/dev/null)"
have_major="${have#v}"; have_major="${have_major%%.*}"

if [ "$have_major" != "$want_major" ]; then
  msg="Node mismatch: .nvmrc pins Node ${want_major} but this session's node is ${have:-missing}. Builds and tests must run on Node ${want_major}. If nvm is installed, run \`nvm install\` in the repo; otherwise install nvm (./scripts/setup.sh on a Mac). npm scripts fail fast on this mismatch (scripts/check-node-version.mjs)."
  # The message has no quotes or backslashes to escape, so plain interpolation
  # yields valid JSON without depending on jq or a working node.
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg" "$msg"
fi
exit 0
