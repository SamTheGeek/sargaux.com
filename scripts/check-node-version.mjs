// Fail fast when npm scripts run on a Node major other than the one in .nvmrc.
//
// A shell that never loads nvm (Claude's non-interactive Bash, an IDE task, a
// fresh terminal before `nvm use`) silently falls through to any other `node`
// on PATH, e.g. Homebrew's latest major. The build and tests then pass or fail
// for reasons production never sees. Netlify and CI take their Node from the
// same pin, so a mismatch here is always a local environment problem.
//
// Escape hatch for a deliberate experiment: SKIP_NODE_VERSION_CHECK=1.
import { readFileSync } from 'node:fs';

if (process.env.SKIP_NODE_VERSION_CHECK !== '1') {
  const pinned = readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8').trim().replace(/^v/, '');
  const wantMajor = pinned.split('.')[0];
  const haveMajor = process.versions.node.split('.')[0];

  // Only enforce a numeric pin; aliases like `lts/*` can't be compared here.
  if (/^\d+$/.test(wantMajor) && haveMajor !== wantMajor) {
    console.error(
      `\n✗ Node ${process.version} is running, but .nvmrc pins Node ${wantMajor}.\n` +
        `  Run \`nvm use\` (or \`nvm install ${wantMajor}\`) and retry.\n` +
        `  Node binary: ${process.execPath}\n` +
        `  To bypass deliberately: SKIP_NODE_VERSION_CHECK=1\n`
    );
    process.exit(1);
  }
}
