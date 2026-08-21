// Group a get-vitals response into the note's printed sections.
//
// Shared by the progress note and Easy Chart, because they print the same sections in the same order and a
// vital added to one list and not the other is a reading that was taken and then silently never appears on
// that note. The progress note used to spell this out as ten near-identical blocks.

import { VITAL_SECTION_ORDER } from 'utils/lib/easy-chart/vital-entry';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';

export interface VitalSectionGroup {
  field: string;
  label: string;
  readings: VitalsObservationDTO[];
}

export function groupVitalsBySection(vitals: GetVitalsResponseData | undefined): VitalSectionGroup[] {
  const byField = (vitals ?? {}) as Record<string, VitalsObservationDTO[] | undefined>;

  return [
    ...VITAL_SECTION_ORDER.map((section) => ({
      field: section.field as string,
      label: section.label,
      readings: byField[section.field] ?? [],
    })),
    // Anything the config does not name, kept rather than dropped: a vital field the chart starts returning
    // before this list learns about it would otherwise vanish from the note entirely, which is the worst kind
    // of missing — the reading was taken, and the note is silent about it.
    ...Object.keys(byField)
      .filter((field) => !VITAL_SECTION_ORDER.some((section) => (section.field as string) === field))
      .map((field) => ({ field, label: field, readings: byField[field] ?? [] })),
  ].filter((group) => group.readings.length > 0);
}
