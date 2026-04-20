#!/usr/bin/env bun
/**
 * Alias package for @tokscale/cli.
 * Requires Bun runtime for OpenTUI's native Zig modules.
 * 
 * IMPORTANT: Load OpenTUI preload BEFORE importing CLI.
 * This registers the Bun plugin for TSX transformation before
 * any module resolution that might encounter jsx-runtime imports.
 */
try {
  await import('@opentui/solid/preload');
} catch {
  // Preload may fail in non-Bun environments or if deps not installed
}
await import('@tokscale/cli');
