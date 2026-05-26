import { CodeableConcept, HealthcareService, PractitionerRole } from 'fhir/r4b';
import { describe, expect, it } from 'vitest';
import { ServiceMode, ServiceVisitType } from '../types';
import {
  GROUP_ALL_LOCATIONS_SYSTEM,
  GROUP_ASSIGNMENT_MODE_SYSTEM,
  SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM,
  SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM,
  SERVICE_CATEGORY_MODE_SYSTEM,
  SERVICE_CATEGORY_TAG,
  SERVICE_CATEGORY_VISIT_TYPE_SYSTEM,
} from './constants';
import {
  getGroupAllLocations,
  getGroupAssignmentMode,
  getServiceCategoryCadenceMinutes,
  getServiceCategoryDurationMinutes,
  getServiceCategoryModes,
  getServiceCategoryVisitTypes,
  GROUP_OWNED_CHARACTERISTIC_SYSTEMS,
  groupCharacteristics,
  isPractitionerRoleMemberOfGroup,
  isServiceCategoryHealthcareService,
  mergeOwnedCharacteristics,
  SERVICE_CATEGORY_OWNED_CHARACTERISTIC_SYSTEMS,
  serviceCategoryCharacteristics,
} from './healthcareService';

const makeHs = (overrides: Partial<HealthcareService> = {}): HealthcareService => ({
  resourceType: 'HealthcareService',
  ...overrides,
});

describe('isServiceCategoryHealthcareService', () => {
  it('returns true when the booking-service-category tag is present', () => {
    const hs = makeHs({ meta: { tag: [SERVICE_CATEGORY_TAG] } });
    expect(isServiceCategoryHealthcareService(hs)).toBe(true);
  });

  it('returns false when meta is missing entirely', () => {
    expect(isServiceCategoryHealthcareService(makeHs())).toBe(false);
  });

  it('returns false when tag has the right code but wrong system', () => {
    const hs = makeHs({
      meta: { tag: [{ system: 'http://example.com/other', code: SERVICE_CATEGORY_TAG.code }] },
    });
    expect(isServiceCategoryHealthcareService(hs)).toBe(false);
  });

  it('returns false when tag has the right system but wrong code', () => {
    const hs = makeHs({
      meta: { tag: [{ system: SERVICE_CATEGORY_TAG.system, code: 'something-else' }] },
    });
    expect(isServiceCategoryHealthcareService(hs)).toBe(false);
  });
});

describe('getServiceCategoryModes', () => {
  it('returns an empty array when no characteristics are present', () => {
    expect(getServiceCategoryModes(makeHs())).toEqual([]);
  });

  it('returns the single mode that is set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_MODE_SYSTEM, code: 'in-person' }] }],
    });
    expect(getServiceCategoryModes(hs)).toEqual([ServiceMode['in-person']]);
  });

  it('returns both modes when both are set', () => {
    const hs = makeHs({
      characteristic: [
        { coding: [{ system: SERVICE_CATEGORY_MODE_SYSTEM, code: 'in-person' }] },
        { coding: [{ system: SERVICE_CATEGORY_MODE_SYSTEM, code: 'virtual' }] },
      ],
    });
    expect(getServiceCategoryModes(hs).sort()).toEqual([ServiceMode['in-person'], ServiceMode.virtual].sort());
  });

  it('ignores codings under a different system', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: 'http://example.com/other', code: 'in-person' }] }],
    });
    expect(getServiceCategoryModes(hs)).toEqual([]);
  });

  it('ignores unknown codes under the right system', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_MODE_SYSTEM, code: 'telepathic' }] }],
    });
    expect(getServiceCategoryModes(hs)).toEqual([]);
  });
});

describe('getServiceCategoryVisitTypes', () => {
  it('returns prebook when only prebook is set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_VISIT_TYPE_SYSTEM, code: 'prebook' }] }],
    });
    expect(getServiceCategoryVisitTypes(hs)).toEqual([ServiceVisitType.prebook]);
  });

  it('returns walk-in when only walk-in is set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_VISIT_TYPE_SYSTEM, code: 'walk-in' }] }],
    });
    expect(getServiceCategoryVisitTypes(hs)).toEqual([ServiceVisitType['walk-in']]);
  });

  it('ignores unknown codes under the right system', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_VISIT_TYPE_SYSTEM, code: 'drive-thru' }] }],
    });
    expect(getServiceCategoryVisitTypes(hs)).toEqual([]);
  });
});

