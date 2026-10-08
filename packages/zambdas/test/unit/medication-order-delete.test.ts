import Oystehr from '@oystehr/sdk';
import { Claim, Encounter, MedicationAdministration, Procedure, ServiceRequest, Task } from 'fhir/r4b';
import { IMMUNIZATION_ORDER_TAG_CODE, IMMUNIZATION_ORDER_TAG_SYSTEM } from 'utils/lib/fhir/medication-administration';
import { CODE_SYSTEM_CPT } from 'utils/lib/helpers/rcm/constants';
import { VACCINE_ADMINISTRATION_CODES_EXTENSION_URL } from 'utils/lib/types/api/medication-administration.constants';
import { describe, expect, it, vi } from 'vitest';
import { CONTAINED_MEDICATION_ID } from '../../src/ehr/immunization/common';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import {
  hasEncounterBillingRecord,
  selectOrderCptLinesToDelete,
  selectPendingRecheckOrders,
  selectRetainedCptCodes,
} from '../../src/shared/medication-order-delete';

const cptLine = (id: string, code: string, orderId?: string): Procedure => ({
  resourceType: 'Procedure',
  id,
  status: 'completed',
  subject: { reference: 'Patient/p1' },
  code: { coding: [{ system: CODE_SYSTEM_CPT, code }] },
  ...(orderId && { partOf: [{ reference: `MedicationAdministration/${orderId}` }] }),
});

const vaccine = (
  id: string,
  status: MedicationAdministration['status'],
  cptCodes: string[]
): MedicationAdministration => ({
  resourceType: 'MedicationAdministration',
  id,
  status,
  subject: { reference: 'Patient/p1' },
  effectiveDateTime: '2026-10-08T10:00:00Z',
  meta: { tag: [{ system: IMMUNIZATION_ORDER_TAG_SYSTEM, code: IMMUNIZATION_ORDER_TAG_CODE }] },
  medicationReference: { reference: `#${CONTAINED_MEDICATION_ID}` },
  contained: [
    {
      resourceType: 'Medication',
      id: CONTAINED_MEDICATION_ID,
      extension: cptCodes.map((code) => ({
        url: VACCINE_ADMINISTRATION_CODES_EXTENSION_URL,
        valueCodeableConcept: { coding: [{ system: CODE_SYSTEM_CPT, code }] },
      })),
    },
  ],
});

const selectedIds = (lines: Procedure[]): (string | undefined)[] => lines.map((line) => line.id).sort();

describe('selectOrderCptLinesToDelete', () => {
  it('keeps one own line for each code an administered vaccine relies on and never selects a line the order did not write', () => {
    const ownLines = [
      cptLine('own-90471-a', '90471', 'deleted'),
      cptLine('own-90471-b', '90471', 'deleted'),
      cptLine('own-90686', '90686', 'deleted'),
      cptLine('own-90672', '90672', 'deleted'),
    ];

    const selected = selectOrderCptLinesToDelete({
      orderId: 'deleted',
      ownLines,
      visitLines: [
        ...ownLines,
        cptLine('administered-90715', '90715', 'administered'),
        cptLine('cancelled-90672', '90672', 'cancelled'),
      ],
      visitOrders: [
        vaccine('deleted', 'completed', ['90471', '90686', '90672']),
        vaccine('administered', 'completed', ['90471', '90715']),
        vaccine('partly-administered', 'on-hold', ['90686']),
        vaccine('cancelled', 'stopped', ['90672']),
      ],
    });

    expect(selectedIds(selected)).toEqual(['own-90471-b', 'own-90672']);
  });

  it('deletes own lines whose code only a vaccine that bills nothing relies on, or that another line keeps on the visit', () => {
    const ownLines = [
      cptLine('own-90471', '90471', 'deleted'),
      cptLine('own-90686', '90686', 'deleted'),
      cptLine('own-90715', '90715', 'deleted'),
      cptLine('own-90672', '90672', 'deleted'),
    ];

    const selected = selectOrderCptLinesToDelete({
      orderId: 'deleted',
      ownLines,
      visitLines: [...ownLines, cptLine('provider-90672', '90672')],
      visitOrders: [
        vaccine('pending', 'in-progress', ['90471']),
        vaccine('not-administered', 'not-done', ['90686']),
        vaccine('cancelled', 'stopped', ['90715']),
        vaccine('administered', 'completed', ['90672']),
      ],
    });

    expect(selectedIds(selected)).toEqual(['own-90471', 'own-90672', 'own-90686', 'own-90715']);
  });
});

