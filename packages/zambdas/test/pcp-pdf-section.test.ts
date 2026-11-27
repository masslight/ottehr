import { Practitioner } from 'fhir/r4b';
import { describe, expect, it, vi } from 'vitest';
import {
  composePrimaryCarePhysicianData,
  createPrimaryCarePhysicianSection,
} from '../src/shared/pdf/sections/primaryCarePhysician';
import { PdfAssets, PdfClient, PdfStyles, PrimaryCarePhysician } from '../src/shared/pdf/types';

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