describe('getServiceCategoryDurationMinutes', () => {
  it('returns undefined when not present', () => {
    expect(getServiceCategoryDurationMinutes(makeHs())).toBeUndefined();
  });

  it('returns the parsed number when set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, code: '30' }] }],
    });
    expect(getServiceCategoryDurationMinutes(hs)).toBe(30);
  });

  it('returns undefined for non-numeric code', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, code: 'thirty' }] }],
    });
    expect(getServiceCategoryDurationMinutes(hs)).toBeUndefined();
  });

  it('returns undefined for zero', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, code: '0' }] }],
    });
    expect(getServiceCategoryDurationMinutes(hs)).toBeUndefined();
  });

  it('returns undefined for a negative number', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, code: '-15' }] }],
    });
    expect(getServiceCategoryDurationMinutes(hs)).toBeUndefined();
  });
});

describe('getServiceCategoryCadenceMinutes', () => {
  it('reads from the cadence system, not the duration system', () => {
    const hs = makeHs({
      characteristic: [
        { coding: [{ system: SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM, code: '45' }] },
        { coding: [{ system: SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM, code: '15' }] },
      ],
    });
    expect(getServiceCategoryCadenceMinutes(hs)).toBe(15);
    expect(getServiceCategoryDurationMinutes(hs)).toBe(45);
  });
});

describe('getGroupAssignmentMode', () => {
  it('returns anonymous when set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: GROUP_ASSIGNMENT_MODE_SYSTEM, code: 'anonymous' }] }],
    });
    expect(getGroupAssignmentMode(hs)).toBe('anonymous');
  });

  it('returns provider when set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: GROUP_ASSIGNMENT_MODE_SYSTEM, code: 'provider' }] }],
    });
    expect(getGroupAssignmentMode(hs)).toBe('provider');
  });

  it('returns undefined when not set', () => {
    expect(getGroupAssignmentMode(makeHs())).toBeUndefined();
  });

  it('returns undefined for an unrecognized code under the right system', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: GROUP_ASSIGNMENT_MODE_SYSTEM, code: 'hybrid' }] }],
    });
    expect(getGroupAssignmentMode(hs)).toBeUndefined();
  });
});

describe('getGroupAllLocations', () => {
  it('returns true when "true" is set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: GROUP_ALL_LOCATIONS_SYSTEM, code: 'true' }] }],
    });
    expect(getGroupAllLocations(hs)).toBe(true);
  });

  it('returns false when "false" is set', () => {
    const hs = makeHs({
      characteristic: [{ coding: [{ system: GROUP_ALL_LOCATIONS_SYSTEM, code: 'false' }] }],
    });
    expect(getGroupAllLocations(hs)).toBe(false);
  });

  it('returns undefined when not set — caller treats as false', () => {
    expect(getGroupAllLocations(makeHs())).toBeUndefined();
  });
});

describe('serviceCategoryCharacteristics', () => {
  it('round-trips a full input through the readers', () => {
    const ccs = serviceCategoryCharacteristics({
      modes: [ServiceMode['in-person'], ServiceMode.virtual],
      visitTypes: [ServiceVisitType.prebook, ServiceVisitType['walk-in']],
      durationMinutes: 30,
      cadenceMinutes: 15,
    });
    const hs = makeHs({ characteristic: ccs });
    expect(getServiceCategoryModes(hs).sort()).toEqual([ServiceMode['in-person'], ServiceMode.virtual].sort());
    expect(getServiceCategoryVisitTypes(hs).sort()).toEqual(
      [ServiceVisitType.prebook, ServiceVisitType['walk-in']].sort()
    );
    expect(getServiceCategoryDurationMinutes(hs)).toBe(30);
    expect(getServiceCategoryCadenceMinutes(hs)).toBe(15);
  });

  it('omits the duration characteristic when durationMinutes is undefined', () => {
    const ccs = serviceCategoryCharacteristics({ modes: [], visitTypes: [], cadenceMinutes: 10 });
    const hasDuration = ccs.some((cc) => cc.coding?.some((c) => c.system === SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM));
    expect(hasDuration).toBe(false);
  });

  it('omits the cadence characteristic when cadenceMinutes is undefined', () => {
    const ccs = serviceCategoryCharacteristics({ modes: [], visitTypes: [], durationMinutes: 10 });
    const hasCadence = ccs.some((cc) => cc.coding?.some((c) => c.system === SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM));
    expect(hasCadence).toBe(false);
  });

  it('emits no characteristics when modes and visitTypes are empty and no minutes are provided', () => {
    expect(serviceCategoryCharacteristics({ modes: [], visitTypes: [] })).toEqual([]);
  });

  it('strips non-FHIR fields (no fullParam) from output codings', () => {
    const ccs = serviceCategoryCharacteristics({
      modes: [ServiceMode['in-person']],
      visitTypes: [ServiceVisitType.prebook],
    });
    for (const cc of ccs) {
      for (const coding of cc.coding ?? []) {
        expect((coding as Record<string, unknown>).fullParam).toBeUndefined();
      }
    }
  });
});

