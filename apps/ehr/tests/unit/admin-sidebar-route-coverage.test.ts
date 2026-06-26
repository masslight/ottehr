import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, test } from 'vitest';
import * as adminRoutes from '../../src/features/admin/adminRoutes';

const { isItemActive, ROUTE_ALIASES } = adminRoutes;

const here = path.dirname(fileURLToPath(import.meta.url));
const APP_TSX = path.resolve(here, '../../src/App.tsx');
const ADMIN_NAV_TSX = path.resolve(here, '../../src/features/admin/adminNav.tsx');

// Parameterized container routes (render <AdminPage/>, which resolves its own active item) — no fixed
// leaf URL, so exempt from coverage.
const CONTAINER_PREFIXES = new Set(['/admin', '/admin/billing', '/admin/outreach']);

// Exported URL constant name -> value, for resolving `${CONST}` in route templates.
const URL_CONSTANTS: Record<string, string> = Object.fromEntries(
  Object.entries(adminRoutes).filter((entry): entry is [string, string] => typeof entry[1] === 'string')
);

// Nav item paths read from adminNav.tsx source, to avoid importing the heavy nav module.
function readNavItemPaths(): string[] {
  const src = readFileSync(ADMIN_NAV_TSX, 'utf8');
  const paths = new Set<string>();
  for (const match of src.matchAll(/path:\s*'([^']+)'/g)) {
    if (match[1].startsWith('/admin/')) {
      paths.add(match[1]);
    }
  }
  return [...paths];
}

// Every `/admin/*` route path in App.tsx, with `${CONST}` templates resolved. Matches both
// path="/literal" and path={`${CONST}/template`} forms.
function readAdminRoutePaths(): string[] {
  const src = readFileSync(APP_TSX, 'utf8');
  const paths = new Set<string>();
  for (const match of src.matchAll(/path=(?:"([^"]+)"|\{`([^`]+)`\})/g)) {
    const raw = (match[1] ?? match[2]).replace(/\$\{(\w+)\}/g, (_whole, name) => {
      const value = URL_CONSTANTS[name];
      if (value === undefined) {
        throw new Error(`App.tsx route references unknown URL constant \${${name}}; add it to adminRoutes.ts`);
      }
      return value;
    });
    if (raw === '/admin' || raw.startsWith('/admin/')) {
      paths.add(raw);
    }
  }
  return [...paths];
}

// The non-parameterized leading portion, e.g. `/admin/fee-schedule/:id` -> `/admin/fee-schedule`.
function concretePrefix(routePath: string): string {
  const paramIdx = routePath.indexOf('/:');
  return paramIdx === -1 ? routePath : routePath.slice(0, paramIdx);
}

describe('admin sidebar route coverage', () => {
  const navItemPaths = readNavItemPaths();
  const adminRoutePaths = readAdminRoutePaths();

  test('parser found admin routes and nav items', () => {
    expect(navItemPaths.length).toBeGreaterThan(0);
    expect(adminRoutePaths.length).toBeGreaterThan(0);
  });

  test.each(adminRoutePaths)('route "%s" highlights exactly one sidebar item', (routePath) => {
    const prefix = concretePrefix(routePath);
    if (CONTAINER_PREFIXES.has(prefix)) {
      return; // parameterized container route — exempt
    }
    // Append a dummy segment so prefix matches and trailing-slash aliases both resolve.
    const probe = `${prefix}/x`;
    const matches = navItemPaths.filter((itemPath) => isItemActive(probe, itemPath));
    expect(
      matches,
      `route "${routePath}" should map to exactly one sidebar item, got [${matches.join(', ')}]`
    ).toHaveLength(1);
  });

  test('every route alias targets a real sidebar item', () => {
    for (const alias of ROUTE_ALIASES) {
      expect(navItemPaths, `alias "${alias.prefix}" -> "${alias.itemPath}" matches no sidebar item`).toContain(
        alias.itemPath
      );
    }
  });
});
