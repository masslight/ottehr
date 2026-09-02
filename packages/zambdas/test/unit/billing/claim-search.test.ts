import { Claim, ClaimResponse, Coverage, Location, Organization, Patient, Practitioner, Resource } from 'fhir/r4b';
import { ottehrIdentifierSystem } from 'utils/lib/fhir/systemUrls';
import { CLAIM_TAG_SYSTEM } from 'utils/lib/types/data/billing/billing.constants';
import { AR_STAGE, CLAIM_STATUS_TAG_SYSTEMS } from 'utils/lib/types/data/billing/claim-status';
import { describe, expect, it } from 'vitest';
import {
  CLAIM_LIST_ELEMENTS,
  claimMatchesServiceDateRange,
  getClaimServiceDate,
  mapClaimToItem,
} from '../../../src/billing/claim-search';

type Lookups = Parameters<typeof mapClaimToItem>[1];

const makeClaim = (id: string, billed: number): Claim =>
  ({
    resourceType: 'Claim',
    id,
    status: 'active',
    created: '2026-07-01',
    type: {
      coding: [],
    },
    insurance: [],
    total: {
      value: billed,
      currency: 'USD',
    },
    meta: {
      tag: [],
    },
  }) as unknown as Claim;

const makeServiceDatedClaim = (created: string, servicedStart?: string): Claim =>
  ({
    resourceType: 'Claim',
    created,
    item: servicedStart
      ? [
          {
            servicedPeriod: {
              start: servicedStart,
            },
          },
        ]
      : undefined,
  }) as unknown as Claim;

const makeLookups = (
  patientPaidByClaimId: Map<string, number>,
  claimResponsesByClaimId: Map<string, ClaimResponse[]> = new Map(),
  providers: Lookups['providers'] = []
): Lookups => ({
  patients: [],
  payersByRef: new Map(),
  locations: [],
  providers,
  coverages: [],
  claimResponsesByClaimId,
  patientPaidByClaimId,
});

describe('mapClaimToItem: patient payments', () => {
  it('reports the linked patient payment total and nets it from the balance', () => {
    const item = mapClaimToItem(makeClaim('claim-1', 100), makeLookups(new Map([['claim-1', 30]])));
    expect(item.patientPaid).toBe(30);
    expect(item.claimBalance).toBe(70);
  });

  it('defaults patient paid to zero when the claim has no linked payments', () => {
    const item = mapClaimToItem(makeClaim('claim-2', 100), makeLookups(new Map()));
    expect(item.patientPaid).toBe(0);
    expect(item.claimBalance).toBe(100);
  });
});

describe('mapClaimToItem: adjudicated flag', () => {
  const claimResponse = {
    resourceType: 'ClaimResponse',
    id: 'cr-1',
    status: 'active',
    request: {
      reference: 'Claim/claim-1',
    },
  } as unknown as ClaimResponse;

  it('marks a claim with no remittance as un-adjudicated, so the list can flag its balance', () => {
    const item = mapClaimToItem(makeClaim('claim-1', 100), makeLookups(new Map()));
    expect(item.adjudicated).toBe(false);
  });

  it('marks a claim with a remittance as adjudicated', () => {
    const item = mapClaimToItem(
      makeClaim('claim-1', 100),
      makeLookups(new Map(), new Map([['claim-1', [claimResponse]]]))
    );
    expect(item.adjudicated).toBe(true);
  });
});

