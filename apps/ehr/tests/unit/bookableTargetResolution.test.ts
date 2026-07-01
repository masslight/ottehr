import { HealthcareService, Location, Practitioner, PractitionerRole, Schedule } from 'fhir/r4b';
import { describe, expect, test } from 'vitest';
import { buildLocationInventories, resolveTargetsAtLocation } from '../../src/components/bookableTargetResolution';

// Pure-function tests for the per-Location resolver. These pin the
// contract the picker relies on: priority order, sub-option emission when
// multiple targets tie at the winning tier, the back-compat "no
// restriction" rule for absent/empty Schedule.serviceCategory, and the
// Group membership rules inherited from isPractitionerRoleMemberOfGroup.
// Pure-function shape means we don't need a render harness; the picker
// has its own component tests for the rendered output.

const SERVICE_CATEGORY_SYSTEM = 'https://fhir.ottehr.com/CodeSystem/service-category';

const makeLocation = (id: string, name = id): Location => ({
  resourceType: 'Location',
  id,
  name,
  identifier: [{ system: 'https://fhir.ottehr.com/r4/slug', value: id }],
});

const makeSchedule = (
  id: string,
  actor: { type: 'Location' | 'PractitionerRole'; id: string },
  categoryCodes?: string[]
): Schedule => ({
  resourceType: 'Schedule',
  id,
  actor: [{ reference: `${actor.type}/${actor.id}` }],
  ...(categoryCodes
    ? {
        serviceCategory: categoryCodes.map((code) => ({
          coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }],
        })),
      }
    : {}),
});

const makeGroup = (
  id: string,
  name: string,
  locationIds: string[],
  opts: { typeCodes?: string[] } = {}
): HealthcareService => ({
  resourceType: 'HealthcareService',
  id,
  name,
  location: locationIds.map((locId) => ({ reference: `Location/${locId}` })),
  // Group's own type[] allow-list — same gate the get-schedule zambda
  // applies. Empty (opts.typeCodes undefined) means "no allow-list
  // configured, supports all"; populated must include the requested code
  // for the resolver to admit the Group.
  ...(opts.typeCodes
    ? {
        type: opts.typeCodes.map((code) => ({
          coding: [{ system: SERVICE_CATEGORY_SYSTEM, code }],
        })),
      }
    : {}),
});

const makePr = (
  id: string,
  locationIds: string[],
  opts: { practitionerId?: string; offersCategoryIds?: string[] } = {}
): PractitionerRole => ({
  resourceType: 'PractitionerRole',
  id,
  ...(opts.practitionerId ? { practitioner: { reference: `Practitioner/${opts.practitionerId}` } } : {}),
  location: locationIds.map((locId) => ({ reference: `Location/${locId}` })),
  // PR opt-in for FHIR-backed service categories — the authoritative
  // `practitionerRoleOffersCategory` check reads this list. Tests for FHIR
  // categories must populate this; tests for BOOKING_CONFIG categories
  // can leave it empty (BOOKING_CONFIG codes can't appear here per the
  // codebase invariant).
  ...(opts.offersCategoryIds
    ? { healthcareService: opts.offersCategoryIds.map((catId) => ({ reference: `HealthcareService/${catId}` })) }
    : {}),
});

const makePractitioner = (id: string, given: string, family: string): Practitioner => ({
  resourceType: 'Practitioner',
  id,
  name: [{ given: [given], family }],
});

describe('buildLocationInventories', () => {
  test('partitions Schedules by actor type and buckets Groups + PRs by their location refs', () => {
    const loc = makeLocation('loc-1');
    const ownSched = makeSchedule('sched-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care']);
    // Schedule actored by a different Location is ignored for loc-1
    const otherSched = makeSchedule('sched-other', { type: 'Location', id: 'loc-2' });
    const pr = makePr('pr-1', ['loc-1'], { practitionerId: 'prac-1' });
    const prSched = makeSchedule('sched-pr', { type: 'PractitionerRole', id: 'pr-1' });
    const grp = makeGroup('grp-1', 'NYC Group', ['loc-1']);
    const practitioner = makePractitioner('prac-1', 'Ada', 'Lovelace');

    const [inv] = buildLocationInventories({
      locations: [loc],
      schedules: [ownSched, otherSched, prSched],
      groups: [grp],
      prs: [pr],
      practitionersById: new Map([['prac-1', practitioner]]),
    });

    expect(inv.location.id).toBe('loc-1');
    expect(inv.ownSchedules.map((s) => s.id)).toEqual(['sched-loc']);
    expect(inv.groupsHere.map((g) => g.id)).toEqual(['grp-1']);
    expect(inv.prsHere).toHaveLength(1);
    expect(inv.prsHere[0].pr.id).toBe('pr-1');
    expect(inv.prsHere[0].practitioner?.id).toBe('prac-1');
    expect(inv.prsHere[0].schedules.map((s) => s.id)).toEqual(['sched-pr']);
  });

  test('a Group referencing N Locations appears in N inventories — same intentional shape as the location-overlap membership rule', () => {
    const locA = makeLocation('loc-a');
    const locB = makeLocation('loc-b');
    const grp = makeGroup('grp-multi', 'Multi-Location Group', ['loc-a', 'loc-b']);

    const inventories = buildLocationInventories({
      locations: [locA, locB],
      schedules: [],
      groups: [grp],
      prs: [],
      practitionersById: new Map(),
    });

    expect(inventories).toHaveLength(2);
    expect(inventories[0].groupsHere.map((g) => g.id)).toEqual(['grp-multi']);
    expect(inventories[1].groupsHere.map((g) => g.id)).toEqual(['grp-multi']);
  });
});

