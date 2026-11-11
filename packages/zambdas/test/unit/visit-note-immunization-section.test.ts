import { ImmunizationOrder } from 'utils/lib/types/data/immunization/types';
import { describe, expect, it, vi } from 'vitest';
import {
  composeImmunizationOrders,
  createImmunizationOrdersSection,
} from '../../src/shared/pdf/sections/visit-note/immunization';
import { ImmunizationOrders, PdfClient, PdfStyles } from '../../src/shared/pdf/types';

// The section is the progress note's; the discharge summary now composes and renders it too (decision #10a).

const order = (name: string, status: string, administeredDateTime?: string): ImmunizationOrder =>
  ({
    id: `order-${name}`,
    status,
    encounterId: 'enc-1',
    details: {
      medication: { id: `med-${name}`, name },
      dose: '0.5',
      units: 'mL',
      route: '78421000',
      location: { name: 'Left Thigh', code: 'LT' },
      orderedProvider: { id: 'prov', name: 'Dr. Test' },
      orderedDateTime: '2026-11-10T14:00:00.000Z',
    },
    ...(administeredDateTime && {
      administrationDetails: {
        administeredDateTime,
        lot: 'L1',
        expDate: '2027-01-01',
        mvx: 'PMC',
        cvx: '120',
        ndc: '1',
      },
    }),
  }) as ImmunizationOrder;

const styles = {
  textStyles: { regularText: { fontSize: 12 }, alternativeRegularText: { fontSize: 12 } },
  lineStyles: { separator: {} },
} as unknown as PdfStyles;

const drawnLines = (sectionData: ImmunizationOrders): string[] => {
  const drawText = vi.fn();
  const client = { drawText, drawSeparatedLine: vi.fn() } as unknown as PdfClient;
  createImmunizationOrdersSection<{ immunizationOrders?: ImmunizationOrders }>().render(
    client,
    sectionData,
    styles,
    {} as never
  );
  return drawText.mock.calls.map((call) => call[0] as string);
};

describe('immunization PDF section', () => {
  it('composes only the vaccines given at the visit, with route, site and the time given in the practice zone', () => {
    const composed = composeImmunizationOrders({
      allChartData: {
        immunizationOrders: [
          order('Pentacel', 'administered', '2026-11-10T19:05:00.000Z'),
          order('RotaTeq', 'administered-partly', '2026-11-10T19:10:00.000Z'),
          order('Prevnar 20', 'pending'),
          order('MMR', 'cancelled'),
        ],
      },
      appointmentPackage: { timezone: 'America/New_York' },
    } as never);

    expect(composed.immunizationOrders).toEqual([
      'Pentacel - 0.5 mL / Intramuscular route - Left Thigh\n11/10/2026 02:05 PM',
      'RotaTeq - 0.5 mL / Intramuscular route - Left Thigh\n11/10/2026 02:10 PM',
    ]);
  });

  it('renders one line per vaccine given and leaves the section out when none were', () => {
    const section = createImmunizationOrdersSection<{ immunizationOrders?: ImmunizationOrders }>();

    expect(
      drawnLines({ immunizationOrders: ['Pentacel - 0.5 mL / Intramuscular route - Left Thigh\n11/10/2026 02:05 PM'] })
    ).toEqual(['Pentacel - 0.5 mL / Intramuscular route - Left Thigh\n11/10/2026 02:05 PM']);
    expect(section.shouldRender?.({ immunizationOrders: [] })).toBe(false);
    expect(section.shouldRender?.({ immunizationOrders: undefined })).toBe(false);
    expect(section.shouldRender?.({ immunizationOrders: ['x'] })).toBe(true);
  });
});
