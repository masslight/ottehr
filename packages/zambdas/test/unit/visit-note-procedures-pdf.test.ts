import { describe, expect, it, vi } from 'vitest';
import { composeProcedures, createProceduresSection } from '../../src/shared/pdf/sections/visit-note/procedures';
import { PdfAssets, PdfClient, PdfStyles, Procedures } from '../../src/shared/pdf/types';

const composeFor = (procedure: Record<string, unknown>): Procedures => {
  return composeProcedures({
    allChartData: { chartData: { procedures: [procedure] } },
    appointmentPackage: { timezone: 'America/New_York' },
  } as never);
};

describe('composeProcedures — structured fields', () => {
  it('formats size, repair depth label, and infusion time with duration', () => {
    const composed = composeFor({
      procedureType: 'Laceration Repair',
      lengthCm: 3.2,
      repairDepth: 'subcutaneous-layered',
      infusionStartTime: '14:05',
      infusionStopTime: '14:47',
    });
    expect(composed.procedures?.[0]).toMatchObject({
      lengthCm: '3.2 cm',
      repairDepth: 'Subcutaneous — layered closure',
      infusionTime: '14:05–14:47 (42 min)',
    });
  });

  it('omits the structured fields when absent', () => {
    const composed = composeFor({ procedureType: 'EKG', bodySite: 'Chest' });
    expect(composed.procedures?.[0].lengthCm).toBeUndefined();
    expect(composed.procedures?.[0].repairDepth).toBeUndefined();
    expect(composed.procedures?.[0].infusionTime).toBeUndefined();
  });

  it('passes an unknown/legacy repair depth code through verbatim', () => {
    const composed = composeFor({ repairDepth: 'legacy-unknown-depth' });
    expect(composed.procedures?.[0].repairDepth).toBe('legacy-unknown-depth');
  });

  it('applies the cross-midnight rule to the infusion duration', () => {
    const composed = composeFor({ infusionStartTime: '23:50', infusionStopTime: '00:20' });
    expect(composed.procedures?.[0].infusionTime).toBe('23:50–00:20 (30 min)');
  });
});

describe('createProceduresSection — structured field lines', () => {
  const renderSection = (data: Procedures): string[] => {
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
    const section = createProceduresSection<{ procedures?: Procedures }>();
    section.render(client, data, styles, {} as PdfAssets);
    return drawText.mock.calls.map((call) => call[0]);
  };

  it('draws the three labeled lines when the fields are present', () => {
    const drawn = renderSection(
      composeFor({
        procedureType: 'Laceration Repair',
        lengthCm: 3.2,
        repairDepth: 'subcutaneous-layered',
        infusionStartTime: '14:05',
        infusionStopTime: '14:47',
      })
    );
    expect(drawn).toContain('Wound/lesion size: 3.2 cm');
    expect(drawn).toContain('Repair depth: Subcutaneous — layered closure');
    expect(drawn).toContain('Infusion time: 14:05–14:47 (42 min)');
  });

  it('draws no structured-field lines when the fields are absent', () => {
    const drawn = renderSection(composeFor({ procedureType: 'EKG', bodySite: 'Chest' }));
    expect(drawn.some((line) => line.startsWith('Wound/lesion size:'))).toBe(false);
    expect(drawn.some((line) => line.startsWith('Repair depth:'))).toBe(false);
    expect(drawn.some((line) => line.startsWith('Infusion time:'))).toBe(false);
    expect(drawn).toContain('Site/location: Chest');
  });
});
