/**
 * Warns when a guest-data script is running without Node's permission model.
 *
 * The scripts that write names, addresses, or USPS serials declare their
 * filesystem grants in their shebang, so `./scripts/<name>.mjs` runs them
 * sandboxed: they can write only to scripts/output/ (and the serial registry,
 * for the one script that assigns serials), even through a bug or a bad path
 * join. `node scripts/<name>.mjs` skips the shebang and so skips the sandbox.
 * That still works, but it shouldn't happen silently.
 *
 * The sandbox covers the disk only. Node 24's permission model has no network
 * restriction (--allow-net arrived in Node 25), and the scripts that reveal
 * their output in Finder also need --allow-child-process, and the processes
 * they spawn run unsandboxed.
 */
export function warnIfUnsandboxed() {
  if (process.permission) return;
  const script = process.argv[1]?.split('/').pop() ?? 'this script';
  console.warn(
    `⚠️  Running without Node's permission model, so writes aren't confined to scripts/output/.\n` +
      `   Run it as ./scripts/${script} from the repo root to use the grants in its shebang.\n`
  );
}
