import { describe, expect, test } from 'vitest';
import {
  inHouseMedicationsMedicationApplianceRoutes,
  isRouteRequiringAdministrationLocation,
  medicationApplianceRoutes,
  ROUTE_CODES_REQUIRING_ADMINISTRATION_LOCATION,
} from './medication-administration.types';

// The routes clinical asked to treat as injectables, as they read in the Route menu.
const INJECTABLE_ROUTE_NAMES = [
  'Intramuscular route',
  'Intravenous route',
  'IV Infusion',
  'Ophthalmic route',
  'Otic route',
  'Conjunctival route',
  'Intra-arterial route',
  'Intra-articular route',
  'Intrabursal use',
  'Intracameral route',
  'Intracorneal route',
  'Intradermal use',
  'Intraocular use',
  'Intraosseous route',
  'Intrasynovial route',
  'Intratendinous route',
  'Intratympanic route',
  'Intravenous central route',
  'Intravenous peripheral route',
  'Intravitreal route',
  'Ocular route',
  'Periarticular use',
  'Peribulbar route',
  'Perineural use',
  'Peritendinous route',
  'Posterior juxtascleral route',
  'Retrobulbar route',
  'Subconjunctival use',
  'Subcutaneous route',
  'Subretinal route',
  'Transtympanic route',
  'Topical route',
  'Cutaneous route',
  'Epilesional route',
  'Infiltration route',
  'Intralesional use',
  'Intravascular route',
  'Percutaneous route',
  'Sublesional route',
  'Transdermal route',
];

const routeName = (code: string): string | undefined =>
  Object.values(medicationApplianceRoutes)
    .find((route) => route.code === code)
    ?.display?.replace(' (qualifier value)', '');

describe('ROUTE_CODES_REQUIRING_ADMINISTRATION_LOCATION', () => {
  test('holds exactly the injectable routes from the Route menu', () => {
    const names = ROUTE_CODES_REQUIRING_ADMINISTRATION_LOCATION.map(routeName);
    expect([...names].sort()).toEqual([...INJECTABLE_ROUTE_NAMES].sort());
    expect(new Set(ROUTE_CODES_REQUIRING_ADMINISTRATION_LOCATION).size).toBe(INJECTABLE_ROUTE_NAMES.length);
  });
});

describe('isRouteRequiringAdministrationLocation', () => {
  test('is true for injectable routes', () => {
    expect(isRouteRequiringAdministrationLocation(medicationApplianceRoutes.INTRAMUSCULAR.code)).toBe(true);
    expect(isRouteRequiringAdministrationLocation(medicationApplianceRoutes.SUBCUTANEOUS.code)).toBe(true);
  });

  test('is false for other routes and for no route', () => {
    expect(isRouteRequiringAdministrationLocation(medicationApplianceRoutes.ORAL.code)).toBe(false);
    expect(isRouteRequiringAdministrationLocation(inHouseMedicationsMedicationApplianceRoutes.INHALATION.code)).toBe(
      false
    );
    expect(isRouteRequiringAdministrationLocation(undefined)).toBe(false);
    expect(isRouteRequiringAdministrationLocation('')).toBe(false);
  });
});
