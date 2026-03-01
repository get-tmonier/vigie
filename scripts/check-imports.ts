/**
 * Enforces import conventions for any package that has an "imports" field.
 * Run from the package root (turbo handles this automatically).
 *
 * Rules:
 *   1. No .js extensions in import specifiers
 *   2. No relative imports going up 2+ levels (../.. or deeper) — use subpath imports instead
 *
 * Configuration is derived automatically from the package's "imports" field in package.json.
 * No per-package config needed.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// --- Load package config ---

type PackageJson = { name: string; imports?: Record<string, string> };
const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as PackageJson;
const subpathImports = pkg.imports ?? {};

if (Object.keys(subpathImports).length === 0) {
  console.log(`[${pkg.name}] No "imports" field — skipping.`);
  process.exit(0);
}

// "#modules/*" → "#modules" | "#config" → "#config"
const validPrefixes = Object.keys(subpathImports).map((k) => k.replace(/\/\*$/, ''));
// "#modules" → "modules"
const topFolders = new Set(validPrefixes.map((p) => p.slice(1)));

// --- Helpers ---

function* walkSrc(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules') {
      yield* walkSrc(path);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      yield path;
    }
  }
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function suggestSubpath(fromFile: string, specifier: string): string {
  const normalized = specifier.replace(/\.js$/, ''); // strip .js before resolving
  const abs = resolve(dirname(fromFile), normalized);
  const rel = relative('src', abs); // e.g. "entities/daemon/model/types"
  const parts = rel.split('/');
  const top = parts[0];
  if (!topFolders.has(top)) return normalized;
  const rest = parts.slice(1).join('/');
  return rest ? `#${top}/${rest}` : `#${top}`;
}

// --- Scan ---

type Violation = { file: string; line: number; message: string };
const violations: Violation[] = [];

// Matches: from 'x' | from "x"
const IMPORT_RE = /\bfrom\s+['"]([^'"]+)['"]/g;

for (const file of walkSrc('src')) {
  const content = readFileSync(file, 'utf-8');
  IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;

  m = IMPORT_RE.exec(content);
  while (m !== null) {
    const specifier = m[1];
    const line = lineAt(content, m.index);

    // Rule 1: no .js extension
    if (specifier.endsWith('.js')) {
      violations.push({ file, line, message: `Remove .js extension → '${specifier}'` });
    }

    // Rule 2: no ../.. or deeper — must use subpath import
    if (specifier.startsWith('..')) {
      const depth = (specifier.match(/\.\.\//g) ?? []).length;
      if (depth > 1) {
        const suggestion = suggestSubpath(file, specifier);
        violations.push({
          file,
          line,
          message: `Deep relative import — use '${suggestion}' instead of '${specifier}'`,
        });
      }
    }
    m = IMPORT_RE.exec(content);
  }
}

// --- Report ---

if (violations.length === 0) {
  console.log(`[${pkg.name}] check-imports ✓`);
  process.exit(0);
}

console.error(`\n[${pkg.name}] Import violations:\n`);
for (const { file, line, message } of violations) {
  console.error(`  ${file}:${line}  ${message}`);
}
console.error('');
process.exit(1);
