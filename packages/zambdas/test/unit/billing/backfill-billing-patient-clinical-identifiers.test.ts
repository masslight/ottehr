import Oystehr from '@oystehr/sdk';
import { Patient } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  BILLING_WORKING_COPY_TAG,
  clinicalFriendlyIdIdentifier,
  clinicalPatientIdentifier,
  SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
  SOURCE_IDENTIFIER_SYSTEM,
} from '../../../src/billing/shared';
import {
  backfillBillingPatientClinicalIdentifiers,
  syncClinicalPatientIdentifiers,
} from '../../../src/scripts/backfill-billing-patient-clinical-identifiers.helpers';

function billingPatient(patient: Partial<Patient> & Pick<Patient, 'id'>): Patient {
  return {
    resourceType: 'Patient',
    meta: {
      versionId: '1',
    },
    ...patient,
  };
}

// A claim working copy's source-resource extension points at its billing main Patient, not at the
// clinical Patient, so its clinical ids resolve one hop up the chain.
function workingCopyOf(patient: Partial<Patient> & Pick<Patient, 'id'>): Patient {
  return {
    ...billingPatient(patient),
    meta: {
      versionId: '1',
      tag: [BILLING_WORKING_COPY_TAG],
    },
  };
}

function copyOf(clinicalPatientId: string, friendlyId?: string): Patient['extension'] {
  return [
    {
      url: SOURCE_IDENTIFIER_SYSTEM,
      valueReference: {
        reference: `Patient/${clinicalPatientId}`,
      },
    },
    ...(friendlyId
      ? [
          {
            url: SOURCE_FRIENDLY_PATIENT_ID_EXTENSION,
            valueString: friendlyId,
          },
        ]
      : []),
  ];
}

function mockOystehr(patients: Patient[]): {
  oystehr: Oystehr;
  search: ReturnType<typeof vi.fn>;
  patch: ReturnType<typeof vi.fn>;
} {
  const search = vi.fn().mockResolvedValue({
    total: patients.length,
    entry: patients.map((patient) => ({
      resource: patient,
      search: {
        mode: 'match',
      },
    })),
    unbundle: () => patients,
  });
  const patch = vi.fn().mockResolvedValue(undefined);
  return {
    oystehr: {
      fhir: {
        search,
        patch,
      },
    } as unknown as Oystehr,
    search,
    patch,
  };
}

function runOptions(
  oystehr: Oystehr,
  overrides?: { dryRun?: boolean; pruneStale?: boolean }
): { oystehr: Oystehr; dryRun: boolean; pruneStale: boolean } {
  return {
    oystehr,
    dryRun: false,
    pruneStale: false,
    ...overrides,
  };
}