describe('groupCharacteristics', () => {
  it('round-trips anonymous + allLocations=false', () => {
    const ccs = groupCharacteristics({ assignmentMode: 'anonymous', allLocations: false });
    const hs = makeHs({ characteristic: ccs });
    expect(getGroupAssignmentMode(hs)).toBe('anonymous');
    expect(getGroupAllLocations(hs)).toBe(false);
  });

  it('round-trips anonymous + allLocations=true', () => {
    const ccs = groupCharacteristics({ assignmentMode: 'anonymous', allLocations: true });
    const hs = makeHs({ characteristic: ccs });
    expect(getGroupAssignmentMode(hs)).toBe('anonymous');
    expect(getGroupAllLocations(hs)).toBe(true);
  });

  it('round-trips provider + allLocations=false', () => {
    const ccs = groupCharacteristics({ assignmentMode: 'provider', allLocations: false });
    const hs = makeHs({ characteristic: ccs });
    expect(getGroupAssignmentMode(hs)).toBe('provider');
    expect(getGroupAllLocations(hs)).toBe(false);
  });

  it('round-trips provider + allLocations=true', () => {
    const ccs = groupCharacteristics({ assignmentMode: 'provider', allLocations: true });
    const hs = makeHs({ characteristic: ccs });
    expect(getGroupAssignmentMode(hs)).toBe('provider');
    expect(getGroupAllLocations(hs)).toBe(true);
  });

  it('strips non-FHIR fields (no fullParam) from output codings', () => {
    const ccs = groupCharacteristics({ assignmentMode: 'provider', allLocations: true });
    for (const cc of ccs) {
      for (const coding of cc.coding ?? []) {
        expect((coding as Record<string, unknown>).fullParam).toBeUndefined();
      }
    }
  });
});

describe('mergeOwnedCharacteristics', () => {
  const FOREIGN_SYSTEM = 'http://example.com/some-foreign-flag';
  const foreignCc: CodeableConcept = { coding: [{ system: FOREIGN_SYSTEM, code: 'preserved' }] };

  it('returns the new owned set when existing is undefined', () => {
    const newOwned = groupCharacteristics({ assignmentMode: 'anonymous', allLocations: false });
    const result = mergeOwnedCharacteristics(undefined, GROUP_OWNED_CHARACTERISTIC_SYSTEMS, newOwned);
    expect(result).toEqual(newOwned);
  });

  it('preserves foreign characteristics and replaces owned ones', () => {
    const oldOwned = groupCharacteristics({ assignmentMode: 'anonymous', allLocations: false });
    const existing: CodeableConcept[] = [...oldOwned, foreignCc];
    const newOwned = groupCharacteristics({ assignmentMode: 'provider', allLocations: true });

    const result = mergeOwnedCharacteristics(existing, GROUP_OWNED_CHARACTERISTIC_SYSTEMS, newOwned);

    expect(result).toContainEqual(foreignCc);
    const hs = makeHs({ characteristic: result });
    expect(getGroupAssignmentMode(hs)).toBe('provider');
    expect(getGroupAllLocations(hs)).toBe(true);
  });

  it('does not strip a characteristic when none of its codings reference an owned system', () => {
    const result = mergeOwnedCharacteristics([foreignCc], GROUP_OWNED_CHARACTERISTIC_SYSTEMS, []);
    expect(result).toEqual([foreignCc]);
  });

  it('strips a characteristic if ANY of its codings reference an owned system', () => {
    const mixed: CodeableConcept = {
      coding: [
        { system: FOREIGN_SYSTEM, code: 'foreign' },
        { system: GROUP_ASSIGNMENT_MODE_SYSTEM, code: 'anonymous' },
      ],
    };
    const result = mergeOwnedCharacteristics([mixed], GROUP_OWNED_CHARACTERISTIC_SYSTEMS, []);
    expect(result).toEqual([]);
  });
});

