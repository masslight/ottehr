import { Patient } from 'fhir/r4b';
import { BILLING_RESOURCE_TAG } from 'utils';
import { describe, expect, it } from 'vitest';
import { clinicalPatientIdentifier, SOURCE_IDENTIFIER_SYSTEM } from '../../../src/billing/shared';
import {
  identifierPatchOperations,
  planIdentifierStamps,
} from '../../../src/scripts/backfill-billing-patient-identifiers.helpers';

function billingPatient(options: {
  id: string;
  clinicalPatientId?: string;
  lastUpdated: string;
  keyed?: boolean;
}): Patient {
  return {
    resourceType: 'Patient',
    id: options.id,
    identifier:
      options.keyed && options.clinicalPatientId ? [clinicalPatientIdentifier(options.clinicalPatientId)] : undefined,
    extension: options.clinicalPatientId
      ? [
          {
            url: SOURCE_IDENTIFIER_SYSTEM,
            valueReference: {
              reference: `Patient/${options.clinicalPatientId}`,
            },
          },
        ]
      : undefined,
    meta: {
      tag: [BILLING_RESOURCE_TAG],
      lastUpdated: options.lastUpdated,
    },
  };
}

describe('backfill-billing-patient-identifiers', () => {
  describe('planIdentifierStamps', () => {
    it('lifts the source extension into an identifier', () => {
      const patient = billingPatient({
        id: 'billing-1',
        clinicalPatientId: 'clinical-1',
        lastUpdated: '2026-07-01T00:00:00Z',
      });

      const plan = planIdentifierStamps([patient]);

      expect(plan.toStamp.map((p) => p.id)).toEqual(['billing-1']);
      expect(plan.alreadyKeyed).toBe(0);
      expect(plan.duplicatesLeftUnmatched).toBe(0);
      expect(identifierPatchOperations(patient, 'clinical-1')).toEqual([
        {
          op: 'add',
          path: '/identifier',
          value: [clinicalPatientIdentifier('clinical-1')],
        },
      ]);
    });

    it('skips a billing patient with no clinical source', () => {
      const plan = planIdentifierStamps([billingPatient({ id: 'manual-1', lastUpdated: '2026-07-01T00:00:00Z' })]);

      expect(plan.toStamp).toHaveLength(0);
      expect(plan.noClinicalSource).toBe(1);
    });

    it('skips a patient that already carries the identifier so re-runs are quiet', () => {
      const plan = planIdentifierStamps([
        billingPatient({
          id: 'billing-1',
          clinicalPatientId: 'clinical-1',
          lastUpdated: '2026-07-01T00:00:00Z',
          keyed: true,
        }),
      ]);

      expect(plan.toStamp).toHaveLength(0);
      expect(plan.alreadyKeyed).toBe(1);
    });

    // Stamping every duplicate would make the lookup match several and leave which copy wins arbitrary.
    it('keys only the newest copy when a clinical patient has duplicates', () => {
      const plan = planIdentifierStamps([
        billingPatient({
          id: 'billing-old',
          clinicalPatientId: 'clinical-1',
          lastUpdated: '2026-07-01T00:00:00Z',
        }),
        billingPatient({
          id: 'billing-new',
          clinicalPatientId: 'clinical-1',
          lastUpdated: '2026-07-23T00:00:00Z',
        }),
      ]);

      expect(plan.toStamp.map((p) => p.id)).toEqual(['billing-new']);
      expect(plan.duplicatesLeftUnmatched).toBe(1);
    });

    it('skips a duplicate whose sibling already carries the identifier', () => {
      const plan = planIdentifierStamps([
        billingPatient({
          id: 'billing-old',
          clinicalPatientId: 'clinical-1',
          lastUpdated: '2026-07-01T00:00:00Z',
        }),
        billingPatient({
          id: 'billing-new',
          clinicalPatientId: 'clinical-1',
          lastUpdated: '2026-07-23T00:00:00Z',
          keyed: true,
        }),
      ]);

      expect(plan.toStamp).toHaveLength(0);
      expect(plan.alreadyKeyed).toBe(1);
      expect(plan.duplicatesLeftUnmatched).toBe(1);
    });
  });

  describe('identifierPatchOperations', () => {
    it('appends when the patient already has other identifiers', () => {
      const patient: Patient = {
        resourceType: 'Patient',
        id: 'billing-1',
        identifier: [
          {
            system: 'https://fhir.ottehr.com/some-other-system',
            value: 'other',
          },
        ],
      };

      expect(identifierPatchOperations(patient, 'clinical-1')).toEqual([
        {
          op: 'add',
          path: '/identifier/-',
          value: clinicalPatientIdentifier('clinical-1'),
        },
      ]);
    });
  });
});