describe('backfillBillingPatientClinicalIdentifiers', () => {
  it('adds both clinical identifiers to a copy that only has the extensions', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1', '1015'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats).toEqual({
      examined: 1,
      changed: 1,
      patientsGainingIdentifiers: 1,
      patientsDroppingStaleIdentifiers: 0,
      alreadyIndexed: 0,
      skipped: 0,
      failed: 0,
    });
    expect(patch).toHaveBeenCalledWith(
      {
        resourceType: 'Patient',
        id: 'billing-1',
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
          },
        ],
      },
      {
        optimisticLockingVersionId: '1',
      }
    );
  });

  it('appends only the identifier a partially indexed copy is missing', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1')],
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats.patientsGainingIdentifiers).toBe(1);
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/identifier/-',
            value: clinicalFriendlyIdIdentifier('1015'),
          },
        ],
      }),
      expect.anything()
    );
  });

  it('scans working copies alongside main billing patients', async () => {
    const { oystehr, search } = mockOystehr([]);

    await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(search).toHaveBeenCalledWith({
      resourceType: 'Patient',
      params: [
        {
          name: '_count',
          value: '200',
        },
        {
          name: '_total',
          value: 'accurate',
        },
        {
          name: '_offset',
          value: '0',
        },
      ],
    });
  });

  it('indexes a working copy against the clinical ids of the main patient it was copied from', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats).toEqual({
      examined: 2,
      changed: 1,
      patientsGainingIdentifiers: 1,
      patientsDroppingStaleIdentifiers: 0,
      alreadyIndexed: 1,
      skipped: 0,
      failed: 0,
    });
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'billing-copy',
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
          },
        ],
      }),
      expect.anything()
    );
  });

  it('leaves a working copy that already carries the clinical ids alone', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats.alreadyIndexed).toBe(2);
    expect(patch).not.toHaveBeenCalled();
  });

  it('indexes a working copy of a working copy against the clinical ids of the main patient', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy-of-copy',
        extension: copyOf('billing-copy'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats).toEqual({
      examined: 3,
      changed: 1,
      patientsGainingIdentifiers: 1,
      patientsDroppingStaleIdentifiers: 0,
      alreadyIndexed: 2,
      skipped: 0,
      failed: 0,
    });
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'billing-copy-of-copy',
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
          },
        ],
      }),
      expect.anything()
    );
  });

  // Resolving only one hop up made the intermediate copy's own id look like the clinical id, so
  // pruning would have dropped the correct identifier and indexed a billing id in its place.
  it('leaves the clinical ids on a working copy of a working copy alone when pruning', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy-of-copy',
        extension: copyOf('billing-copy'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(
      runOptions(oystehr, {
        pruneStale: true,
      })
    );

    expect(stats.alreadyIndexed).toBe(3);
    expect(stats.patientsDroppingStaleIdentifiers).toBe(0);
    expect(patch).not.toHaveBeenCalled();
  });

  it('skips a working copy whose main patient has no clinical source', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-manual',
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-manual'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats.skipped).toBe(2);
    expect(patch).not.toHaveBeenCalled();
  });

  it('leaves already indexed copies and manually created patients alone', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-indexed',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      billingPatient({
        id: 'billing-manual',
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats).toEqual({
      examined: 2,
      changed: 0,
      patientsGainingIdentifiers: 0,
      patientsDroppingStaleIdentifiers: 0,
      alreadyIndexed: 1,
      skipped: 1,
      failed: 0,
    });
    expect(patch).not.toHaveBeenCalled();
  });

  // changed / alreadyIndexed / skipped / failed partition examined; patientsGainingIdentifiers and
  // patientsDroppingStaleIdentifiers break down changed and overlap on a Patient that both gains and prunes.
  it('partitions every examined patient into exactly one outcome', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-gains',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('stale-clinical')],
      }),
      billingPatient({
        id: 'billing-indexed',
        extension: copyOf('clinical-2'),
        identifier: [clinicalPatientIdentifier('clinical-2')],
      }),
      billingPatient({
        id: 'billing-manual',
      }),
      billingPatient({
        id: 'billing-fails',
        extension: copyOf('clinical-3'),
      }),
    ]);
    patch.mockImplementation(({ id }: { id: string }) =>
      id === 'billing-fails' ? Promise.reject(new Error('boom')) : Promise.resolve(undefined)
    );

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr, { pruneStale: true }));

    expect(stats).toEqual({
      examined: 4,
      changed: 1,
      patientsGainingIdentifiers: 1,
      patientsDroppingStaleIdentifiers: 1,
      alreadyIndexed: 1,
      skipped: 1,
      failed: 1,
    });
    expect(stats.changed + stats.alreadyIndexed + stats.skipped + stats.failed).toBe(stats.examined);
    expect(stats.patientsGainingIdentifiers + stats.patientsDroppingStaleIdentifiers).toBeGreaterThan(stats.changed);
  });

  it('reports what it would patch without writing during a dry run', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1'),
      }),
    ]);

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr, { dryRun: true }));

    expect(stats.patientsGainingIdentifiers).toBe(1);
    expect(patch).not.toHaveBeenCalled();
  });

  it('counts a failed patch and keeps going', async () => {
    const { oystehr, patch } = mockOystehr([
      billingPatient({
        id: 'billing-1',
        extension: copyOf('clinical-1'),
      }),
      billingPatient({
        id: 'billing-2',
        extension: copyOf('clinical-2'),
      }),
    ]);
    patch.mockRejectedValueOnce(new Error('boom'));

    const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

    expect(stats.patientsGainingIdentifiers).toBe(1);
    expect(stats.failed).toBe(1);
    expect(patch).toHaveBeenCalledTimes(2);
  });

  // The source-resource extension points at the billing main patient by design, but the identifier
  // of the same system indexes the clinical patient, which is what claim search queries. Earlier
  // runs of this script copied the extension's value into the identifier, so any other value is
  // left over. Only that system is pruned; those runs could never leave a stale friendly id,
  // because prepareWorkingCopy drops the Patient extension it reads from.
  describe('--prune-stale', () => {
    const misindexedCopy = (): Patient[] => [
      billingPatient({
        id: 'billing-main',
        extension: copyOf('clinical-1', '1015'),
        identifier: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
      }),
      workingCopyOf({
        id: 'billing-copy',
        extension: copyOf('billing-main'),
        identifier: [clinicalPatientIdentifier('billing-main')],
      }),
    ];

    it('replaces the identifier list with the clinical ids and drops the stale one', async () => {
      const { oystehr, patch } = mockOystehr(misindexedCopy());

      const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr, { pruneStale: true }));

      expect(stats).toEqual({
        examined: 2,
        changed: 1,
        patientsGainingIdentifiers: 1,
        patientsDroppingStaleIdentifiers: 1,
        alreadyIndexed: 1,
        skipped: 0,
        failed: 0,
      });
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'billing-copy',
          operations: [
            {
              op: 'replace',
              path: '/identifier',
              value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
            },
          ],
        }),
        expect.anything()
      );
    });

    it('leaves the stale identifier in place without the flag', async () => {
      const { oystehr, patch } = mockOystehr(misindexedCopy());

      const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

      expect(stats.patientsDroppingStaleIdentifiers).toBe(0);
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            {
              op: 'add',
              path: '/identifier/-',
              value: clinicalPatientIdentifier('clinical-1'),
            },
            {
              op: 'add',
              path: '/identifier/-',
              value: clinicalFriendlyIdIdentifier('1015'),
            },
          ],
        }),
        expect.anything()
      );
    });

    it('keeps identifiers from other systems', async () => {
      const otherId = {
        system: 'https://fhir.ottehr.com/other',
        value: 'other',
      };
      const { oystehr, patch } = mockOystehr([
        billingPatient({
          id: 'billing-main',
          extension: copyOf('clinical-1'),
          identifier: [otherId, clinicalPatientIdentifier('stale-clinical')],
        }),
      ]);

      await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr, { pruneStale: true }));

      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            {
              op: 'replace',
              path: '/identifier',
              value: [otherId, clinicalPatientIdentifier('clinical-1')],
            },
          ],
        }),
        expect.anything()
      );
    });

    it('prunes a copy that is otherwise fully indexed', async () => {
      const { oystehr, patch } = mockOystehr([
        billingPatient({
          id: 'billing-main',
          extension: copyOf('clinical-1'),
          identifier: [clinicalPatientIdentifier('clinical-1'), clinicalPatientIdentifier('billing-parent')],
        }),
      ]);

      const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr, { pruneStale: true }));

      expect(stats).toEqual({
        examined: 1,
        changed: 1,
        patientsGainingIdentifiers: 0,
        patientsDroppingStaleIdentifiers: 1,
        alreadyIndexed: 0,
        skipped: 0,
        failed: 0,
      });
      expect(patch).toHaveBeenCalledWith(
        expect.objectContaining({
          operations: [
            {
              op: 'replace',
              path: '/identifier',
              value: [clinicalPatientIdentifier('clinical-1')],
            },
          ],
        }),
        expect.anything()
      );
    });

    it('reports what it would drop without writing during a dry run', async () => {
      const { oystehr, patch } = mockOystehr(misindexedCopy());

      const stats = await backfillBillingPatientClinicalIdentifiers(
        runOptions(oystehr, {
          dryRun: true,
          pruneStale: true,
        })
      );

      expect(stats.patientsDroppingStaleIdentifiers).toBe(1);
      expect(patch).not.toHaveBeenCalled();
    });

    // A working copy of a manually created billing patient resolves no clinical id, so there is no
    // right value to compare against. Earlier runs could still only have written a billing Patient
    // id, and this system indexes clinical Patients, so a scanned id is proof enough to drop it.
    describe('with no clinical id to compare against', () => {
      const copyOfManualPatient = (identifier: Patient['identifier']): Patient[] => [
        billingPatient({
          id: 'billing-manual',
        }),
        workingCopyOf({
          id: 'billing-copy',
          extension: copyOf('billing-manual'),
          identifier,
        }),
      ];

      it('drops a source identifier that names a scanned billing patient', async () => {
        const otherId = {
          system: 'https://fhir.ottehr.com/other',
          value: 'other',
        };
        const { oystehr, patch } = mockOystehr(
          copyOfManualPatient([otherId, clinicalPatientIdentifier('billing-manual')])
        );

        const stats = await backfillBillingPatientClinicalIdentifiers(
          runOptions(oystehr, {
            pruneStale: true,
          })
        );

        expect(stats).toEqual({
          examined: 2,
          changed: 1,
          patientsGainingIdentifiers: 0,
          patientsDroppingStaleIdentifiers: 1,
          alreadyIndexed: 0,
          skipped: 1,
          failed: 0,
        });
        expect(patch).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'billing-copy',
            operations: [
              {
                op: 'replace',
                path: '/identifier',
                value: [otherId],
              },
            ],
          }),
          expect.anything()
        );
      });

      it('removes the identifier element when the prune empties it', async () => {
        const { oystehr, patch } = mockOystehr(copyOfManualPatient([clinicalPatientIdentifier('billing-manual')]));

        await backfillBillingPatientClinicalIdentifiers(
          runOptions(oystehr, {
            pruneStale: true,
          })
        );

        expect(patch).toHaveBeenCalledWith(
          expect.objectContaining({
            id: 'billing-copy',
            operations: [
              {
                op: 'remove',
                path: '/identifier',
              },
            ],
          }),
          expect.anything()
        );
      });

      // Indistinguishable from a clinical id: the scan cannot see clinical patients, and a deleted
      // billing patient leaves the same trace. Dropping it would destroy the only link left.
      it('leaves a source identifier that names no scanned patient', async () => {
        const { oystehr, patch } = mockOystehr(copyOfManualPatient([clinicalPatientIdentifier('clinical-9')]));

        const stats = await backfillBillingPatientClinicalIdentifiers(
          runOptions(oystehr, {
            pruneStale: true,
          })
        );

        expect(stats.skipped).toBe(2);
        expect(stats.patientsDroppingStaleIdentifiers).toBe(0);
        expect(patch).not.toHaveBeenCalled();
      });

      it('keeps the identifier without the flag', async () => {
        const { oystehr, patch } = mockOystehr(copyOfManualPatient([clinicalPatientIdentifier('billing-manual')]));

        const stats = await backfillBillingPatientClinicalIdentifiers(runOptions(oystehr));

        expect(stats.skipped).toBe(2);
        expect(patch).not.toHaveBeenCalled();
      });
    });
  });
});

