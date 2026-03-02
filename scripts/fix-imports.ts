/**
 * Auto-fixes import violations detected by check-imports.ts.
 * Run from the package root directory.
 *
 * Fixes:
 *   1. Deep relative imports (../.. or deeper) → subpath imports (#name/...)
 *   2. .js extensions in import specifiers → removed
 */

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

// --- Load package config ---

type PackageJson = { name: string; imports?: Record<string, string> };
const pkg = JSON.parse(readFileSync('package.json', 'utf-8')) as PackageJson;
const subpathImports = pkg.imports ?? {};

if (Object.keys(subpathImports).length === 0) {
  console.log(`[${pkg.name}] No "imports" field — nothing to fix.`);
  process.exit(0);
}

const validPrefixes = Object.keys(subpathImports).map((k) => k.replace(/\/\*$/, ''));
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

function toSubpath(fromFile: string, specifier: string): string {
  const normalized = specifier.replace(/\.js$/, '');
  const abs = resolve(dirname(fromFile), normalized);
  const rel = relative('src', abs);
  const parts = rel.split('/');
  const top = parts[0];
  if (!topFolders.has(top)) return normalized;
  const rest = parts.slice(1).join('/');
  return rest ? `#${top}/${rest}` : `#${top}`;
}

// --- Fix ---

let totalFiles = 0;
let totalImports = 0;

for (const file of walkSrc('src')) {
  const original = readFileSync(file, 'utf-8');

  const fixed = original.replace(/\bfrom\s+(['"])([^'"]+)['"]/g, (match, quote, specifier) => {
    if (specifier.startsWith('..')) {
      // Fix 1: deep relative import → subpath
      const depth = (specifier.match(/\.\.\//g) ?? []).length;
      if (depth > 1) {
        totalImports++;
        return `from ${quote}${toSubpath(file, specifier)}${quote}`;
      }
      // Fix 2: .js extension in shallow relative import (..)
      if (specifier.endsWith('.js')) {
        totalImports++;
        return `from ${quote}${specifier.replace(/\.js$/, '')}${quote}`;
      }
    }
    // Fix 3: .js extension in same-directory import (./)
    if (specifier.startsWith('./') && specifier.endsWith('.js')) {
      totalImports++;
      return `from ${quote}${specifier.replace(/\.js$/, '')}${quote}`;
    }
    return match;
  });

  if (fixed !== original) {
    writeFileSync(file, fixed);
    totalFiles++;
    console.log(`  fixed  ${file}`);
  }
}

console.log(`\n[${pkg.name}] Fixed ${totalImports} imports across ${totalFiles} files.`);
