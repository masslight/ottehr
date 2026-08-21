// Easy Chart is a TAB of the in-person chart, and the ways that arrangement breaks are all silent.
//
// It used to live at its own `/easy-chart/:encounterId` route, outside InPersonLayout. That is what made
// the page's editing surfaces fail: the layout is what loads the appointment into the store and
// initialises the exam/ROS observation stores, so hosted components rendered outside it threw on save
// before any request went out. Moving it under `/in-person/:id/easy-charting` fixed that by construction —
// so the tests here pin the construction, not the symptom.
//
// Structural (source-text) assertions rather than a rendered router: mounting the in-person route pulls in
// every chart page, and jsdom has no layout, so a render test could not tell a reachable tab from an
// unreachable one anyway.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EASY_CHART_ROLES } from 'utils/lib/easy-chart/access';
import { RoleType } from 'utils/lib/types/api/user.types';
import { describe, expect, it } from 'vitest';
import { userHasRouteRoles } from '../../src/features/visits/in-person/routing/route-access';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (relative: string): string => readFileSync(join(HERE, '../..', relative), 'utf8');

const ROUTES = read('src/features/visits/in-person/routing/routesInPerson.tsx');
const NAV_CONTEXT = read('src/features/visits/in-person/context/InPersonNavigationContext.tsx');
const SIDEBAR = read('src/features/visits/shared/components/Sidebar.tsx');
const APP = read('src/App.tsx');
const TRACKING_ROW = read('src/components/AppointmentTableRow.tsx');
const PAGE = read('src/features/easy-chart/pages/EasyChartPage.tsx');
const DATA_HOOK = read('src/features/easy-chart/hooks/useEasyChartData.ts');
const VISIT_HOOK = read('src/features/easy-chart/hooks/useEasyChartVisit.ts');
const TOGGLE = read('src/features/visits/in-person/components/ChartViewModeToggle.tsx');
const LAYOUT = read('src/features/visits/in-person/layout/InPersonLayout.tsx');

describe('userHasRouteRoles', () => {
  const withRoles = (roles: RoleType[]): { hasRole: (asked: RoleType[]) => boolean } => ({
    hasRole: (asked: RoleType[]) => asked.some((role) => roles.includes(role)),
  });

  it('lets anyone reach a route that declares no roles', () => {
    expect(userHasRouteRoles({}, undefined)).toBe(true);
    expect(userHasRouteRoles({ requiredRoles: [] }, undefined)).toBe(true);
  });

  it('admits a user holding one of the required roles', () => {
    expect(userHasRouteRoles({ requiredRoles: EASY_CHART_ROLES }, withRoles([RoleType.Provider]))).toBe(true);
  });

  it('refuses a user holding none of them', () => {
    expect(userHasRouteRoles({ requiredRoles: EASY_CHART_ROLES }, withRoles([RoleType.CustomerSupport]))).toBe(false);
  });

  it('refuses while the user is still unknown, rather than waving them through', () => {
    // The permissive direction here would flash a tab into the sidebar for a role that may not have it.
    expect(userHasRouteRoles({ requiredRoles: EASY_CHART_ROLES }, undefined)).toBe(false);
    expect(userHasRouteRoles({ requiredRoles: EASY_CHART_ROLES }, null)).toBe(false);
  });
});

