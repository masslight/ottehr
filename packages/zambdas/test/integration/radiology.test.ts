import Oystehr from '@oystehr/sdk';
import { DomainResource, Procedure, ServiceRequest } from 'fhir/r4b';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { CreateRadiologyZambdaOrderInput, CreateRadiologyZambdaOrderOutput } from 'utils/lib/types/api/radiology';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

describe('radiology integration tests', () => {
  let oystehrTestUserM2M: Oystehr;
  let oystehrAdmin: Oystehr;
  const resourcesToCleanup: DomainResource[] = [];

  let baseResources: InsertFullAppointmentDataBaseResult;
  let appointmentBaseCleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('integration/radiology.test.ts', M2MClientMockType.provider);
    appointmentBaseCleanup = setup.cleanup;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    oystehrAdmin = setup.oystehr;
    baseResources = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
  }, 60_000);

  afterAll(async () => {
    if (!oystehrAdmin) {
      throw new Error('oystehr is null! could not clean up!');
    }
    await cleanupResources(oystehrAdmin);
    await appointmentBaseCleanup();
  });

  const cleanupResources = async (oystehr: Oystehr): Promise<void> => {
    // Implement cleanup logic here
    for (const resource of resourcesToCleanup) {
      await oystehr.fhir.delete({
        resourceType: resource.resourceType as any,
        id: resource.id!,
      });
    }
  };

  describe('create order', () => {
    it('should create a radiology order -- success', async () => {
      const createOrderInput: CreateRadiologyZambdaOrderInput = {
        encounterId: baseResources.encounter.id!,
        diagnosisCodes: ['W21.89XA'],
        cptCode: '73562',
        lateralityModifier: undefined,
        stat: true,
        clinicalHistory: 'Took an arrow to the knee',
        consentObtained: true,
      };
      let orderOutput: any;
      try {
        orderOutput = (
          await oystehrTestUserM2M.zambda.execute({
            id: 'RADIOLOGY-CREATE-ORDER',
            ...createOrderInput,
          })
        ).output as CreateRadiologyZambdaOrderOutput;
      } catch (error) {
        console.error('Error executing zambda:', error);
        orderOutput = error as Error;
      }
      expect(orderOutput).toBeDefined();
      expect(orderOutput).toHaveProperty('serviceRequestId');
      expect(orderOutput).toHaveProperty('cptCodesSaved');

      // In-house orders are performed and billed by the practice, so — unlike external ones — they
      // must still get their `cpt-code` Procedure, which is what surfaces the CPT on the Assessment
      // page. Asserted explicitly so the external-order carve-out can't quietly widen to in-house.
      expect(orderOutput.cptCodesSaved).toHaveLength(1);
      expect(orderOutput.cptCodesSaved[0].code).toBe('73562');

      const procedures = (
        await oystehrAdmin.fhir.search<Procedure>({
          resourceType: 'Procedure',
          params: [{ name: 'based-on', value: `ServiceRequest/${orderOutput.serviceRequestId}` }],
        })
      ).unbundle();
      expect(procedures).toHaveLength(1);
      expect(procedures[0].code?.coding?.[0]?.code).toBe('73562');
      expect(procedures[0].meta?.tag?.some((tag) => tag.code === 'cpt-code')).toBe(true);
      procedures.forEach((procedure) => resourcesToCleanup.push(procedure));

      resourcesToCleanup.push(
        await oystehrAdmin.fhir.get<ServiceRequest>({
          resourceType: 'ServiceRequest',
          id: orderOutput.serviceRequestId,
        })
      );
    });

    it('should not create a billing CPT Procedure for an external order', async () => {
      // The outside facility performs and bills for the study, so the practice must not charge for it:
      // no `cpt-code` Procedure means no CPT on the chart's Assessment / Payment Considerations.
      // External (print-only) orders skip the AdvaPACS transmit, so this works without AdvaPACS creds.
      const createOrderInput: CreateRadiologyZambdaOrderInput = {
        encounterId: baseResources.encounter.id!,
        diagnosisCodes: ['W21.89XA'],
        cptCode: '73562',
        lateralityModifier: undefined,
        stat: false,
        clinicalHistory: 'Took an arrow to the knee',
        consentObtained: false,
        external: true,
        performingOrganization: { name: 'Test Imaging Center' },
      };

      const orderOutput = (
        await oystehrTestUserM2M.zambda.execute({
          id: 'RADIOLOGY-CREATE-ORDER',
          ...createOrderInput,
        })
      ).output as CreateRadiologyZambdaOrderOutput;

      expect(orderOutput.serviceRequestId).toBeDefined();
      expect(orderOutput.cptCodesSaved).toBeUndefined();

      resourcesToCleanup.push(
        await oystehrAdmin.fhir.get<ServiceRequest>({
          resourceType: 'ServiceRequest',
          id: orderOutput.serviceRequestId,
        })
      );

      const procedures = (
        await oystehrAdmin.fhir.search<Procedure>({
          resourceType: 'Procedure',
          params: [{ name: 'based-on', value: `ServiceRequest/${orderOutput.serviceRequestId}` }],
        })
      ).unbundle();
      expect(procedures).toEqual([]);
    });
  });
});
