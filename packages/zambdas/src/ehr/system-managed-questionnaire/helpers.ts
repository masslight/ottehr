import Oystehr, { SearchParam } from '@oystehr/sdk';
import { Questionnaire } from 'fhir/r4b';
import { SYSTEM_MANAGED_QUESTIONNAIRE_TAG } from 'utils/lib/fhir/constants';
import { compareVersions } from '../../shared/fhir';

const { system, code } = SYSTEM_MANAGED_QUESTIONNAIRE_TAG;

/** Searches system-managed Questionnaires sharing a canonical url, optionally filtered by status. */
export async function searchSystemManagedByUrl(
  oystehr: Oystehr,
  url: string,
  status?: Questionnaire['status']
): Promise<Questionnaire[]> {
  const params: SearchParam[] = [
    { name: 'url', value: url },
    { name: '_tag', value: `${system}|${code}` },
  ];
  if (status) params.push({ name: 'status', value: status });

  return (await oystehr.fhir.search<Questionnaire>({ resourceType: 'Questionnaire', params })).unbundle();
}

/** Highest-version active system-managed Questionnaire for a url, or undefined if none. */
export async function findCurrentActiveSystemManaged(
  oystehr: Oystehr,
  url: string
): Promise<Questionnaire | undefined> {
  const actives = await searchSystemManagedByUrl(oystehr, url, 'active');
  if (actives.length === 0) return undefined;
  return actives.reduce((latest, q) =>
    compareVersions(q.version ?? '0.0.0', latest.version ?? '0.0.0') > 0 ? q : latest
  );
}

/** All draft system-managed Questionnaires for a url. */
export async function findSystemManagedDrafts(oystehr: Oystehr, url: string): Promise<Questionnaire[]> {
  return searchSystemManagedByUrl(oystehr, url, 'draft');
}