describe('mapClaimToItem: rendering provider', () => {
  const withRenderingProvider = (reference: string): Claim =>
    ({
      ...makeClaim('claim-1', 100),
      careTeam: [
        {
          sequence: 1,
          provider: {
            reference,
          },
        },
      ],
    }) as unknown as Claim;

  it('names a Practitioner rendering provider', () => {
    const practitioner = {
      resourceType: 'Practitioner',
      id: '1',
      name: [
        {
          family: 'Black',
          given: ['Oliver'],
        },
      ],
    } as unknown as Lookups['providers'][number];

    const item = mapClaimToItem(
      withRenderingProvider('Practitioner/1'),
      makeLookups(new Map(), new Map(), [practitioner])
    );
    expect(item.renderingProvider).toBe('Black, Oliver');
  });

  it('names an Organization rendering provider', () => {
    const organization = {
      resourceType: 'Organization',
      id: 'org-1',
      name: 'Riverside Group',
    } as unknown as Lookups['providers'][number];

    const item = mapClaimToItem(
      withRenderingProvider('Organization/org-1'),
      makeLookups(new Map(), new Map(), [organization])
    );
    expect(item.renderingProvider).toBe('Riverside Group');
  });

  it('leaves the column blank when the claim has no care team', () => {
    const item = mapClaimToItem(makeClaim('claim-1', 100), makeLookups(new Map()));
    expect(item.renderingProvider).toBe('');
  });
});

describe('CLAIM_LIST_ELEMENTS', () => {
  const keptFieldsFor = (resourceType: string): string[] =>
    CLAIM_LIST_ELEMENTS.split(',')
      .filter((element) => element.startsWith(`${resourceType}.`))
      .map((element) => element.slice(resourceType.length + 1));

  const narrow = <T extends Resource>(resource: T): T => {
    const kept = keptFieldsFor(resource.resourceType);
    return Object.fromEntries(
      Object.entries(resource).filter(([field]) => field === 'resourceType' || kept.includes(field))
    ) as T;
  };

  const ENCOUNTER_ID_SYSTEM = ottehrIdentifierSystem('claim-encounter-id');

  const fullClaim = {
    resourceType: 'Claim',
    id: 'claim-1',
    status: 'active',
    created: '2026-07-21',
    type: {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/claim-type',
          code: 'professional',
        },
      ],
    },
    identifier: [
      {
        system: ENCOUNTER_ID_SYSTEM,
        value: 'encounter-1',
      },
    ],
    total: {
      value: 250,
      currency: 'USD',
    },
    patient: {
      reference: 'Patient/patient-1',
    },
    insurer: {
      reference: 'Organization/payer-1',
    },
    facility: {
      reference: 'Location/location-1',
    },
    provider: {
      reference: 'Organization/billing-1',
    },
    careTeam: [
      {
        sequence: 1,
        provider: {
          reference: 'Practitioner/practitioner-1',
        },
      },
    ],
    insurance: [
      {
        sequence: 1,
        focal: true,
        coverage: {
          reference: 'Coverage/coverage-1',
        },
      },
    ],
    item: [
      {
        sequence: 1,
        servicedPeriod: {
          start: '2026-07-19',
        },
      },
    ],
    meta: {
      tag: [
        {
          system: CLAIM_STATUS_TAG_SYSTEMS.arStage,
          code: AR_STAGE.insurancePayer,
        },
        {
          system: CLAIM_TAG_SYSTEM,
          code: 'needs-review',
        },
      ],
    },
    diagnosis: [
      {
        sequence: 1,
        diagnosisCodeableConcept: {
          coding: [
            {
              code: 'J06.9',
            },
          ],
        },
      },
    ],
    supportingInfo: [
      {
        sequence: 1,
        category: {
          text: 'attachment',
        },
      },
    ],
  } as unknown as Claim;

  const patient = {
    resourceType: 'Patient',
    id: 'patient-1',
    name: [
      {
        family: 'Smith',
        given: ['John'],
      },
    ],
    birthDate: '1990-01-01',
    address: [
      {
        city: 'Boston',
      },
    ],
  } as unknown as Patient;

  const location = {
    resourceType: 'Location',
    id: 'location-1',
    name: 'Riverside Clinic',
    telecom: [
      {
        system: 'phone',
        value: '5551234567',
      },
    ],
  } as unknown as Location;

  const practitioner = {
    resourceType: 'Practitioner',
    id: 'practitioner-1',
    name: [
      {
        family: 'Black',
        given: ['Oliver'],
      },
    ],
    qualification: [
      {
        code: {
          text: 'MD',
        },
      },
    ],
  } as unknown as Practitioner;

  const lookupsFor = (claimPatient: Patient, claimLocation: Location, claimPractitioner: Practitioner): Lookups => ({
    patients: [claimPatient],
    payersByRef: new Map([
      [
        'Organization/payer-1',
        {
          resourceType: 'Organization',
          id: 'payer-1',
          name: 'Acme Health',
        } as unknown as Organization,
      ],
    ]),
    locations: [claimLocation],
    providers: [claimPractitioner],
    coverages: [
      {
        resourceType: 'Coverage',
        id: 'coverage-1',
        subscriberId: 'MEM-1',
      } as unknown as Coverage,
    ],
    claimResponsesByClaimId: new Map(),
    patientPaidByClaimId: new Map([['claim-1', 25]]),
  });

  it('keeps every field the row mapping reads', () => {
    const fromFull = mapClaimToItem(fullClaim, lookupsFor(patient, location, practitioner));
    const fromNarrowed = mapClaimToItem(
      narrow(fullClaim),
      lookupsFor(narrow(patient), narrow(location), narrow(practitioner))
    );
    expect(fromNarrowed).toEqual(fromFull);
    // Guard against a list so narrow that everything collapses to defaults and the rows still match.
    expect(fromFull.serviceDate).toBe('2026-07-19');
    expect(fromFull.memberId).toBe('MEM-1');
    expect(fromFull.rulesEngine).toBe('claim-submission');
  });

  // fetchPatientPaidByClaimId reads this outside mapClaimToItem, so the test above cannot catch it:
  // without the identifier every row silently reports a patient paid of zero.
  it('keeps the encounter identifier the patient payment lookup joins on', () => {
    expect(narrow(fullClaim).identifier?.find((id) => id.system === ENCOUNTER_ID_SYSTEM)?.value).toBe('encounter-1');
  });

  it('drops the fields the list never reads', () => {
    const narrowed = narrow(fullClaim);
    expect(narrowed.diagnosis).toBeUndefined();
    expect(narrowed.supportingInfo).toBeUndefined();
  });

  it('narrows every resource type the list includes, so none is returned whole', () => {
    ['Claim', 'Patient', 'Location', 'Practitioner', 'Organization'].forEach((resourceType) =>
      expect(keptFieldsFor(resourceType).length).toBeGreaterThan(0)
    );
  });
});

