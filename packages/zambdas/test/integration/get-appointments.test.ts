import Oystehr from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { GetAppointmentsZambdaOutput } from 'utils/lib/types/api/get-appointments.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// Happy path for get-appointments: given a search date, timezone, visit types
// and a provider filter, returns the appointments payload (empty list is a
// valid happy-path result for an arbitrary provider/day).
describe('get-appointments integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let practitionerId: string;
  let cleanup: () => Promise<void>;

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-appointments.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    practitionerId = setup.testUserM2MProfile.replace('Practitioner/', '');
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns appointments for a provider on a given day', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      searchDateFrom: DateTime.now().toISODate(),
      searchDateTo: DateTime.now().toISODate(),
      timezone: 'America/New_York',
      visitType: ['in-person-walk-in'],
      providerIds: [practitionerId],
    });
    expect(response.output).toBeDefined();
  });

  it('keeps the legacy response shape when include is absent', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      searchDateFrom: DateTime.now().toISODate(),
      searchDateTo: DateTime.now().toISODate(),
      timezone: 'America/New_York',
      visitType: ['in-person-walk-in'],
      providerIds: [practitionerId],
    });
    const output = response.output as GetAppointmentsZambdaOutput;
    expect(output.orders).toBeUndefined();
    expect(output.vitals).toBeUndefined();
  });

  it('returns the grouped order table and abnormal vitals when include asks for them', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      searchDateFrom: DateTime.now().toISODate(),
      searchDateTo: DateTime.now().toISODate(),
      timezone: 'America/New_York',
      visitType: ['in-person-walk-in'],
      providerIds: [practitionerId],
      include: { orders: true, vitals: true },
    });
    const output = response.output as GetAppointmentsZambdaOutput;
    expect(Object.keys(output.orders ?? {}).sort()).toEqual(
      [
        'erxOrdersByEncounterId',
        'externalLabOrdersByAppointmentId',
        'immunizationOrdersByEncounterId',
        'inHouseLabOrdersByAppointmentId',
        'inHouseMedicationsByEncounterId',
        'nursingOrdersByAppointmentId',
        'proceduresByEncounterId',
        'radiologyOrdersByAppointmentId',
      ].sort()
    );
    expect(output.vitals).toEqual(expect.any(Object));
  });

  // Parity with the per-order-type zambdas the board used to call, on the fields the board renders. Non-rendered
  // fields (ordering physician, visit date, timezone, billing type) are allowed to differ by design.
  it('groups the same orders the legacy per-type endpoints return for the same encounters', async () => {
    const params = {
      searchDateFrom: DateTime.now().toISODate(),
      searchDateTo: DateTime.now().toISODate(),
      timezone: 'America/New_York',
      visitType: ['in-person-walk-in', 'in-person-pre-booked', 'in-person-post-telemed'],
      providerIds: [practitionerId],
    };
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      ...params,
      include: { orders: true },
    });
    const output = response.output as GetAppointmentsZambdaOutput;
    const encounterIds = [...output.inOffice, ...output.completed].map((appointment) => appointment.encounterId);
    if (encounterIds.length === 0) {
      // Nothing on the board for this provider today; the legacy endpoints reject an empty encounter list.
      expect(Object.values(output.orders ?? {}).every((group) => Object.keys(group).length === 0)).toBe(true);
      return;
    }

    const execute = async <T>(body: Record<string, unknown>): Promise<T> =>
      (await oystehrZambdas.zambda.execute(body)).output as T;
    const searchBy = { field: 'encounterIds', value: encounterIds };
    const rendered = (rows: Record<string, unknown>[]): string[] => rows.map((row) => JSON.stringify(row)).sort();
    const flatten = <T>(grouped: Record<string, T[]> | undefined): T[] => Object.values(grouped ?? {}).flat();

    const [externalLabs, inHouseLabs, nursing, radiology, medications, erx, immunizations, chartData] =
      await Promise.all([
        execute<{ data: any[] }>({ id: 'get-lab-orders', searchBy, itemsPerPage: 100, pageIndex: 0 }),
        execute<{ data: any[] }>({ id: 'get-in-house-orders', searchBy, itemsPerPage: 100, pageIndex: 0 }),
        execute<{ data: any[] }>({ id: 'get-nursing-orders', searchBy }),
        execute<{ orders: any[] }>({ id: 'radiology-order-list', encounterIds, itemsPerPage: 100, pageIndex: 0 }),
        execute<{ orders: any[] }>({ id: 'get-medication-orders', searchBy }),
        execute<{ orders: any[] }>({ id: 'get-erx-orders', encounterIds }),
        execute<{ orders: any[] }>({ id: 'get-immunization-orders', encounterIds }),
        execute<{ procedures?: any[] }>({
          id: 'get-chart-data',
          encounterId: encounterIds[0],
          requestedFields: { procedures: { encounterIds } },
        }),
      ]);

    const orders = output.orders!;
    expect(
      rendered(
        flatten(orders.externalLabOrdersByAppointmentId).map((o) => ({
          key: o.appointmentId,
          id: o.serviceRequestId,
          label: o.testItem,
          status: o.orderStatus,
        }))
      )
    ).toEqual(
      rendered(
        externalLabs.data.map((o) => ({
          key: o.appointmentId,
          id: o.serviceRequestId,
          label: o.testItem,
          status: o.orderStatus,
        }))
      )
    );
    expect(
      rendered(
        flatten(orders.inHouseLabOrdersByAppointmentId).map((o) => ({
          key: o.appointmentId,
          id: o.serviceRequestId,
          label: o.testItemName,
          status: o.status,
        }))
      )
    ).toEqual(
      rendered(
        inHouseLabs.data.map((o) => ({
          key: o.appointmentId,
          id: o.serviceRequestId,
          label: o.testItemName,
          status: o.status,
        }))
      )
    );
    expect(
      rendered(
        flatten(orders.nursingOrdersByAppointmentId).map((o) => ({
          key: o.appointmentId,
          id: o.serviceRequestId,
          label: o.note,
          status: o.status,
        }))
      )
    ).toEqual(
      rendered(
        nursing.data.map((o) => ({ key: o.appointmentId, id: o.serviceRequestId, label: o.note, status: o.status }))
      )
    );
    expect(
      rendered(
        flatten(orders.radiologyOrdersByAppointmentId).map((o) => ({
          key: o.appointmentId,
          id: o.serviceRequestId,
          label: o.studyType,
          status: o.status,
        }))
      )
    ).toEqual(
      rendered(
        radiology.orders
          .filter((o) => !o.external)
          .map((o) => ({ key: o.appointmentId, id: o.serviceRequestId, label: o.studyType, status: o.status }))
      )
    );
    expect(
      rendered(
        flatten(orders.inHouseMedicationsByEncounterId).map((o) => ({
          key: o.encounterId,
          id: o.id,
          label: o.medicationName,
          status: o.status,
        }))
      )
    ).toEqual(
      rendered(
        medications.orders.map((o) => ({ key: o.encounterId, id: o.id, label: o.medicationName, status: o.status }))
      )
    );
    expect(
      rendered(
        flatten(orders.erxOrdersByEncounterId).map((o) => ({
          key: o.encounterId,
          id: o.resourceId,
          label: o.name,
          status: o.status,
        }))
      )
    ).toEqual(
      rendered(erx.orders.map((o) => ({ key: o.encounterId, id: o.resourceId, label: o.name, status: o.status })))
    );
    expect(
      rendered(
        flatten(orders.immunizationOrdersByEncounterId).map((o) => ({
          key: o.encounterId,
          id: o.id,
          label: o.details.medication.name,
          status: o.status,
        }))
      )
    ).toEqual(
      rendered(
        immunizations.orders.map((o) => ({
          key: o.encounterId,
          id: o.id,
          label: o.details.medication.name,
          status: o.status,
        }))
      )
    );
    expect(
      rendered(
        flatten(orders.proceduresByEncounterId).map((o) => ({
          key: o.encounterId,
          id: o.resourceId,
          label: o.procedureType,
        }))
      )
    ).toEqual(
      rendered(
        (chartData.procedures ?? []).map((o) => ({ key: o.encounterId, id: o.resourceId, label: o.procedureType }))
      )
    );
  });
});
