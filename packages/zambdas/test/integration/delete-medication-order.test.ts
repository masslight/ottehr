import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { MedicationAdministration, MedicationStatement, Procedure, ServiceRequest, Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { medicationApplianceRoutes } from 'utils/lib/types/api/medication-administration.types';
import { CancelImmunizationOrderResponse } from 'utils/lib/types/data/immunization/types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM } from '../../src/shared/candid';
import { makeProcedureResource } from '../../src/shared/chart-data';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

const codeOf = (line: Procedure): string | undefined => line.code?.coding?.[0]?.code;

const isLineOf =
  (orderId: string) =>
  (line: Procedure): boolean =>
    line.partOf?.some((part) => part.reference === `MedicationAdministration/${orderId}`) ?? false;

const sortedIds = (lines: Procedure[]): (string | undefined)[] => lines.map((line) => line.id).sort();

describe('deleting in-house medication and vaccine orders', () => {
  let oystehrAdmin: Oystehr;
  let oystehrProvider: Oystehr;
  let processId: string;
  let practitionerId: string;
  let medicationId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('delete-medication-order.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrProvider = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
    const medication = await oystehrProvider.zambda.execute({
      id: 'create-in-house-medication',
      name: `IT Med ${randomUUID().slice(0, 8)}`,
      medispanID: `IT-${randomUUID().slice(0, 8)}`,
    });
    medicationId = (medication.output as { id: string }).id;
  }, 60_000);

  afterAll(async () => {
    await oystehrAdmin.fhir.delete({ resourceType: 'Medication', id: medicationId }).catch(() => undefined);
    await cleanup();
  }, 60_000);

  const getOrder = (orderId: string): Promise<MedicationAdministration> =>
    oystehrAdmin.fhir.get<MedicationAdministration>({ resourceType: 'MedicationAdministration', id: orderId });

  const getStatementStatuses = async (orderId: string): Promise<MedicationStatement['status'][]> =>
    (
      await getAllFhirSearchPages<MedicationStatement>(
        {
          resourceType: 'MedicationStatement',
          params: [{ name: 'part-of', value: `MedicationAdministration/${orderId}` }],
        },
        oystehrAdmin
      )
    ).map((statement) => statement.status);

  const getCptLines = (visit: InsertFullAppointmentDataBaseResult): Promise<Procedure[]> =>
    getAllFhirSearchPages<Procedure>(
      {
        resourceType: 'Procedure',
        params: [
          { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
          { name: '_tag', value: 'cpt-code' },
        ],
      },
      oystehrAdmin
    );

  describe('in-house medication', () => {
    const inHouseOrderData = (
      visit: InsertFullAppointmentDataBaseResult,
      cptCodes: string[]
    ): Record<string, unknown> => ({
      patient: visit.patient.id,
      encounter: visit.encounter.id,
      encounterId: visit.encounter.id,
      medicationId,
      dose: 1,
      units: 'mg',
      route: medicationApplianceRoutes.INFUSION.code,
      providerId: practitionerId,
      cptCodes: cptCodes.map((code) => ({ code, display: code })),
    });

    const createInfusionOrder = async (
      visit: InsertFullAppointmentDataBaseResult,
      cptCodes: string[]
    ): Promise<string> =>
      (
        (
          await oystehrProvider.zambda.execute({
            id: 'create-update-medication-order',
            orderData: inHouseOrderData(visit, cptCodes),
          })
        ).output as { id: string }
      ).id;

    const administerInfusion = async (
      visit: InsertFullAppointmentDataBaseResult,
      orderId: string,
      cptCodes: string[]
    ): Promise<void> => {
      await oystehrProvider.zambda.execute({
        id: 'create-update-medication-order',
        orderId,
        newStatus: 'administered',
        orderData: { ...inHouseOrderData(visit, cptCodes), effectiveDateTime: DateTime.now().toUTC().toISO() },
      });
    };

    const deleteOrder = async (
      orderId: string,
      orderData?: Record<string, unknown>
    ): Promise<{ retainedCptCodes?: string[]; billingReviewRequired?: boolean }> => {
      const { retainedCptCodes, billingReviewRequired } = (
        await oystehrProvider.zambda.execute({
          id: 'create-update-medication-order',
          orderId,
          newStatus: 'cancelled',
          ...(orderData && { orderData }),
        })
      ).output as { retainedCptCodes?: string[]; billingReviewRequired?: boolean };
      return { retainedCptCodes, billingReviewRequired };
    };

    const getRecheckStatuses = async (
      visit: InsertFullAppointmentDataBaseResult,
      orderId: string
    ): Promise<{ serviceRequest: ServiceRequest['status']; task: Task['status'] }> => {
      const rechecks = (
        await oystehrAdmin.fhir.search<ServiceRequest>({
          resourceType: 'ServiceRequest',
          params: [
            { name: 'encounter', value: `Encounter/${visit.encounter.id}` },
            { name: '_tag', value: `${PRIVATE_EXTENSION_BASE_URL}/order-type-tag|nursing order` },
          ],
        })
      )
        .unbundle()
        .filter(
          (serviceRequest) =>
            serviceRequest.supportingInfo?.some((info) => info.reference === `MedicationAdministration/${orderId}`)
        );
      expect(rechecks).toHaveLength(1);
      const tasks = (
        await oystehrAdmin.fhir.search<Task>({
          resourceType: 'Task',
          params: [{ name: 'based-on', value: `ServiceRequest/${rechecks[0].id}` }],
        })
      ).unbundle();
      expect(tasks).toHaveLength(1);
      return { serviceRequest: rechecks[0].status, task: tasks[0].status };
    };

    it('deleting an administered infusion removes only what that order produced, through either cancel request shape, and a repeated delete writes nothing', async () => {
      const visit = await insertInPersonAppointmentBase(oystehrAdmin, processId);
      const providerLine = await oystehrAdmin.fhir.create<Procedure>(
        makeProcedureResource(visit.encounter.id!, visit.patient.id!, { code: '96372', display: '96372' }, 'cpt-code')
      );
      const deletedOrderId = await createInfusionOrder(visit, ['96365', '96372']);
      await administerInfusion(visit, deletedOrderId, ['96365', '96372']);
      await administerInfusion(visit, deletedOrderId, ['96365', '96372']);
      const otherOrderId = await createInfusionOrder(visit, ['J3301']);
      await administerInfusion(visit, otherOrderId, ['J3301']);
      const linesBefore = await getCptLines(visit);
      expect(linesBefore.filter(isLineOf(deletedOrderId)).map(codeOf).sort()).toEqual([
        '96365',
        '96365',
        '96372',
        '96372',
      ]);
      const otherOrderLines = linesBefore.filter(isLineOf(otherOrderId));
      expect(otherOrderLines.map(codeOf)).toEqual(['J3301']);
      expect(await getStatementStatuses(deletedOrderId)).toEqual(['active', 'active']);

      expect(await deleteOrder(deletedOrderId)).toEqual({ retainedCptCodes: ['96372'], billingReviewRequired: false });

      const deletedOrder = await getOrder(deletedOrderId);
      expect(deletedOrder.status).toBe('stopped');
      expect(await getStatementStatuses(deletedOrderId)).toEqual(['entered-in-error', 'entered-in-error']);
      expect(sortedIds(await getCptLines(visit))).toEqual(sortedIds([providerLine, ...otherOrderLines]));
      expect(await getRecheckStatuses(visit, deletedOrderId)).toEqual({ serviceRequest: 'revoked', task: 'cancelled' });
      expect(await getStatementStatuses(otherOrderId)).toEqual(['active']);
      expect(await getRecheckStatuses(visit, otherOrderId)).toEqual({ serviceRequest: 'draft', task: 'requested' });

      expect(await deleteOrder(deletedOrderId)).toEqual({ retainedCptCodes: [], billingReviewRequired: false });
      expect((await getOrder(deletedOrderId)).meta?.versionId).toBe(deletedOrder.meta?.versionId);

      await deleteOrder(otherOrderId, inHouseOrderData(visit, ['J3301']));

      expect(await getStatementStatuses(otherOrderId)).toEqual(['entered-in-error']);
      expect(sortedIds(await getCptLines(visit))).toEqual([providerLine.id]);
      expect(await getRecheckStatuses(visit, otherOrderId)).toEqual({ serviceRequest: 'revoked', task: 'cancelled' });
    });
  });

  describe('vaccine', () => {
    const vaccineOrderDetails = (): Record<string, unknown> => ({
      medication: { id: medicationId, name: 'IT Vaccine' },
      dose: '0.5',
      units: 'mL',
      orderedProvider: { id: practitionerId, name: 'M2M Client' },
      orderedDateTime: DateTime.now().toUTC().toISO(),
    });

    const createVaccineOrder = async (visit: InsertFullAppointmentDataBaseResult): Promise<string> =>
      (
        (
          await oystehrProvider.zambda.execute({
            id: 'create-update-immunization-order',
            encounterId: visit.encounter.id,
            details: vaccineOrderDetails(),
          })
        ).output as { orderId: string }
      ).orderId;

    const administerVaccine = async (orderId: string, cptCodes: string[]): Promise<void> => {
      await oystehrProvider.zambda.execute({
        id: 'administer-immunization-order',
        orderId,
        type: 'administered',
        details: vaccineOrderDetails(),
        administrationDetails: {
          mvx: 'PMC',
          cvx: '141',
          ndc: '00006-4047-41',
          lot: 'IT-LOT-1',
          expDate: '2030-01-01',
          administeredDateTime: DateTime.now().toUTC().toISO(),
          visGivenDate: '2026-06-14',
          cptCodes: cptCodes.map((code) => ({ code, display: code })),
        },
      });
    };

    const deleteOrder = async (orderId: string): Promise<CancelImmunizationOrderResponse> =>
      (await oystehrProvider.zambda.execute({ id: 'cancel-immunization-order', orderId }))
        .output as CancelImmunizationOrderResponse;

    it('deleting an administered vaccine removes its own lines, keeps a line another vaccine relies on, reports an unlinked line and billed visit, and the vaccine cannot be administered again', async () => {
      const visit = await insertInPersonAppointmentBase(oystehrAdmin, processId);
      const deletedOrderId = await createVaccineOrder(visit);
      await administerVaccine(deletedOrderId, ['90471', '90686', '90672']);
      const otherOrderId = await createVaccineOrder(visit);
      await administerVaccine(otherOrderId, ['90471', '90715']);
      const linesBefore = await getCptLines(visit);
      expect(linesBefore.map((line) => [codeOf(line), line.partOf?.map((part) => part.reference)]).sort()).toEqual([
        ['90471', [`MedicationAdministration/${deletedOrderId}`]],
        ['90672', [`MedicationAdministration/${deletedOrderId}`]],
        ['90686', [`MedicationAdministration/${deletedOrderId}`]],
        ['90715', [`MedicationAdministration/${otherOrderId}`]],
      ]);
      const lineWithCode = (code: string): Procedure => linesBefore.find((line) => codeOf(line) === code)!;
      await oystehrAdmin.fhir.patch({
        resourceType: 'Procedure',
        id: lineWithCode('90672').id!,
        operations: [{ op: 'remove', path: '/partOf' }],
      });
      await oystehrAdmin.fhir.patch({
        resourceType: 'Encounter',
        id: visit.encounter.id!,
        operations: [
          {
            op: 'add',
            path: '/identifier',
            value: [{ system: CANDID_ENCOUNTER_ID_IDENTIFIER_SYSTEM, value: randomUUID() }],
          },
        ],
      });

      expect(await deleteOrder(deletedOrderId)).toEqual({ retainedCptCodes: ['90672'], billingReviewRequired: true });
      expect(await deleteOrder(await createVaccineOrder(visit))).toEqual({
        retainedCptCodes: [],
        billingReviewRequired: false,
      });

      expect((await getOrder(deletedOrderId)).status).toBe('stopped');
      expect(await getStatementStatuses(deletedOrderId)).toEqual(['entered-in-error']);
      expect(sortedIds(await getCptLines(visit))).toEqual(
        sortedIds([lineWithCode('90471'), lineWithCode('90672'), lineWithCode('90715')])
      );
      expect(await getStatementStatuses(otherOrderId)).toEqual(['active']);

      await expect(administerVaccine(deletedOrderId, ['90686'])).rejects.toThrow();

      expect((await getOrder(deletedOrderId)).status).toBe('stopped');
      expect(await getStatementStatuses(deletedOrderId)).toEqual(['entered-in-error']);
    });
  });
});
