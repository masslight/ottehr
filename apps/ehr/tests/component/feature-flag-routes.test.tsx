import { describe, expect, it, vi } from 'vitest';

// routesInPerson is a Record computed at module load time, reading FEATURE_FLAGS.
// Since FEATURE_FLAGS is read at evaluation time, we need vi.resetModules + dynamic import.
// We use vi.doMock (non-hoisted) inside the helper, after vi.resetModules().

// Persistent mocks for deep dependencies (hoisted, survive resetModules)
vi.mock('src/api/api', () => ({
  getAppointments: vi.fn(),
  getUser: vi.fn(),
  apiClient: {},
}));
vi.mock('src/hooks/useEvolveUser', () => ({
  useEvolveUser: vi.fn(() => ({ user: null })),
}));
vi.mock('src/hooks/useAppClients', () => ({
  useApiClients: () => ({ oystehr: null, oystehrZambda: null }),
}));

interface RouteInPerson {
  path?: string;
  element: React.ReactNode | null;
  modes: string[];
}

async function getRoutesWithFlags(flags: Record<string, boolean>): Promise<Record<string, RouteInPerson>> {
  // Clear module cache so routesInPerson is re-evaluated
  vi.resetModules();

  // Set up the feature flags mock for this evaluation
  vi.doMock('src/constants/feature-flags', () => ({
    FEATURE_FLAGS: {
      LAB_ORDERS_ENABLED: false,
      RADIOLOGY_ENABLED: false,
      IN_HOUSE_LABS_ENABLED: false,
      NURSING_ORDERS_ENABLED: false,
      SUPERVISOR_APPROVAL_ENABLED: false,
      DEMO_VISITS_ENABLED: false,
      GLOBAL_TEMPLATES_ENABLED: false,
      FORMS_ENABLED: false,
      LEGACY_DATA_ENABLED: false,
      LEGACY_PATIENT_FOLLOWUPS_ENABLED: false,
      MAILING_PAPER_STATEMENTS_ENABLED: false,
      SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG: false,
      ...flags,
    },
  }));

  // Also need to re-mock with the path used by routesInPerson.tsx
  vi.doMock('../../../../src/constants/feature-flags', () => ({
    FEATURE_FLAGS: {
      LAB_ORDERS_ENABLED: false,
      RADIOLOGY_ENABLED: false,
      IN_HOUSE_LABS_ENABLED: false,
      NURSING_ORDERS_ENABLED: false,
      SUPERVISOR_APPROVAL_ENABLED: false,
      DEMO_VISITS_ENABLED: false,
      GLOBAL_TEMPLATES_ENABLED: false,
      FORMS_ENABLED: false,
      LEGACY_DATA_ENABLED: false,
      LEGACY_PATIENT_FOLLOWUPS_ENABLED: false,
      MAILING_PAPER_STATEMENTS_ENABLED: false,
      SKIP_SENDING_VISIT_NOTE_TO_PATIENT_PORTAL_WHEN_THE_NOTE_IS_SIGNED_FEATURE_FLAG: false,
      ...flags,
    },
  }));

  const mod = await import('../../src/features/visits/in-person/routing/routesInPerson');
  return mod.routesInPerson as unknown as Record<string, RouteInPerson>;
}

function filterRoutes(routes: Record<string, RouteInPerson>, substring: string): RouteInPerson[] {
  return Object.entries(routes)
    .filter(([key]) => key.toLowerCase().includes(substring))
    .map(([, route]) => route);
}

describe('routesInPerson - LAB_ORDERS_ENABLED', () => {
  it('includes lab order routes with modes when enabled', async () => {
    const routes = await getRoutesWithFlags({ LAB_ORDERS_ENABLED: true });
    const labRoutes = filterRoutes(routes, 'external-lab');
    expect(labRoutes.length).toBeGreaterThan(0);
    for (const route of labRoutes) {
      expect(route.element).not.toBeNull();
      expect(route.modes.length).toBeGreaterThan(0);
    }
  });

  it('excludes lab order routes when disabled', async () => {
    const routes = await getRoutesWithFlags({ LAB_ORDERS_ENABLED: false });
    const labRoutes = filterRoutes(routes, 'external-lab');
    for (const route of labRoutes) {
      expect(route.element).toBeNull();
      expect(route.modes.length).toBe(0);
    }
  });
});

describe('routesInPerson - RADIOLOGY_ENABLED', () => {
  it('includes radiology routes when enabled', async () => {
    const routes = await getRoutesWithFlags({ RADIOLOGY_ENABLED: true });
    const radioRoutes = filterRoutes(routes, 'radiology');
    expect(radioRoutes.length).toBeGreaterThan(0);
    for (const route of radioRoutes) {
      expect(route.element).not.toBeNull();
      expect(route.modes.length).toBeGreaterThan(0);
    }
  });

  it('excludes radiology routes when disabled', async () => {
    const routes = await getRoutesWithFlags({ RADIOLOGY_ENABLED: false });
    const radioRoutes = filterRoutes(routes, 'radiology');
    for (const route of radioRoutes) {
      expect(route.element).toBeNull();
      expect(route.modes.length).toBe(0);
    }
  });
});

describe('routesInPerson - IN_HOUSE_LABS_ENABLED', () => {
  it('includes in-house lab routes when enabled', async () => {
    const routes = await getRoutesWithFlags({ IN_HOUSE_LABS_ENABLED: true });
    const inHouseRoutes = filterRoutes(routes, 'in-house-lab');
    expect(inHouseRoutes.length).toBeGreaterThan(0);
    for (const route of inHouseRoutes) {
      expect(route.element).not.toBeNull();
      expect(route.modes.length).toBeGreaterThan(0);
    }
  });

  it('excludes in-house lab routes when disabled', async () => {
    const routes = await getRoutesWithFlags({ IN_HOUSE_LABS_ENABLED: false });
    const inHouseRoutes = filterRoutes(routes, 'in-house-lab');
    for (const route of inHouseRoutes) {
      expect(route.element).toBeNull();
      expect(route.modes.length).toBe(0);
    }
  });
});

describe('routesInPerson - NURSING_ORDERS_ENABLED', () => {
  it('includes nursing order routes when enabled', async () => {
    const routes = await getRoutesWithFlags({ NURSING_ORDERS_ENABLED: true });
    const nursingRoutes = filterRoutes(routes, 'nursing');
    expect(nursingRoutes.length).toBeGreaterThan(0);
    for (const route of nursingRoutes) {
      expect(route.element).not.toBeNull();
      expect(route.modes.length).toBeGreaterThan(0);
    }
  });

  it('excludes nursing order routes when disabled', async () => {
    const routes = await getRoutesWithFlags({ NURSING_ORDERS_ENABLED: false });
    const nursingRoutes = filterRoutes(routes, 'nursing');
    for (const route of nursingRoutes) {
      expect(route.element).toBeNull();
      expect(route.modes.length).toBe(0);
    }
  });
});
