import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ flagEnabled: true }));

vi.mock('../../src/constants/feature-flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/constants/feature-flags')>();
  return {
    ...actual,
    FEATURE_FLAGS: {
      ...actual.FEATURE_FLAGS,
      get DME_ORDERS_ENABLED() {
        return state.flagEnabled;
      },
    },
  };
});

const loadRoutes = async (): Promise<typeof import('../../src/features/visits/in-person/routing/routesInPerson')> => {
  vi.resetModules();
  return import('../../src/features/visits/in-person/routing/routesInPerson');
};

describe('DME chart routes and the DME feature flag', () => {
  beforeEach(() => {
    state.flagEnabled = true;
  });

  it('registers every DME route while DME is enabled', async () => {
    const { routesInPerson, ROUTER_PATH } = await loadRoutes();
    for (const path of [ROUTER_PATH.DME, ROUTER_PATH.DME_CREATE, ROUTER_PATH.DME_DETAILS, ROUTER_PATH.DME_EDIT]) {
      expect(routesInPerson[path].modes).toEqual(['main', 'follow-up']);
      expect(routesInPerson[path].element).not.toBeNull();
    }
  });

  it('keeps only the hidden details route once DME is disabled', async () => {
    state.flagEnabled = false;
    const { routesInPerson, ROUTER_PATH } = await loadRoutes();
    for (const path of [ROUTER_PATH.DME, ROUTER_PATH.DME_CREATE, ROUTER_PATH.DME_EDIT]) {
      expect(routesInPerson[path].modes).toEqual([]);
      expect(routesInPerson[path].element).toBeNull();
    }
    const details = routesInPerson[ROUTER_PATH.DME_DETAILS];
    expect(details.modes).toEqual(['main', 'follow-up']);
    expect(details.isSkippedInNavigation).toBe(true);
    expect(details.element).not.toBeNull();
  });
});
