#!/usr/bin/env bash
# SessionStart hook: put the Node pinned in .nvmrc on PATH for every Bash
# command Claude runs in this session.
#
# Claude's Bash tool runs a non-interactive shell that never reads ~/.zshrc,
# so on a Mac where nvm is loaded from there, `node` silently resolves to
# whatever else is on PATH (e.g. Homebrew's latest major). Builds and tests then
# run on the wrong Node without any error.
#
# Exporting PATH through $CLAUDE_ENV_FILE is how a SessionStart hook changes the
# environment of later Bash calls. If nvm isn't installed (cloud sessions, CI),
# this only checks the version and warns. It always exits 0: a broken hook must
# never block a session.

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
nvmrc="$project_dir/.nvmrc"
[ -f "$nvmrc" ] || exit 0
want_major="$(tr -d '[:space:]v' < "$nvmrc" | cut -d. -f1)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
for f in "$NVM_DIR/nvm.sh" /opt/homebrew/opt/nvm/nvm.sh /usr/local/opt/nvm/nvm.sh; do
  [ -s "$f" ] && . "$f" >/dev/null 2>&1 && break
done

if command -v nvm >/dev/null 2>&1 && cd "$project_dir" && nvm use --silent >/dev/null 2>&1; then
  node_bin="$(dirname "$(nvm which current)")"
  [ -n "$CLAUDE_ENV_FILE" ] && echo "export PATH=\"$node_bin\":\"\$PATH\"" >> "$CLAUDE_ENV_FILE"
  export PATH="$node_bin:$PATH"
fi

have="$(node -v 2>/dev/null)"
have_major="${have#v}"; have_major="${have_major%%.*}"

if [ "$have_major" != "$want_major" ]; then
  msg="Node mismatch: .nvmrc pins Node ${want_major} but this session's node is ${have:-missing}. Builds and tests must run on Node ${want_major}. If nvm is installed, run \`nvm install ${want_major}\`; otherwise prefix commands with a Node ${want_major} binary. npm scripts fail fast on this mismatch (scripts/check-node-version.mjs)."
  # The message has no quotes or backslashes to escape, so plain interpolation
  # yields valid JSON without depending on jq or a working node.
  printf '{"systemMessage":"%s","hookSpecificOutput":{"hookEventName":"SessionStart","additionalContext":"%s"}}\n' "$msg" "$msg"
fi
exit 0
