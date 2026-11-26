import Oystehr from '@oystehr/sdk';
import { Address, Coverage, DeviceRequest, Location, Patient, Practitioner, RelatedPerson } from 'fhir/r4b';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { FHIR_IDENTIFIER_NPI } from 'utils/lib/fhir/constants';
import { DmeOrderFields, DmeOrderFieldsSchema } from 'utils/lib/types/api/dme.types';
import { describe, expect, it, vi } from 'vitest';
import { makeDmeOrderFormVersion } from '../../src/ehr/dme/get-dme-order-pdf/helpers';
import { makeDmeDeviceRequest, makeDmeDispensedExtension, parseDmeOrder } from '../../src/shared/dme';
import { makeOrderFormSourceVersion, OrderFormSource } from '../../src/shared/order-form-version';
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
  it('composes the order details, status, codes and instructions', () => {
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
          'Instructions: Wear at all times',
        ],
      },
    ]);
  });

  it('names the third party of an external order', () => {
    const composed = composeDmeOrders({ dmeOrders: [parseDmeOrder(makeDeviceRequest(externalFields), {})] });
    expect(composed.dmeOrders[0].lines).toEqual(['Status: Ordered', 'Qty: 1', 'Third party: Acme Medical Supply']);
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
  const parent: RelatedPerson = {
    resourceType: 'RelatedPerson',
    id: 'coverageSubscriber',
    patient: { reference: 'Patient/patient-1' },
    name: [{ given: ['Emma'], family: 'Black' }],
    birthDate: '1965-03-09',
    address: [{ line: ['40 Oak Ln'], city: 'Chicago' }],
  };
  const coverage = (planName: string, memberId: string, relationship: string): Coverage => ({
    resourceType: 'Coverage',
    status: 'active',
    beneficiary: { reference: 'Patient/patient-1' },
    payor: [{ reference: 'Organization/payer-1' }],
    subscriberId: memberId,
    relationship: { coding: [{ code: relationship.toLowerCase(), display: relationship }] },
    class: [
      {
        type: { coding: [{ system: 'http://terminology.hl7.org/CodeSystem/coverage-class', code: 'plan' }] },
        value: '60054',
        name: planName,
      },
    ],
  });
  const twoCoverages: DmeOrderFormInput['coverages'] = {
    primary: coverage('Blue Cross', 'BC-123', 'Self'),
    primarySubscriber: patient as unknown as RelatedPerson,
    secondary: coverage('My Health', 'MH-555', 'Child'),
    secondarySubscriber: parent,
  };
  const location: Location = {
    resourceType: 'Location',
    name: 'Downtown Clinic',
    address: { line: ['5 Clinic Ave'] },
    telecom: [
      { system: 'phone', value: '(123) 456-7815' },
      { system: 'fax', value: '(098) 765-4321' },
    ],
  };
  const makeInput = (deviceRequest: DeviceRequest, overrides: Partial<DmeOrderFormInput> = {}): DmeOrderFormInput => ({
    deviceRequest,
    patient,
    practitioners,
    location,
    timezone: 'America/New_York',
    coverages: {},
    oystehr,
    ...overrides,
  });

  type DrawnText = { text: string; x: number; y: number; page: PDFPage };
  const drawnText = async (input: DmeOrderFormInput): Promise<DrawnText[]> => {
    const drawText = vi.spyOn(PDFPage.prototype, 'drawText');
    try {
      await createDmeOrderFormPdfBytes(input, '');
      return drawText.mock.calls.map(([text, options], index) => ({
        text: text.trimEnd(),
        x: options?.x ?? 0,
        y: options?.y ?? 0,
        page: drawText.mock.contexts[index] as PDFPage,
      }));
    } finally {
      drawText.mockRestore();
    }
  };
  const find = (drawn: DrawnText[], text: string): DrawnText => {
    const line = drawn.find((entry) => entry.text === text);
    expect(line, `"${text}" was not drawn`).toBeDefined();
    return line!;
  };

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

  it('lists both insurances with their subscribers, primary first', () => {
    const data = composeDmeOrderFormData(makeInput(makeDeviceRequest(inHouseFields), { coverages: twoCoverages }));
    expect(data.insurance).toEqual({
      billClass: 'Third-Party Bill (T)',
      coverages: [
        {
          rank: 'Primary',
          name: 'Blue Cross',
          subscriberNumber: 'BC-123',
          subscriberName: 'Black, Oliver',
          subscriberDob: '01/01/1990',
          relationship: 'Self',
          address: '12 Main St, Springfield',
        },
        {
          rank: 'Secondary',
          name: 'My Health',
          subscriberNumber: 'MH-555',
          subscriberName: 'Black, Emma',
          subscriberDob: '03/09/1965',
          relationship: 'Child',
          address: '40 Oak Ln, Chicago',
        },
      ],
    });
  });

  it('bills the patient when they have no insurance', () => {
    const data = composeDmeOrderFormData(makeInput(makeDeviceRequest(inHouseFields)));
    expect(data.insurance).toEqual({ billClass: 'Patient Bill (P)', coverages: [] });
  });

  it('bills a third party when the only insurance left is the secondary', () => {
    const { secondary, secondarySubscriber } = twoCoverages;
    const data = composeDmeOrderFormData(
      makeInput(makeDeviceRequest(inHouseFields), { coverages: { secondary, secondarySubscriber } })
    );
    expect(data.insurance.billClass).toBe('Third-Party Bill (T)');
    expect(data.insurance.coverages.map((coverage) => coverage.rank)).toEqual(['Secondary']);
  });

  it("carries the ordering provider's credentials", () => {
    const data = composeDmeOrderFormData(
      makeInput(makeDeviceRequest(inHouseFields), {
        practitioners: [{ ...practitioners[0], name: [{ given: ['Jane'], family: 'Doe', suffix: ['MD'] }] }],
      })
    );
    expect(data.orderingProvider.credentials).toBe('MD');
  });

  it('asks for results by fax under the clinic phone and signs with the credentials beside the name', async () => {
    const drawn = await drawnText(
      makeInput(makeDeviceRequest(inHouseFields), {
        practitioners: [{ ...practitioners[0], name: [{ given: ['Jane'], family: 'Doe', suffix: ['MD'] }] }],
      })
    );

    const phone = find(drawn, 'Phone: (123) 456-7815');
    const faxLabel = find(drawn, 'Please fax results to:');
    const faxNumber = find(drawn, '(098) 765-4321');
    expect(faxLabel.y).toBeLessThan(phone.y);
    expect(faxNumber.y).toBeLessThan(faxLabel.y);
    expect(drawn.map((entry) => entry.text)).not.toContain('Fax: (098) 765-4321');

    const signature = find(drawn, 'Jane Doe');
    const credentials = find(drawn, ', MD');
    expect(credentials.y).toBe(signature.y);
    expect(credentials.x).toBeGreaterThan(signature.x);
  });

  it('leaves the same room under the signature whether or not it carries credentials', async () => {
    const roomUnderSignature = async (suffix?: string[]): Promise<number> => {
      const drawn = await drawnText(
        makeInput(makeDeviceRequest(inHouseFields), {
          practitioners: [{ ...practitioners[0], name: [{ given: ['Jane'], family: 'Doe', suffix }] }],
        })
      );
      return find(drawn, 'Jane Doe').y - find(drawn, 'Provider Signature').y;
    };

    expect(await roomUnderSignature(['MD'])).toBe(await roomUnderSignature());
  });

  it('draws each insurance as a column in the order of the design, primary on the left', async () => {
    const drawn = await drawnText(makeInput(makeDeviceRequest(inHouseFields), { coverages: twoCoverages }));
    const fieldLabels = [
      'Subscriber Number:',
      'Subscriber Name:',
      'Subscriber DOB:',
      'Relation to Subscriber:',
      'Address:',
    ];
    const column = (heading: string): { x: number; y: number }[] => {
      const top = find(drawn, heading);
      const fields = fieldLabels.map((label) => drawn.find((entry) => entry.text === label && entry.x === top.x)!);
      return [top, ...fields];
    };
    const descending = (positions: { y: number }[]): void =>
      expect(positions.map(({ y }) => y)).toEqual(positions.map(({ y }) => y).sort((a, b) => b - a));

    const primary = column('Primary Insurance Name:');
    const secondary = column('Secondary Insurance Name:');
    descending([find(drawn, 'Bill Class:'), ...primary]);
    descending(secondary);
    expect(secondary[0].y).toBe(primary[0].y);
    expect(secondary[0].x).toBeGreaterThan(primary[0].x);
  });

  it('keeps an external order with two insurances on one page', async () => {
    const doc = await PDFDocument.load(
      await createDmeOrderFormPdfBytes(makeInput(makeDeviceRequest(externalFields), { coverages: twoCoverages }), '')
    );
    expect(doc.getPageCount()).toBe(1);
  });

  it.each([
    ['in-house', makeDeviceRequest(inHouseFields, true)],
    ['pending in-house', makeDeviceRequest(inHouseFields)],
    ['external', makeDeviceRequest(externalFields)],
  ])('renders the %s order form onto one page', async (_label, deviceRequest) => {
    const doc = await PDFDocument.load(await createDmeOrderFormPdfBytes(makeInput(deviceRequest), ''));
    expect(doc.getPageCount()).toBe(1);
  });

  it('keeps the provider signature together when a long provider name wraps', async () => {
    const family = 'Featherstonehaugh Montgomery Wellington Smythe Ashworth Blackwood Carrington Davenport Ellsworth';
    const drawn = await drawnText(
      makeInput(makeDeviceRequest(inHouseFields, true), {
        coverages: twoCoverages,
        practitioners: [{ ...practitioners[0], name: [{ given: ['Jane'], family, suffix: ['MD'] }] }],
      })
    );
    const pageOf = (text: string): PDFPage => find(drawn, text).page;
    const credentialsIndex = drawn.findIndex((entry) => entry.text === ', MD');
    const lastSignatureLine = drawn[credentialsIndex - 1];

    expect(pageOf('Provider Signature')).toBe(pageOf('Ordering Provider:'));
    expect(lastSignatureLine.text).not.toBe(`Jane ${family}`);
    expect(drawn[credentialsIndex].y).toBe(lastSignatureLine.y);
    expect(drawn[credentialsIndex].x).toBeGreaterThan(lastSignatureLine.x);
  });

  it('moves the proof of delivery to the next page whole rather than splitting it', async () => {
    const drawn = await drawnText(makeInput(makeDeviceRequest(inHouseFields, true), { coverages: twoCoverages }));
    const pageOf = (text: string): PDFPage => find(drawn, text).page;

    expect(new Set(drawn.map((entry) => entry.page)).size).toBe(2);
    expect(pageOf('Provider Signature')).toBe(pageOf('Ordering Provider:'));
    expect(pageOf('Proof of Delivery:')).not.toBe(pageOf('Ordering Provider:'));
    expect(pageOf('Date:')).toBe(pageOf('Proof of Delivery:'));
  });
});

describe('DME order form version', () => {
  const sources: OrderFormSource[] = [
    { resourceType: 'DeviceRequest', id: 'device-request-1', meta: { versionId: '3' } },
    { resourceType: 'Coverage', id: 'coverage-1', meta: { versionId: '1' } },
  ];

  it('differs from what forms of the earlier layout were stamped with, so they are drawn again', () => {
    const version = makeDmeOrderFormVersion(sources);
    expect(version).toBeDefined();
    expect(version).not.toBe(makeOrderFormSourceVersion(sources));
  });

  it('is undefined while a source is unversioned', () => {
    expect(makeDmeOrderFormVersion([...sources, { resourceType: 'Account', id: 'account-1' }])).toBeUndefined();
  });
});
