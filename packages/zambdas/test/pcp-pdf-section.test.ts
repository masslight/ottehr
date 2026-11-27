import { Practitioner } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  composePrimaryCarePhysicianData,
  createPrimaryCarePhysicianSection,
} from '../src/shared/pdf/sections/primaryCarePhysician';
import { PdfAssets, PdfClient, PdfStyles, PrimaryCarePhysician } from '../src/shared/pdf/types';

const NO_PCP_LINE = "Patient doesn't have a PCP at this time";

const section = createPrimaryCarePhysicianSection<{ pcp?: PrimaryCarePhysician }>();

const renderSection = (physician?: Practitioner): { drawText: ReturnType<typeof vi.fn>; rows: unknown[][] } => {
  const drawText = vi.fn();
  const drawLabelValueRow = vi.fn();
  const client = { drawText, drawLabelValueRow } as unknown as PdfClient;
  const styles = { textStyles: { regular: {} } } as unknown as PdfStyles;
  section.render(client, composePrimaryCarePhysicianData({ physician }), styles, {} as PdfAssets);
  return { drawText, rows: drawLabelValueRow.mock.calls.map((call) => [call[0], call[1]]) };
};

describe('primary care physician PDF section', () => {
  it('prints the no-PCP line only when the absence of a PCP was confirmed', () => {
    const { drawText, rows } = renderSection({
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      active: false,
    });

    expect(drawText).toHaveBeenCalledWith(NO_PCP_LINE, expect.anything());
    expect(rows).toEqual([]);
  });

  it('prints empty PCP rows, not the no-PCP line, when nothing is on file', () => {
    const { drawText, rows } = renderSection(undefined);

    expect(drawText).not.toHaveBeenCalled();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every(([, value]) => value === '')).toBe(true);
  });

  it('prints a PCP recorded with only a first name without a missing last name', () => {
    const { rows } = renderSection({
      resourceType: 'Practitioner',
      id: 'primary-care-physician',
      active: true,
      name: [{ given: ['Olivia'] }],
    });

    expect(rows).toContainEqual(['PCP first and last name', 'Olivia']);
  });
});