describe('selectRetainedCptCodes', () => {
  it('reports order codes left on lines no order wrote, once each and sorted, only for an order that was administered', () => {
    const input = {
      orderCodes: ['90715', '90686', '90471'],
      visitLines: [
        cptLine('unlinked-90686', '90686'),
        cptLine('unlinked-90471-a', '90471'),
        cptLine('unlinked-90471-b', '90471'),
        cptLine('kept-90715', '90715', 'other'),
        cptLine('unlinked-99213', '99213'),
      ],
      deletedLines: [],
    };

    expect(selectRetainedCptCodes({ ...input, wasAdministered: true })).toEqual(['90471', '90686']);
    expect(selectRetainedCptCodes({ ...input, wasAdministered: false })).toEqual([]);
  });
});

describe('selectPendingRecheckOrders', () => {
  it('selects the recheck while its Task is requested and leaves it once the vitals were taken', () => {
    const recheck: ServiceRequest = {
      resourceType: 'ServiceRequest',
      id: 'recheck',
      status: 'active',
      intent: 'order',
      subject: { reference: 'Patient/p1' },
      supportingInfo: [{ reference: 'MedicationAdministration/deleted' }],
    };
    const selectWithTaskStatus = (status: Task['status']): (string | undefined)[] =>
      selectPendingRecheckOrders({
        orderId: 'deleted',
        serviceRequests: [recheck],
        tasks: [
          {
            resourceType: 'Task',
            id: 'recheck-task',
            status,
            intent: 'order',
            basedOn: [{ reference: 'ServiceRequest/recheck' }],
          },
        ],
      }).map(({ serviceRequest }) => serviceRequest.id);

    expect(selectWithTaskStatus('requested')).toEqual(['recheck']);
    expect(selectWithTaskStatus('completed')).toEqual([]);
  });
});

describe('hasEncounterBillingRecord', () => {
  const clinicalWith = (encounter: Encounter): Oystehr =>
    ({ fhir: { get: async () => encounter } }) as unknown as Oystehr;
  const billingWith = (search: () => Promise<{ unbundle: () => Claim[] }>): Oystehr =>
    ({ fhir: { search } }) as unknown as Oystehr;
  const encounter: Encounter = { resourceType: 'Encounter', id: 'e1', status: 'finished', class: { code: 'AMB' } };

  it('treats a Candid encounter id as billing evidence without searching for an Ottehr billing claim', async () => {
    const claimSearch = vi.fn();
    const billedEncounter: Encounter = {
      ...encounter,
      identifier: [{ system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: 'candid-1' }],
    };

    expect(await hasEncounterBillingRecord(clinicalWith(billedEncounter), billingWith(claimSearch), 'e1')).toBe(true);
    expect(claimSearch).not.toHaveBeenCalled();
  });

  it('treats an Ottehr billing claim for the encounter as billing evidence when no Candid encounter exists', async () => {
    const claimsFound = (claims: Claim[]) => async () => ({ unbundle: () => claims });
    const claim = { resourceType: 'Claim', id: 'c1' } as Claim;

    expect(await hasEncounterBillingRecord(clinicalWith(encounter), billingWith(claimsFound([claim])), 'e1')).toBe(
      true
    );
    expect(await hasEncounterBillingRecord(clinicalWith(encounter), billingWith(claimsFound([])), 'e1')).toBe(false);
  });
});