describe('the Easy Chart tab', () => {
  it('is registered as an in-person route under the appointment-keyed path', () => {
    expect(ROUTES).toContain("EASY_CHARTING = 'easy-charting'");
    expect(ROUTES).toContain('[ROUTER_PATH.EASY_CHARTING]: {');
  });

  it('keeps BOTH gates: the feature flag and the endpoints own role set', () => {
    const record = ROUTES.slice(ROUTES.indexOf('[ROUTER_PATH.EASY_CHARTING]: {'));
    const entry = record.slice(0, record.indexOf('\n  },'));
    // The flag decides `modes`, because an empty mode list is how a route record says "not available".
    expect(entry).toMatch(/modes:\s*FEATURE_FLAGS\.EASY_CHART_ENABLED\s*\?/);
    // The SAME list the endpoints check, imported rather than restated — a second copy is how the UI
    // gate and the API gate drift into a tab that 403s, or an endpoint with no way in.
    expect(entry).toContain('requiredRoles: EASY_CHART_ROLES');
    expect(ROUTES).toContain("import { EASY_CHART_ROLES } from 'utils/lib/easy-chart/access'");
  });

  it('is kept OUT of the section navigation', () => {
    const record = ROUTES.slice(ROUTES.indexOf('[ROUTER_PATH.EASY_CHARTING]: {'));
    const entry = record.slice(0, record.indexOf('\n  },'));
    // The sidebar lists SECTIONS of one note and the bottom bar walks them in order. Easy Chart is a
    // different way of working on the whole note, reached from the header switch — listing it among the
    // sections would also make it a step in the intake's next/previous flow.
    expect(entry).toContain('isSkippedInNavigation: true');
  });

  it('takes the whole width: no section sidebar beside it', () => {
    expect(LAYOUT).toContain('{!isEasyChart && <Sidebar />}');
    // Matched on the splat, the same way the navigation context reads the current tab, so the two cannot
    // disagree about which tab is open.
    expect(LAYOUT).toMatch(/useMatch\('\/in-person\/:id\/\*'\)\?\.params\['\*'\] === ROUTER_PATH\.EASY_CHARTING/);
  });

  it('is code-split behind a LOCAL Suspense boundary', () => {
    // Local, so a chunk fetch does not suspend to App.tsx's boundary and blink the whole chart away.
    expect(ROUTES).toMatch(/lazy\(\(\) => import\('src\/features\/easy-chart\/pages\/EasyChartPage'\)\)/);
    expect(ROUTES).toContain('<EasyChartPageLazy />');
  });

  it('applies the role gate at BOTH places a route record becomes reachable', () => {
    // Only the router: a menu entry that bounces back to the first tab. Only the menu: a URL that works
    // for anyone who types it.
    expect(NAV_CONTEXT).toContain('userHasRouteRoles(route, currentUser)');
    expect(SIDEBAR).toContain('userHasRouteRoles(route, currentUser)');
  });

  it('no longer has a standalone route outside the chart layout', () => {
    expect(APP).not.toContain('easy-chart');
    expect(APP).not.toContain('EASY_CHART_ROLES');
  });

  it('is linked from the tracking board the same way Review & Sign is', () => {
    // Through the helper that resolves a follow-up to its parent appointment and carries the follow-up
    // encounter id in the query string. A raw `/easy-chart/${encounterId}` cannot do either.
    expect(TRACKING_ROW).toContain('getInPersonUrlByAppointmentType(appointment, ROUTER_PATH.EASY_CHARTING)');
    expect(TRACKING_ROW).not.toContain('getEasyChartUrl');
  });
});

describe('what the page now takes from the layout instead of the URL', () => {
  it('reads the encounter id from the appointment store, not from route params', () => {
    // The route is keyed by APPOINTMENT id now, so `useParams().encounterId` is always undefined.
    expect(PAGE).not.toContain('useParams');
    expect(PAGE).toContain('const encounterId = visit.encounter?.id');
  });

  it('reads the visit from the store rather than fetching it by encounter id', () => {
    expect(VISIT_HOOK).toContain('useAppointmentData()');
    expect(VISIT_HOOK).not.toContain('useQuery');
    // The safety property survives the rewrite: locked until the visit has actually loaded, because an
    // absent appointment reads as UNLOCKED and a signed visit would look writable.
    expect(VISIT_HOOK).toMatch(/isReadOnly:\s*isLoaded\s*\?\s*isAppointmentReadOnly\s*:\s*true/);
  });

  it('stops asking for shouldUpdateExams, which InPersonLayout now sets for every tab', () => {
    expect(DATA_HOOK).not.toMatch(/shouldUpdateExams:\s*true/);
  });

  it('fills to the bottom of the SCROLLING pane, not the viewport', () => {
    // Inside the layout the viewport bottom is not the usable bottom: the bottom navigation bar is below
    // the tab's pane. Filling to 100vh pushes the grid under it, that pane scrolls, and the chat composer
    // drifts out of view — the exact failure the pinned layout exists to prevent.
    expect(PAGE).toContain('findScrollParent');
    expect(PAGE).toContain('bottomInset');
  });
});

describe('the header Chart / Easy Chart switch', () => {
  it('asks the navigation context whether the tab is reachable instead of re-deriving it', () => {
    // availableRoutes has already applied the flag, the roles and the interaction mode.
    expect(TOGGLE).toContain('availableRoutes.some((route) => route.path === ROUTER_PATH.EASY_CHARTING)');
    expect(TOGGLE).not.toContain('FEATURE_FLAGS');
    expect(TOGGLE).not.toContain('hasRole');
  });

  it('carries the query string across the switch', () => {
    // `?encounterId=` is what selects a follow-up encounter; dropping it switches the provider to the
    // parent encounter's chart without saying so.
    expect(TOGGLE).toContain('search: location.search');
  });

  it('always has a tab to go back to', () => {
    // A reload loses the router state that remembers where the provider came from.
    expect(TOGGLE).toContain('DEFAULT_CHART_TAB');
    expect(TOGGLE).toMatch(/DEFAULT_CHART_TAB\s*=\s*ROUTER_PATH\.REVIEW_AND_SIGN/);
  });
});