describe('syncClinicalPatientIdentifiers', () => {
  const target = (identifier?: Patient['identifier']): Patient =>
    billingPatient({
      id: 'billing-1',
      extension: copyOf('clinical-1'),
      identifier,
    });

  const mockWriter = (): { oystehr: Oystehr; patch: ReturnType<typeof vi.fn>; get: ReturnType<typeof vi.fn> } => {
    const patch = vi.fn().mockResolvedValue({});
    const get = vi.fn();
    return {
      oystehr: {
        fhir: {
          patch,
          get,
        },
      } as unknown as Oystehr,
      patch,
      get,
    };
  };

  it('adds the friendly id alongside the clinical patient id in one patch', async () => {
    const { oystehr, patch } = mockWriter();

    await syncClinicalPatientIdentifiers({
      oystehr,
      patient: target(),
      clinicalId: 'clinical-1',
      clinicalFriendlyId: '1015',
    });

    expect(patch).toHaveBeenCalledWith(
      {
        resourceType: 'Patient',
        id: 'billing-1',
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1'), clinicalFriendlyIdIdentifier('1015')],
          },
        ],
      },
      {
        optimisticLockingVersionId: '1',
      }
    );
  });

  it('adds only the identifier that is missing', async () => {
    const { oystehr, patch } = mockWriter();

    await syncClinicalPatientIdentifiers({
      oystehr,
      patient: target([clinicalPatientIdentifier('clinical-1')]),
      clinicalId: 'clinical-1',
      clinicalFriendlyId: '1015',
    });

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/identifier/-',
            value: clinicalFriendlyIdIdentifier('1015'),
          },
        ],
      }),
      expect.anything()
    );
  });

  it('appends rather than replacing when the patient carries other identifiers', async () => {
    const { oystehr, patch } = mockWriter();
    const otherId = {
      system: 'https://fhir.ottehr.com/other',
      value: 'other',
    };

    await syncClinicalPatientIdentifiers({
      oystehr,
      patient: target([otherId]),
      clinicalId: 'clinical-1',
    });

    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/identifier/-',
            value: clinicalPatientIdentifier('clinical-1'),
          },
        ],
      }),
      expect.anything()
    );
  });

  it('writes nothing when the identifier is already there', async () => {
    const { oystehr, patch } = mockWriter();

    await syncClinicalPatientIdentifiers({
      oystehr,
      patient: target([clinicalPatientIdentifier('clinical-1')]),
      clinicalId: 'clinical-1',
    });

    expect(patch).not.toHaveBeenCalled();
  });

  it('does not re-add the identifier when a concurrent claim writes it first', async () => {
    const { oystehr, patch, get } = mockWriter();
    patch.mockRejectedValueOnce(Object.assign(new Error('conflict'), { code: 412 }));
    get.mockResolvedValue(target([clinicalPatientIdentifier('clinical-1')]));

    await syncClinicalPatientIdentifiers({
      oystehr,
      patient: target(),
      clinicalId: 'clinical-1',
    });

    expect(patch).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith({
      resourceType: 'Patient',
      id: 'billing-1',
    });
  });

  it('drops a stale source identifier only when pruning is asked for', async () => {
    const { oystehr, patch } = mockWriter();
    const patient = target([clinicalPatientIdentifier('billing-parent')]);

    await syncClinicalPatientIdentifiers({
      oystehr,
      patient,
      clinicalId: 'clinical-1',
    });
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'add',
            path: '/identifier/-',
            value: clinicalPatientIdentifier('clinical-1'),
          },
        ],
      }),
      expect.anything()
    );

    patch.mockClear();
    await syncClinicalPatientIdentifiers({
      oystehr,
      patient,
      clinicalId: 'clinical-1',
      pruneStale: true,
    });
    expect(patch).toHaveBeenCalledWith(
      expect.objectContaining({
        operations: [
          {
            op: 'replace',
            path: '/identifier',
            value: [clinicalPatientIdentifier('clinical-1')],
          },
        ],
      }),
      expect.anything()
    );
  });
});