describe('resolveTargetsAtLocation — priority', () => {
  const loc = makeLocation('loc-1');

  test('Location-Schedule wins for a BOOKING_CONFIG category when own Schedule supports it (Group + PR also present)', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      // Group + PR also present — but for BOOKING_CONFIG categories the
      // resolver short-circuits at Tier 1 anyway (PR-Schedules can't carry
      // BOOKING_CONFIG codes per the codebase invariant). The picker
      // should never show Group/PR sub-options when the Location's own
      // Schedule covers the BOOKING_CONFIG category.
      groupsHere: [makeGroup('grp-1', 'NYC Group', ['loc-1'])],
      prsHere: [
        {
          pr: makePr('pr-1', ['loc-1']),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' }, ['urgent-care'])],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, { serviceCategoryCode: 'urgent-care' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('Location');
    expect(result[0].tier).toBe(0);
  });

  test('Location-Schedule wins for a FHIR category when own Schedule explicitly tags the code', () => {
    const inv = {
      location: loc,
      // FHIR category requires strict opt-in even at Tier 1 — but here
      // the Location-Schedule is explicitly tagged with 'acupuncture' so
      // it qualifies and preempts the Group/PR tiers.
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['acupuncture'])],
      groupsHere: [makeGroup('grp-1', 'Acupuncture Group', ['loc-1'])],
      prsHere: [
        {
          pr: makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-acu'] }),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('Location');
    expect(result[0].tier).toBe(0);
  });

  test('Group tier wins for a FHIR category when own Schedule does not tag it but a member PR opts in via healthcareService back-ref', () => {
    const inv = {
      location: loc,
      // Own Schedule tagged with a DIFFERENT category — codings present
      // and don't include acupuncture, so it doesn't admit under strict
      // FHIR rules.
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      groupsHere: [makeGroup('grp-1', 'Acupuncture Group', ['loc-1'])],
      prsHere: [
        {
          // PR at L back-refs the acupuncture HealthcareService — that's
          // the authoritative opt-in per `practitionerRoleOffersCategory`.
          // The PR-Schedule's serviceCategory is irrelevant for the FHIR
          // check (we only need to know a Schedule exists).
          pr: makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-acu'] }),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('HealthcareService');
    expect(result[0].id).toBe('grp-1');
    expect(result[0].tier).toBe(1);
  });

  test('PR tier wins for a FHIR category when only a PR-direct surface opts in via healthcareService back-ref', () => {
    const inv = {
      location: loc,
      // Restrict own Schedule to a different category so it doesn't admit
      // under the strict FHIR rule.
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      groupsHere: [], // no Group at this Location
      prsHere: [
        {
          pr: makePr('pr-1', ['loc-1'], { practitionerId: 'prac-1', offersCategoryIds: ['cat-acu'] }),
          practitioner: makePractitioner('prac-1', 'Ada', 'Lovelace'),
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('PractitionerRole');
    expect(result[0].id).toBe('pr-1');
    expect(result[0].typeSuffix).toBe('Ada Lovelace');
  });

  test('returns empty when no target at any tier covers the category', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      groupsHere: [],
      prsHere: [],
    };

    expect(resolveTargetsAtLocation(inv, { serviceCategoryCode: 'massage' })).toEqual([]);
  });
});

describe('resolveTargetsAtLocation — ambiguity within a tier', () => {
  const loc = makeLocation('loc-1');

  test('two Groups at the same Location both supporting a FHIR category → both surface as sub-options', () => {
    const inv = {
      location: loc,
      // Own Schedule covers urgent-care, not acupuncture — Tier 1 doesn't
      // admit under strict FHIR rules, so the resolver falls through to
      // Tier 2.
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      groupsHere: [
        makeGroup('grp-std', 'Acupuncture Standard', ['loc-1']),
        makeGroup('grp-prem', 'Acupuncture Premium', ['loc-1']),
      ],
      prsHere: [
        // Single PR is a member of BOTH groups via location-overlap and
        // opts into the acupuncture category via healthcareService
        // back-ref — both groups admit.
        {
          pr: makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-acu'] }),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.id).sort()).toEqual(['grp-prem', 'grp-std']);
    expect(result.every((t) => t.tier === 1)).toBe(true);
    expect(result.map((t) => t.typeSuffix).sort()).toEqual(['Acupuncture Premium', 'Acupuncture Standard']);
  });

  test('two PRs at the same Location both offering a FHIR category → both surface as sub-options', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      groupsHere: [],
      prsHere: [
        {
          pr: makePr('pr-a', ['loc-1'], { practitionerId: 'prac-a', offersCategoryIds: ['cat-acu'] }),
          practitioner: makePractitioner('prac-a', 'Ada', 'Lovelace'),
          schedules: [makeSchedule('s-a', { type: 'PractitionerRole', id: 'pr-a' })],
        },
        {
          pr: makePr('pr-b', ['loc-1'], { practitionerId: 'prac-b', offersCategoryIds: ['cat-acu'] }),
          practitioner: makePractitioner('prac-b', 'Bob', 'Bain'),
          schedules: [makeSchedule('s-b', { type: 'PractitionerRole', id: 'pr-b' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(2);
    expect(result.every((t) => t.resourceType === 'PractitionerRole')).toBe(true);
    expect(result.map((t) => t.typeSuffix).sort()).toEqual(['Ada Lovelace', 'Bob Bain']);
  });
});

describe('resolveTargetsAtLocation — back-compat is BOOKING_CONFIG-only', () => {
  const loc = makeLocation('loc-1');

  test('BOOKING_CONFIG category: Location with own Schedule that has NO serviceCategory codings is admitted (legacy empty-supports-all)', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' })],
      groupsHere: [],
      prsHere: [],
    };

    // 'urgent-care' is a BOOKING_CONFIG code in the default config — the
    // empty-codings = supports-all back-compat applies. Customers with
    // pre-tagging Schedules keep working without a FHIR migration.
    const result = resolveTargetsAtLocation(inv, { serviceCategoryCode: 'urgent-care' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('Location');
  });

  test('FHIR category: Location with own Schedule that has NO serviceCategory codings is NOT admitted (strict opt-in)', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' })],
      groupsHere: [],
      prsHere: [],
    };

    // 'acupuncture' (and any non-BOOKING_CONFIG code) is treated as
    // FHIR-backed. Without explicit tagging on the Schedule and without a
    // qualifying Group/PR at this Location, the Location drops from the
    // picker — staff shouldn't pick a Location that doesn't actually
    // offer the FHIR-managed service.
    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toEqual([]);
  });

  test('FHIR category: foreign-system codings on the Schedule do NOT count as opt-in (strict membership)', () => {
    const inv = {
      location: loc,
      ownSchedules: [
        {
          resourceType: 'Schedule' as const,
          id: 's-loc',
          actor: [{ reference: 'Location/loc-1' }],
          serviceCategory: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/service-mode', code: 'in-person' }] },
          ],
        },
      ],
      groupsHere: [],
      prsHere: [],
    };

    // Mode marker isn't in SERVICE_CATEGORY_SYSTEM. For BOOKING_CONFIG
    // codes the back-compat rule would admit (zero SERVICE_CATEGORY_SYSTEM
    // codings = supports-all). For FHIR codes the rule is "explicit
    // member required" — the foreign coding can't substitute for an
    // explicit opt-in.
    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toEqual([]);
  });

  test('BOOKING_CONFIG category: foreign-system codings on the Schedule still count as "no service-category restriction"', () => {
    const inv = {
      location: loc,
      ownSchedules: [
        {
          resourceType: 'Schedule' as const,
          id: 's-loc',
          actor: [{ reference: 'Location/loc-1' }],
          serviceCategory: [
            { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/service-mode', code: 'in-person' }] },
          ],
        },
      ],
      groupsHere: [],
      prsHere: [],
    };

    // No SERVICE_CATEGORY_SYSTEM codings present (the mode marker is
    // foreign) → for BOOKING_CONFIG the back-compat empty-supports-all
    // rule kicks in and admits.
    const result = resolveTargetsAtLocation(inv, { serviceCategoryCode: 'urgent-care' });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('Location');
  });

  test('FHIR category without fhirId: Group and PR tiers are unreachable; only Tier 1 (explicit Schedule tag) can admit', () => {
    const inv = {
      location: loc,
      // Untagged Location-Schedule — under strict FHIR rule, does not admit.
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' })],
      groupsHere: [makeGroup('grp-1', 'Acupuncture Group', ['loc-1'])],
      prsHere: [
        {
          // PR back-refs the category — but the caller didn't pass the
          // fhirId, so practitionerRoleOffersCategory can't be called and
          // the Group/PR tiers don't admit. Documents the contract: AddPatient
          // MUST thread fhirId through for FHIR categories.
          pr: makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-acu'] }),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, { serviceCategoryCode: 'acupuncture' });
    expect(result).toEqual([]);
  });
});

describe('resolveTargetsAtLocation — Group membership rules (FHIR)', () => {
  const loc = makeLocation('loc-1');

  test('Group via role.healthcareService back-reference is recognized as a member even without location overlap (location overlap also present here)', () => {
    const inv = {
      location: loc,
      // Untagged Location-Schedule — under strict FHIR rule, doesn't admit
      // at Tier 1; resolver falls through to Tier 2.
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' })],
      groupsHere: [makeGroup('grp-1', 'Acupuncture', ['loc-1'])],
      prsHere: [
        {
          // PR has location at loc-1 AND back-refs the Group via healthcareService[]
          // AND opts into the acupuncture category.
          pr: {
            ...makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-acu'] }),
            healthcareService: [{ reference: 'HealthcareService/grp-1' }, { reference: 'HealthcareService/cat-acu' }],
          },
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('HealthcareService');
  });

  test('Group is dropped when its own type[] allow-list excludes the picked FHIR category (mirrors get-schedule CATEGORY_NOT_SUPPORTED_BY_GROUP)', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      // Group's members would qualify (PR opts into acupuncture), but the
      // Group's own type[] allow-list is scoped to a different category —
      // get-schedule would reject any slot request for acupuncture against
      // this Group with CATEGORY_NOT_SUPPORTED_BY_GROUP. Resolver must
      // match that gate so we don't admit a Group that can't actually
      // vend slots for the picked category. To pin Group-specific
      // rejection here, remove the PR so Tier 3 can't fall through and
      // rescue the Location — otherwise the test would pass by accident
      // via the PR tier.
      groupsHere: [makeGroup('grp-1', 'Massage', ['loc-1'], { typeCodes: ['massage'] })],
      prsHere: [],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toEqual([]);
  });

  test('Group blocked by its type[] allow-list DOES fall through to Tier 3 (PR-direct) when a qualifying PR is present at the Location', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      // Same as above (Group's type[] excludes acupuncture) but a PR at L
      // opts into acupuncture directly — the resolver's priority-tier
      // model rejects Tier 2 and continues to Tier 3, which admits. The
      // Location still surfaces, just as a PR-direct booking rather than a
      // through-the-Group booking.
      groupsHere: [makeGroup('grp-1', 'Massage', ['loc-1'], { typeCodes: ['massage'] })],
      prsHere: [
        {
          pr: makePr('pr-1', ['loc-1'], { practitionerId: 'prac-1', offersCategoryIds: ['cat-acu'] }),
          practitioner: makePractitioner('prac-1', 'Ada', 'Lovelace'),
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('PractitionerRole');
    expect(result[0].id).toBe('pr-1');
  });

  test('Group admits when its type[] allow-list includes the picked FHIR category AND a member PR opts in', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      // type[] populated and includes acupuncture → the get-schedule gate
      // admits, and the resolver matches.
      groupsHere: [makeGroup('grp-1', 'Acupuncture', ['loc-1'], { typeCodes: ['acupuncture', 'massage'] })],
      prsHere: [
        {
          pr: makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-acu'] }),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toHaveLength(1);
    expect(result[0].resourceType).toBe('HealthcareService');
  });

  test('Group is dropped when no PR at the Location opts into the picked FHIR category', () => {
    const inv = {
      location: loc,
      ownSchedules: [makeSchedule('s-loc', { type: 'Location', id: 'loc-1' }, ['urgent-care'])],
      groupsHere: [makeGroup('grp-1', 'Acupuncture', ['loc-1'])],
      prsHere: [
        {
          // PR offers a different FHIR category, not acupuncture.
          pr: makePr('pr-1', ['loc-1'], { offersCategoryIds: ['cat-massage'] }),
          practitioner: undefined,
          schedules: [makeSchedule('s-pr', { type: 'PractitionerRole', id: 'pr-1' })],
        },
      ],
    };

    const result = resolveTargetsAtLocation(inv, {
      serviceCategoryCode: 'acupuncture',
      serviceCategoryFhirId: 'cat-acu',
    });
    expect(result).toEqual([]);
  });
});
