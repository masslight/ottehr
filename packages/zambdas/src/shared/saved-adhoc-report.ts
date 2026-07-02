import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL, SavedAdHocReport, SavedAdHocReportDefinition } from 'utils';

// A saved ad-hoc report is one FHIR Basic resource: Basic.code classifies it (so list is a `code`
// search), and the whole definition rides as a single JSON blob in one extension. Practice-wide —
// no patient/author scoping — matching the rest of the admin configuration.
export const SAVED_ADHOC_REPORT_SYSTEM = `${PRIVATE_EXTENSION_BASE_URL}/saved-adhoc-report`;
export const SAVED_ADHOC_REPORT_CODE = 'saved-adhoc-report';
const DEFINITION_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/saved-adhoc-report-definition`;

export function makeSavedAdHocReportBasic(definition: SavedAdHocReportDefinition): Basic {
  return {
    resourceType: 'Basic',
    code: { coding: [{ system: SAVED_ADHOC_REPORT_SYSTEM, code: SAVED_ADHOC_REPORT_CODE }] },
    extension: [{ url: DEFINITION_EXTENSION_URL, valueString: JSON.stringify(definition) }],
  };
}

// Confirm a Basic id actually belongs to a saved ad-hoc report BEFORE updating or deleting it.
// The id comes from the client; without this an update/delete could overwrite or destroy an
// unrelated Basic (billing tag, support-dialog config, progress-note config). Searches by id
// scoped to the saved-report code, so a non-matching id returns no result.
export async function savedAdHocReportExists(oystehr: Oystehr, reportId: string): Promise<boolean> {
  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [
      { name: '_id', value: reportId },
      { name: 'code', value: `${SAVED_ADHOC_REPORT_SYSTEM}|${SAVED_ADHOC_REPORT_CODE}` },
    ],
  });
  return bundle.unbundle().length > 0;
}

// null when the resource isn't a well-formed saved report (missing id or unparseable blob) so
// callers can filter it out rather than surface a broken tile.
export function parseSavedAdHocReportBasic(basic: Basic): SavedAdHocReport | null {
  const raw = basic.extension?.find((e) => e.url === DEFINITION_EXTENSION_URL)?.valueString;
  if (!raw || !basic.id) return null;
  try {
    const definition = JSON.parse(raw) as SavedAdHocReportDefinition;
    if (!definition || typeof definition.code !== 'string') return null;
    return { ...definition, id: basic.id, updatedAt: basic.meta?.lastUpdated };
  } catch {
    return null;
  }
}
