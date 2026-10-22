import Oystehr from '@oystehr/sdk';
import { Basic } from 'fhir/r4b';
import { PRIVATE_EXTENSION_BASE_URL } from 'utils/lib/fhir/constants';
import { measuredFetch } from 'utils/lib/types/adhoc/plan/fetch-mode';
import { DateRange } from 'utils/lib/types/adhoc/query/date-range';
import {
  SYSTEM_REPORT_CODE,
  SystemReport,
  SystemReportDefinition,
  SystemReportDefinitionSchema,
} from 'utils/lib/types/adhoc/system/system-report';
import { fetchAllPages } from './fhir';
import { SAVED_ADHOC_REPORT_SYSTEM } from './saved-adhoc-report';

// A system report is one FHIR Basic shaped like a saved ad-hoc report (same code system, the whole
// definition as one JSON extension) but under its OWN code, so the saved-report zambdas — which search
// and check by the saved-report code — never list, overwrite or delete one. Written only by the publish
// script with the practice's service credentials; no EHR role can write Basic directly.
const DEFINITION_EXTENSION_URL = `${PRIVATE_EXTENSION_BASE_URL}/system-report-definition`;
const SYSTEM_REPORT_CODE_PARAM = { name: 'code', value: `${SAVED_ADHOC_REPORT_SYSTEM}|${SYSTEM_REPORT_CODE}` };

export function makeSystemReportBasic(definition: SystemReportDefinition): Basic {
  return {
    resourceType: 'Basic',
    code: { coding: [{ system: SAVED_ADHOC_REPORT_SYSTEM, code: SYSTEM_REPORT_CODE }] },
    extension: [{ url: DEFINITION_EXTENSION_URL, valueString: JSON.stringify(definition) }],
  };
}

// null when the resource isn't a well-formed system report (missing id, unparseable blob, or a blob that
// doesn't match the definition schema) so callers can filter it out rather than surface a broken tile.
export function parseSystemReportBasic(basic: Basic): SystemReport | null {
  const raw = basic.extension?.find((e) => e.url === DEFINITION_EXTENSION_URL)?.valueString;
  if (!raw || !basic.id) return null;
  try {
    const parsed = SystemReportDefinitionSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    return { ...parsed.data, id: basic.id, updatedAt: basic.meta?.lastUpdated };
  } catch {
    return null;
  }
}

/** The stored report's name, read without validating the rest — so the publish script still finds and updates a report
 *  saved under an older shape of the definition. */
export function systemReportBasicName(basic: Basic): string | undefined {
  const raw = basic.extension?.find((e) => e.url === DEFINITION_EXTENSION_URL)?.valueString;
  try {
    const name: unknown = raw ? JSON.parse(raw).name : undefined;
    return typeof name === 'string' ? name : undefined;
  } catch {
    return undefined;
  }
}

/** The Basic behind a client-supplied id — only when it carries the system-report code. */
export async function findSystemReportBasic(oystehr: Oystehr, reportId: string): Promise<Basic | undefined> {
  const bundle = await oystehr.fhir.search<Basic>({
    resourceType: 'Basic',
    params: [{ name: '_id', value: reportId }, SYSTEM_REPORT_CODE_PARAM],
  });
  return bundle.unbundle()[0];
}

/** The Basic of the report published under `name`; the name sits inside the definition blob, so every system
 *  report is listed and read (there are a handful per practice). */
export async function findSystemReportBasicByName(oystehr: Oystehr, name: string): Promise<Basic | undefined> {
  return (await listSystemReportBasics(oystehr)).find((basic) => systemReportBasicName(basic) === name);
}

export async function listSystemReportBasics(oystehr: Oystehr): Promise<Basic[]> {
  const pageSize = 200;
  const basics: Basic[] = [];
  await fetchAllPages(async (offset, count) => {
    const bundle = await oystehr.fhir.search<Basic>({
      resourceType: 'Basic',
      params: [
        SYSTEM_REPORT_CODE_PARAM,
        { name: '_count', value: count.toString() },
        { name: '_offset', value: offset.toString() },
      ],
    });
    basics.push(...bundle.unbundle());
    return bundle;
  }, pageSize);
  return basics;
}

/**
 * What a run on this practice taught the report (fetch-mode.ts): the next run on a range no wider goes direct
 * when this one was fast. Mirrors what Report Studio writes into its file after every run.
 */
export async function recordSystemReportMeasurement(
  oystehr: Oystehr,
  reportId: string,
  totalMs: number,
  dateRange: DateRange | undefined
): Promise<void> {
  const basic = await findSystemReportBasic(oystehr, reportId);
  const report = basic && parseSystemReportBasic(basic);
  if (!basic || !report) return;
  const { id: _id, updatedAt: _updatedAt, ...definition } = report;
  await oystehr.fhir.update<Basic>({
    ...makeSystemReportBasic({ ...definition, ...measuredFetch(totalMs, dateRange) }),
    id: basic.id,
  });
}
