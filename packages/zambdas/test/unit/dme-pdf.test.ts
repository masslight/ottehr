import Oystehr from '@oystehr/sdk';
import { Address, DeviceRequest, Patient, Practitioner } from 'fhir/r4b';
import { PDFDocument } from 'pdf-lib';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { DmeOrderFields, DmeOrderFieldsSchema } from 'utils/lib/types/api/dme.types';
import { describe, expect, it, vi } from 'vitest';
import { makeDmeDeviceRequest, makeDmeDispensedExtension, parseDmeOrder } from '../../src/shared/dme';
import { getEncounterDmeOrders } from '../../src/shared/pdf/assemble-progress-note-input';
import {
  composeDmeOrderFormData,
  createDmeOrderFormPdfBytes,
  DmeOrderFormInput,
} from '../../src/shared/pdf/dme-order-form-pdf';
import { progressNoteDataToText } from '../../src/shared/pdf/progress-note-text';
import { composeDmeOrders, createDmeOrdersSection } from '../../src/shared/pdf/sections/visit-note/dme';
import { DmeOrdersData, PdfAssets, PdfClient, PdfStyles, ProgressNoteData } from '../../src/shared/pdf/types';

const PRACTITIONER_ID = '2b0f5b9e-6a43-4c55-9f5e-6a1d1c7d1a01';
const DISPENSER_ID = '2b0f5b9e-6a43-4c55-9f5e-6a1d1c7d1a02';

const inHouseFields: DmeOrderFields = {
  menuItemId: 'menu-1',
  itemName: 'Wrist brace',
  diagnoses: [{ code: 'S52.501A', display: 'Fracture of right radius' }],
  quantity: 2,
  billingCodes: [{ code: 'L3908', display: 'Wrist hand orthosis' }],
  laterality: 'LT',
  modifier: 'NU',
  duration: { value: 2, unit: 'weeks' },
  orderedByPractitionerId: PRACTITIONER_ID,
  instructions: 'Wear at all times',
};

const externalFields: DmeOrderFields = {
  itemName: 'Crutches',
  quantity: 1,
  orderedByPractitionerId: PRACTITIONER_ID,
  external: true,
  thirdParty: { name: 'Acme Medical Supply', address: '1 Supply Rd', phone: '555-0100', fax: '555-0101' },
};

const makeDeviceRequest = (fields: DmeOrderFields, dispensed = false): DeviceRequest => {
  const deviceRequest = makeDmeDeviceRequest({
    fields: DmeOrderFieldsSchema.parse(fields),
    encounterId: 'encounter-1',
    patientId: 'patient-1',
  });
  deviceRequest.id = 'device-request-1';
  deviceRequest.authoredOn = '2026-10-15T14:30:00.000Z';
  if (dispensed) {
    deviceRequest.status = 'completed';
    deviceRequest.extension = [
      ...(deviceRequest.extension ?? []),
      makeDmeDispensedExtension(DISPENSER_ID, '2026-10-15T15:00:00.000Z'),
    ];
  }
  return deviceRequest;
};

describe('visit note DME section', () => {
  it('composes the order details, status and codes', () => {
    const composed = composeDmeOrders({
      dmeOrders: [parseDmeOrder(makeDeviceRequest(inHouseFields, true), {})],
    });
    expect(composed.dmeOrders).toEqual([
      {
        itemName: 'Wrist brace',
        lines: [
          'Status: Dispensed',
          'Qty: 2 | Laterality: LT (Left) | Modifier: NU (New Purchase) | Duration: 2 weeks',
          'HCPCS: L3908 - Wrist hand orthosis',
          'Dx: S52.501A Fracture of right radius',
        ],
      },
    ]);
  });

  it('names the third party of an external order', () => {
    const composed = composeDmeOrders({ dmeOrders: [parseDmeOrder(makeDeviceRequest(externalFields), {})] });
    expect(composed.dmeOrders[0].lines).toEqual(['Status: Print only', 'Qty: 1', 'Third party: Acme Medical Supply']);
  });

  it('renders each order and is omitted when there are none', () => {
    const drawText = vi.fn();
    const client = {
      drawText,
      drawSeparatedLine: vi.fn(),
      getTextDimensions: vi.fn().mockReturnValue({ height: 10, width: 100 }),
      getY: vi.fn().mockReturnValue(700),
      addNewPage: vi.fn(),
    } as unknown as PdfClient;
    const styles = {
      textStyles: { regularText: {}, alternativeRegularText: {}, subHeader: {}, blockSubHeader: {} },
      lineStyles: { separator: {} },
    } as unknown as PdfStyles;
    const section = createDmeOrdersSection<{ dmeOrders?: DmeOrdersData }>();
    const data: DmeOrdersData = { dmeOrders: [{ itemName: 'Wrist brace', lines: ['Status: Pending', 'Qty: 1'] }] };

    section.render(client, data, styles, {} as PdfAssets);

    expect(drawText.mock.calls.map((call) => call[0])).toEqual(['Wrist brace', 'Status: Pending', 'Qty: 1']);
    expect(section.shouldRender?.(data)).toBe(true);
    expect(section.shouldRender?.({ dmeOrders: [] })).toBe(false);
  });

  it('reads every page of the encounter orders, drops deleted ones and lists the oldest first', async () => {
    const order = (id: string, authoredOn: string, status: DeviceRequest['status'] = 'active'): DeviceRequest => ({
      ...makeDeviceRequest(inHouseFields),
      id,
      authoredOn,
      status,
    });
    const pages = [
      [order('newer', '2026-10-15T16:00:00.000Z')],
      [order('older', '2026-10-15T14:00:00.000Z'), order('deleted', '2026-10-15T15:00:00.000Z', 'revoked')],
    ];
    const search = vi.fn(async () => {
      const page = pages[search.mock.calls.length - 1];
      return {
        total: 3,
        entry: page.map((resource) => ({ resource, search: { mode: 'match' } })),
        unbundle: () => page,
      };
    });

    const orders = await getEncounterDmeOrders({ fhir: { search } } as unknown as Oystehr, 'encounter-1');

    expect(search).toHaveBeenCalledTimes(2);
    expect(orders.map((o) => o.id)).toEqual(['older', 'newer']);
  });

  it('is part of the note text', () => {
    const text = progressNoteDataToText({
      dmeOrders: { dmeOrders: [{ itemName: 'Wrist brace', lines: ['Status: Pending', 'Qty: 1'] }] },
    } as unknown as ProgressNoteData);
    expect(text).toContain('DURABLE MEDICAL EQUIPMENT:\n- Wrist brace | Status: Pending | Qty: 1');
  });
});