describe('claim search service date', () => {
  it('derives the service date from the first service line, not the creation date', () => {
    expect(getClaimServiceDate(makeServiceDatedClaim('2026-07-21', '2026-07-19'))).toBe('2026-07-19');
  });

  it('falls back to created only when the claim has no service line', () => {
    expect(getClaimServiceDate(makeServiceDatedClaim('2026-07-21'))).toBe('2026-07-21');
  });

  it('windows on the service date, not the creation date', () => {
    const claim = makeServiceDatedClaim('2026-07-21', '2026-07-19');
    expect(claimMatchesServiceDateRange(claim, '2026-07-21', '2026-07-21')).toBe(false);
    expect(claimMatchesServiceDateRange(claim, '2026-07-19', '2026-07-19')).toBe(true);
  });

  it('matches inside an inclusive range and excludes outside it, with open-ended bounds', () => {
    const claim = makeServiceDatedClaim('2026-07-25', '2026-07-20');
    expect(claimMatchesServiceDateRange(claim, '2026-07-19', '2026-07-21')).toBe(true);
    expect(claimMatchesServiceDateRange(claim, '2026-07-21', '2026-07-31')).toBe(false);
    expect(claimMatchesServiceDateRange(claim, undefined, '2026-07-20')).toBe(true);
    expect(claimMatchesServiceDateRange(claim, '2026-07-20', undefined)).toBe(true);
  });

  it('includes same-day claims when bounds are passed as ISO datetimes', () => {
    const claim = makeServiceDatedClaim('2026-07-21', '2026-07-19');
    expect(claimMatchesServiceDateRange(claim, '2026-07-19T00:00:00Z', '2026-07-19T23:59:59Z')).toBe(true);
  });
});
