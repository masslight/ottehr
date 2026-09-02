import Oystehr from '@oystehr/sdk';
import { Appointment } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { M2MClientMockType } from 'utils/lib/auth/user-me.helper';
import { OTTEHR_MODULE } from 'utils/lib/fhir/moduleIdentification';
import { GetAppointmentsZambdaOutput } from 'utils/lib/types/api/get-appointments.types';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  InsertFullAppointmentDataBaseResult,
  insertInPersonAppointmentBase,
  setupIntegrationTest,
} from '../helpers/integration-test-seed-data-setup';

// Happy path for get-appointments: seeds one in-person visit, moves it in-office, and asks for the board of its
// Location for today. The seed graph has no Practitioner participant, so the queries filter by Location, not provider.
describe('get-appointments integration — happy path', () => {
  let oystehrZambdas: Oystehr;
  let base: InsertFullAppointmentDataBaseResult;
  let locationId: string;
  let cleanup: () => Promise<void>;

  // The seed's Appointment.start is "now" in UTC, so the search day is today in UTC as well.
  const boardParams = (): Record<string, unknown> => {
    const today = DateTime.now().toUTC().toISODate();
    return { searchDateFrom: today, searchDateTo: today, timezone: 'UTC', locationIds: [locationId] };
  };

  beforeAll(async () => {
    const setup = await setupIntegrationTest('get-appointments.test.ts', M2MClientMockType.provider);
    oystehrZambdas = setup.oystehrTestUserM2M;
    cleanup = setup.cleanup;
    base = await insertInPersonAppointmentBase(setup.oystehr, setup.processId);
    locationId = base.encounter.location?.[0]?.location?.reference?.replace('Location/', '') ?? '';
    expect(locationId).not.toBe('');
    // The seed is a booked visit without a module tag. Tag it in-person and mark it arrived so the board buckets it
    // in-office, one of the two buckets whose encounters get order icons and vitals badges.
    await setup.oystehr.fhir.patch<Appointment>({
      resourceType: 'Appointment',
      id: base.appointment.id!,
      operations: [
        { op: 'replace', path: '/status', value: 'arrived' },
        { op: 'add', path: '/meta/tag/-', value: { code: OTTEHR_MODULE.IP } },
      ],
    });
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  });

  it('returns the seeded visit in-office for its location on the day', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      ...boardParams(),
      visitType: ['in-person-pre-booked'],
    });
    const output = response.output as GetAppointmentsZambdaOutput;
    expect(output.inOffice.map((appointment) => appointment.id)).toContain(base.appointment.id);
  });

  it('always returns the grouped order table and abnormal vitals', async () => {
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      ...boardParams(),
      visitType: ['in-person-pre-booked'],
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
      ...boardParams(),
      visitType: ['in-person-walk-in', 'in-person-pre-booked', 'in-person-post-telemed'],
    };
    const response = await oystehrZambdas.zambda.execute({
      id: 'get-appointments',
      ...params,
    });
    const output = response.output as GetAppointmentsZambdaOutput;
    const encounterIds = [...output.inOffice, ...output.completed].map((appointment) => appointment.encounterId);
    // The seeded visit is in-office, so the comparison below always runs: this test must not pass by comparing
    // nothing. (The seed carries no orders, so it proves the pipeline and shapes agree; add orders to sharpen it.)
    expect(encounterIds).toContain(base.encounter.id);

    const execute = async <T>(body: { id: string } & Record<string, unknown>): Promise<T> =>
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
