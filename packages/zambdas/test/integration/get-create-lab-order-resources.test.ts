import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { Account, Coverage, List, Location, Organization } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CODE_SYSTEM_COVERAGE_CLASS } from 'utils/lib/helpers/rcm/constants';
import { ExternalLabSetDTO, LabSetStatus } from 'utils/lib/types/data/labs/lab-set.schema';
import { LAB_ACCOUNT_NUMBER_SYSTEM, OYSTEHR_LAB_GUID_SYSTEM } from 'utils/lib/types/data/labs/labs.constants';
import { LabOrderResourcesRes, LabType, OrderableItemSearchResult } from 'utils/lib/types/data/labs/labs.types';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { index } from '../../src/ehr/lab/external/get-create-lab-order-resources/index';
import { configFhirListForLabSet } from '../../src/ehr/lab/shared/helpers';
import {
  addProcessIdMetaTagToResource,
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';
import { invokeZambdaHandler } from '../helpers/invoke-zambda-handler';

const { getOrderableItems } = vi.hoisted(() => ({ getOrderableItems: vi.fn() }));

vi.mock('../../src/ehr/lab/shared/orderable-items', () => ({ getOrderableItems }));

describe('get-create-lab-order-resources integration', () => {
  let oystehr: Oystehr;
  let token: string;
  let cleanup: () => Promise<void>;
  let processId: string;
  let base: InsertFullAppointmentDataBaseResult;
  let labOrg: Organization;
  let payorOrg: Organization;
  let orderingLocation: Location;
  let coverage: Coverage;
  let labSetList: List;
  const labGuid = randomUUID();
  const accountNumber = `IT-${randomUUID().slice(0, 8)}`;
  const coverageName = `IT Plan ${randomUUID().slice(0, 8)}`;

  const tag = <T extends { resourceType: string }>(resource: T): T =>
    addProcessIdMetaTagToResource(resource as any, processId) as unknown as T;

  const labSet = (): ExternalLabSetDTO => ({
    listId: labSetList.id!,
    listName: labSetList.title!,
    listStatus: LabSetStatus.active,
    listType: LabType.external,
    labs: [{ display: 'CBC With Differential / IT Lab', itemCode: '005009', labGuid }],
  });

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-create-lab-order-resources.test.ts', M2MClientMockType.provider);
    oystehr = setup.oystehr;
    token = setup.testUserM2MToken;
    cleanup = setup.cleanup;
    processId = setup.processId;
    base = await insertInPersonAppointmentBase(oystehr, processId);

    [labOrg, payorOrg] = await Promise.all([
      oystehr.fhir.create<Organization>(
        tag({
          resourceType: 'Organization',
          name: `IT Lab ${randomUUID().slice(0, 8)}`,
          identifier: [{ system: OYSTEHR_LAB_GUID_SYSTEM, value: labGuid }],
        })
      ),
      oystehr.fhir.create<Organization>(tag({ resourceType: 'Organization', name: `IT Payor ${randomUUID()}` })),
    ]);

    [orderingLocation, coverage, labSetList] = await Promise.all([
      oystehr.fhir.create<Location>(
        tag({
          resourceType: 'Location',
          status: 'active',
          name: `IT Lab Ordering Location ${randomUUID().slice(0, 8)}`,
          identifier: [
            {
              system: LAB_ACCOUNT_NUMBER_SYSTEM,
              value: accountNumber,
              assigner: { reference: `Organization/${labOrg.id}` },
            },
          ],
        })
      ),
      oystehr.fhir.create<Coverage>(
        tag({
          resourceType: 'Coverage',
          status: 'active',
          beneficiary: { reference: `Patient/${base.patient.id}` },
          payor: [{ reference: `Organization/${payorOrg.id}` }],
          class: [
            {
              type: { coding: [{ system: CODE_SYSTEM_COVERAGE_CLASS, code: 'plan' }] },
              value: 'IT',
              name: coverageName,
            },
          ],
        })
      ),
      oystehr.fhir.create<List>(
        tag(
          configFhirListForLabSet({
            listId: '',
            listName: `IT Lab Set ${randomUUID().slice(0, 8)}`,
            listStatus: LabSetStatus.active,
            listType: LabType.external,
            labs: [{ display: 'CBC With Differential / IT Lab', itemCode: '005009', labGuid }],
          })
        )
      ),
    ]);

    const [account] = (
      await oystehr.fhir.search<Account>({
        resourceType: 'Account',
        params: [{ name: 'subject', value: `Patient/${base.patient.id}` }],
      })
    ).unbundle();
    await oystehr.fhir.patch<Account>({
      resourceType: 'Account',
      id: account.id!,
      operations: [
        { op: 'add', path: '/guarantor', value: [{ party: { reference: `Patient/${base.patient.id}` } }] },
        { op: 'add', path: '/coverage', value: [{ coverage: { reference: `Coverage/${coverage.id}` }, priority: 1 }] },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
    await Promise.all(
      [
        labSetList?.id && { resourceType: 'List' as const, id: labSetList.id },
        orderingLocation?.id && { resourceType: 'Location' as const, id: orderingLocation.id },
      ]
        .filter((ref): ref is { resourceType: 'List' | 'Location'; id: string } => !!ref)
        .map((ref) => oystehr.fhir.delete(ref).catch(() => undefined))
    );
    await Promise.all(
      [labOrg?.id, payorOrg?.id]
        .filter((id): id is string => !!id)
        .map((id) => oystehr.fhir.delete({ resourceType: 'Organization', id }).catch(() => undefined))
    );
  });

  it('returns the patient coverage, ordering locations, lab sets and the selected lab set tests', async () => {
    const orderableItem: OrderableItemSearchResult = {
      item: {
        itemCode: '005009',
        itemLoinc: '58410-2',
        itemType: 'test',
        itemName: 'CBC With Differential',
        uniqueName: 'cbc_with_differential',
        specimens: [],
        components: [],
        cptCodes: [{ cptCode: '85025', serviceUnitsCount: 1 }],
        aoe: null,
      },
      lab: { labGuid, labName: labOrg.name!, labType: 'reference', compendiumVersion: '1' },
    };
    getOrderableItems.mockResolvedValueOnce([orderableItem]);

    const { statusCode, output } = await invokeZambdaHandler<LabOrderResourcesRes>(
      index,
      { patientId: base.patient.id, encounterId: base.encounter.id, selectedLabSet: labSet() },
      { token }
    );

    expect(statusCode).toBe(200);
    expect(getOrderableItems).toHaveBeenCalledWith([labGuid], { itemCodes: ['005009'] }, expect.any(String));
    expect(output.labs).toEqual([orderableItem]);
    expect(output.coverages).toEqual([{ coverageName, coverageId: coverage.id, isPrimary: true }]);
    expect(output.appointmentIsWorkersComp).toBe(false);
    expect(output.orderingLocationIds).toContain(orderingLocation.id);
    expect(output.orderingLocations.find((location) => location.id === orderingLocation.id)).toEqual({
      id: orderingLocation.id,
      name: orderingLocation.name,
      enabledLabs: [{ accountNumber, labOrgRef: `Organization/${labOrg.id}` }],
    });
    expect(output.labSets?.find((set) => set.listId === labSetList.id)).toEqual(labSet());
  });
});