describe('DME order form PDF', () => {
  const patient: Patient = {
    resourceType: 'Patient',
    id: 'patient-1',
    name: [{ given: ['Oliver'], family: 'Black' }],
    birthDate: '1990-01-01',
    gender: 'male',
    telecom: [{ system: 'phone', value: '+12025550123' }],
    address: [{ line: ['12 Main St'], city: 'Springfield', state: 'IL', postalCode: '62701' }],
  };
  const practitioners: Practitioner[] = [
    {
      resourceType: 'Practitioner',
      id: PRACTITIONER_ID,
      name: [{ given: ['Jane'], family: 'Doe' }],
      identifier: [{ system: FHIR_IDENTIFIER_NPI, value: '1234567890' }],
    },
    { resourceType: 'Practitioner', id: DISPENSER_ID, name: [{ given: ['Max'], family: 'Nurse' }] },
  ];
  const oystehr = {
    fhir: { formatAddress: (address: Address) => [...(address.line ?? []), address.city].join(', ') },
  } as unknown as DmeOrderFormInput['oystehr'];
  const makeInput = (deviceRequest: DeviceRequest): DmeOrderFormInput => ({
    deviceRequest,
    patient,
    practitioners,
    location: { resourceType: 'Location', name: 'Downtown Clinic', address: { line: ['5 Clinic Ave'] } },
    timezone: 'America/New_York',
    oystehr,
  });

  it('composes an in-house dispensed order with proof of delivery and no third party', () => {
    const data = composeDmeOrderFormData(makeInput(makeDeviceRequest(inHouseFields, true)));
    expect(data.thirdParty).toBeUndefined();
    expect(data.inHouse).toBe(true);
    expect(data.patient).toMatchObject({ name: 'Black, Oliver', sex: 'Male', address: '12 Main St, Springfield' });
    expect(data.order).toMatchObject({
      orderedAt: '10/15/2026 10:30 AM',
      itemName: 'Wrist brace',
      billingCodes: ['L3908 - Wrist hand orthosis'],
      diagnoses: ['S52.501A - Fracture of right radius'],
      quantity: '2',
      laterality: 'LT (Left)',
      modifier: 'NU (New Purchase)',
      duration: '2 weeks',
      instructions: 'Wear at all times',
      fulfillment: 'Dispensed from in-house inventory',
      dispensed: '10/15/2026 11:00 AM by Max Nurse',
    });
    expect(data.orderingProvider).toEqual({ name: 'Jane Doe', npi: '1234567890', signatureName: 'Jane Doe' });
  });

  it('does not claim a pending in-house order was dispensed', () => {
    const data = composeDmeOrderFormData(makeInput(makeDeviceRequest(inHouseFields)));
    expect(data.inHouse).toBe(true);
    expect(data.order.fulfillment).toBe('To be dispensed from in-house inventory');
    expect(data.order.dispensed).toBeUndefined();
  });

  it('composes an external order with the third party and no proof of delivery', () => {
    const data = composeDmeOrderFormData(makeInput(makeDeviceRequest(externalFields)));
    expect(data.inHouse).toBe(false);
    expect(data.thirdParty).toEqual({
      name: 'Acme Medical Supply',
      address: '1 Supply Rd',
      phone: '555-0100',
      fax: '555-0101',
    });
    expect(data.order.fulfillment).toBe('Fulfilled by external site / third party');
    expect(data.order.dispensed).toBeUndefined();
  });

  it.each([
    ['in-house', makeDeviceRequest(inHouseFields, true)],
    ['pending in-house', makeDeviceRequest(inHouseFields)],
    ['external', makeDeviceRequest(externalFields)],
  ])('renders the %s order form onto one page', async (_label, deviceRequest) => {
    const doc = await PDFDocument.load(await createDmeOrderFormPdfBytes(makeInput(deviceRequest), ''));
    expect(doc.getPageCount()).toBe(1);
  });
});