describe('isPractitionerRoleMemberOfGroup', () => {
  const GROUP_ID = 'grp-1';
  const LOC_A = 'loc-a';
  const LOC_B = 'loc-b';

  const makeGroup = (overrides: Partial<HealthcareService> = {}): HealthcareService => ({
    resourceType: 'HealthcareService',
    id: GROUP_ID,
    ...overrides,
  });

  const makeRole = (overrides: Partial<PractitionerRole> = {}): PractitionerRole => ({
    resourceType: 'PractitionerRole',
    ...overrides,
  });

  it('returns true when the role back-references the group via .healthcareService', () => {
    const role = makeRole({ healthcareService: [{ reference: `HealthcareService/${GROUP_ID}` }] });
    const group = makeGroup();
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(true);
  });

  it('returns false when the role back-references a different HealthcareService', () => {
    const role = makeRole({ healthcareService: [{ reference: 'HealthcareService/other' }] });
    const group = makeGroup();
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(false);
  });

  it('returns true when the role.location[] overlaps with the group.location[]', () => {
    const role = makeRole({ location: [{ reference: `Location/${LOC_A}` }] });
    const group = makeGroup({ location: [{ reference: `Location/${LOC_A}` }] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(true);
  });

  it('returns false when role.location[] and group.location[] do not overlap', () => {
    const role = makeRole({ location: [{ reference: `Location/${LOC_A}` }] });
    const group = makeGroup({ location: [{ reference: `Location/${LOC_B}` }] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(false);
  });

  it('returns true when allLocationsFlag is true and the role is active', () => {
    const role = makeRole({ active: true });
    const group = makeGroup();
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: true })).toBe(true);
  });

  it('treats active=undefined as active for the all-locations source', () => {
    const role = makeRole();
    const group = makeGroup();
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: true })).toBe(true);
  });

  it('excludes inactive roles from the all-locations source', () => {
    const role = makeRole({ active: false });
    const group = makeGroup();
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: true })).toBe(false);
  });

  it('still includes an inactive role that back-references the group (other sources do not gate on active)', () => {
    const role = makeRole({
      active: false,
      healthcareService: [{ reference: `HealthcareService/${GROUP_ID}` }],
    });
    const group = makeGroup();
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(true);
  });

  it('returns false when the role has no membership signal at all', () => {
    const role = makeRole({ location: [{ reference: `Location/${LOC_B}` }] });
    const group = makeGroup({ location: [{ reference: `Location/${LOC_A}` }] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(false);
  });

  it('returns true when sources A and B both fire (predicate is idempotent — caller-side dedup is by Schedule)', () => {
    const role = makeRole({
      healthcareService: [{ reference: `HealthcareService/${GROUP_ID}` }],
      location: [{ reference: `Location/${LOC_A}` }],
    });
    const group = makeGroup({ location: [{ reference: `Location/${LOC_A}` }] });
    // Predicate just returns true; the contract is that calling it repeatedly
    // for the same (role, group) does not produce duplicate entries in the
    // caller's output — caller iterates Schedules, not membership sources.
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(true);
  });

  it('returns true when sources A, B, and C all fire simultaneously', () => {
    const role = makeRole({
      active: true,
      healthcareService: [{ reference: `HealthcareService/${GROUP_ID}` }],
      location: [{ reference: `Location/${LOC_A}` }],
    });
    const group = makeGroup({ location: [{ reference: `Location/${LOC_A}` }] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: true })).toBe(true);
  });

  it('falls through to source B/C when the back-reference is to a different group', () => {
    const role = makeRole({
      healthcareService: [{ reference: 'HealthcareService/other' }],
      location: [{ reference: `Location/${LOC_A}` }],
    });
    const group = makeGroup({ location: [{ reference: `Location/${LOC_A}` }] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(true);
  });

  it('handles a group with empty location[] — only sources A and C can fire', () => {
    const role = makeRole({ location: [{ reference: `Location/${LOC_A}` }] });
    const group = makeGroup({ location: [] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(false);
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: true })).toBe(true);
  });

  it('ignores group.location[] entries with no reference string', () => {
    const role = makeRole({ location: [{ reference: `Location/${LOC_A}` }] });
    const group = makeGroup({ location: [{ display: 'a display-only ref' }] });
    expect(isPractitionerRoleMemberOfGroup({ role, group, allLocationsFlag: false })).toBe(false);
  });
});

describe('owned-characteristic system lists', () => {
  it('GROUP_OWNED_CHARACTERISTIC_SYSTEMS lists exactly the assignment-mode and all-locations systems', () => {
    expect([...GROUP_OWNED_CHARACTERISTIC_SYSTEMS].sort()).toEqual(
      [GROUP_ASSIGNMENT_MODE_SYSTEM, GROUP_ALL_LOCATIONS_SYSTEM].sort()
    );
  });

  it('SERVICE_CATEGORY_OWNED_CHARACTERISTIC_SYSTEMS lists exactly the four service-category dimension systems', () => {
    expect([...SERVICE_CATEGORY_OWNED_CHARACTERISTIC_SYSTEMS].sort()).toEqual(
      [
        SERVICE_CATEGORY_MODE_SYSTEM,
        SERVICE_CATEGORY_VISIT_TYPE_SYSTEM,
        SERVICE_CATEGORY_DURATION_MINUTES_SYSTEM,
        SERVICE_CATEGORY_CADENCE_MINUTES_SYSTEM,
      ].sort()
    );
  });
});
