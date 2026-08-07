import { describe, expect, test, vi } from 'vitest';
import { composeRadiology, createRadiologySection } from '../../src/shared/pdf/sections/discharge-summary/radiology';
import { PdfClient, PdfStyles, RadiologyData } from '../../src/shared/pdf/types';

// Despite living under sections/discharge-summary, this section is also used by the progress note PDF, so
// these cover the "Performed by" line in both documents.

const styles = {
  textStyles: { regularText: { fontSize: 16, spacing: 1 } },
  lineStyles: { separator: {} },
} as unknown as PdfStyles;

const drawnLines = (sectionData: RadiologyData): string[] => {
  const drawText = vi.fn();
  const client = { drawText, drawSeparatedLine: vi.fn() } as unknown as PdfClient;
  createRadiologySection<{ radiology?: RadiologyData }>().render(client, sectionData, styles, {} as never);
  return drawText.mock.calls.map((call) => call[0] as string);
};

describe('radiology PDF section', () => {
  test('composeRadiology carries the recorded performer into the section data', () => {
    const composed = composeRadiology({
      allChartData: {
        additionalChartData: {
          radiologyOrders: [
            {
              studyType: '71045 — X-Ray Chest',
              performedBy: { id: 'prac-1', name: 'Dr. Performer' },
              finalReport: btoa('No acute findings'),
            },
          ],
        },
      },
    } as never);

    expect(composed.radiology).toEqual([
      { name: '71045 — X-Ray Chest', performedBy: 'Dr. Performer', result: 'No acute findings' },
    ]);
  });

  test('renders a "Performed by" line for an order with a recorded performer', () => {
    expect(
      drawnLines({
        radiology: [{ name: '71045 — X-Ray Chest', performedBy: 'Dr. Performer', result: 'No acute findings' }],
      })
    ).toEqual(['Results:', '71045 — X-Ray Chest', 'Performed by: Dr. Performer', 'Final Read: No acute findings']);
  });

  test('omits the line when no performer was recorded', () => {
    expect(drawnLines({ radiology: [{ name: '71045 — X-Ray Chest', result: 'No acute findings' }] })).toEqual([
      'Results:',
      '71045 — X-Ray Chest',
      'Final Read: No acute findings',
    ]);
  });
});
