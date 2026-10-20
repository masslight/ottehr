import { describe, expect, test } from 'vitest';
import { composeMedications } from '../../src/shared/pdf/sections/visit-note/medicationsInfo';

// composeMedications feeds the "Current medications" section of both the progress note and the
// discharge summary, so these cover the medication list of both documents.

const medication = (name: string, status: 'active' | 'completed'): unknown => ({
  resourceId: `${name}-id`,
  id: name,
  name,
  type: 'scheduled',
  status,
  intakeInfo: {},
});

describe('visit note medications section', () => {
  test('lists the medications the patient is still taking', () => {
    const composed = composeMedications({
      allChartData: { chartData: { medications: [medication('Ibuprofen 200 mg', 'active')] } },
    } as never);

    expect(composed.medications).toEqual(['Ibuprofen 200 mg']);
  });

  // Removing a medication recorded in another encounter patches its status to 'completed' instead
  // of deleting it, and the patient-scoped chart-data search returns it for every later encounter.
  test('omits medications that were removed from the chart', () => {
    const composed = composeMedications({
      allChartData: {
        chartData: {
          medications: [medication('Ibuprofen 200 mg', 'active'), medication('Acetaminophen 500 mg', 'completed')],
        },
      },
    } as never);

    expect(composed.medications).toEqual(['Ibuprofen 200 mg']);
  });

  test('renders an empty list when every medication was removed', () => {
    const composed = composeMedications({
      allChartData: { chartData: { medications: [medication('Acetaminophen 500 mg', 'completed')] } },
    } as never);

    expect(composed.medications).toEqual([]);
  });
});
