import Oystehr from '@oystehr/sdk';
import { Bundle, ChargeItemDefinition, Provenance } from 'fhir/r4b';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { VERSION_HISTORY_UNAVAILABLE_ERROR } from 'utils/lib/types/errors';

const VERSION_ACTIVITIES = new Set(['CREATE', 'UPDATE']);

export interface VersionSummary {
  versionId: string;
  timestamp: string;
}

export interface ProvenanceVersions {
  versions: VersionSummary[];
  malformed: boolean;
}

const newestFirst = (versions: VersionSummary[]): VersionSummary[] =>
  [...versions].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

export function versionsFromProvenance(provenances: Provenance[], resourceId: string): ProvenanceVersions {
  const reference = `ChargeItemDefinition/${resourceId}`;
  const versionedPrefix = `${reference}/_history/`;
  const versions = new Map<string, VersionSummary>();
  let malformed = false;

  for (const provenance of provenances) {
    const isVersionWrite = provenance.activity?.coding?.some(
      (coding) => coding.code !== undefined && VERSION_ACTIVITIES.has(coding.code)
    );
    if (!isVersionWrite) continue;

    for (const target of provenance.target ?? []) {
      const targetReference = target.reference;
      if (!targetReference || (targetReference !== reference && !targetReference.startsWith(`${reference}/`))) {
        continue;
      }
      const versionId = targetReference.startsWith(versionedPrefix)
        ? targetReference.slice(versionedPrefix.length)
        : '';
      if (!versionId || versionId.includes('/') || !provenance.recorded) {
        malformed = true;
        continue;
      }
      const existing = versions.get(versionId);
      if (!existing || new Date(provenance.recorded) < new Date(existing.timestamp)) {
        versions.set(versionId, { versionId, timestamp: provenance.recorded });
      }
    }
  }

  return { versions: newestFirst([...versions.values()]), malformed };
}

export function reconcileVersions(
  resourceId: string,
  provenance: ProvenanceVersions,
  newestPage: Bundle<ChargeItemDefinition>
): VersionSummary[] {
  const total = newestPage.total;
  const newest = newestPage.entry?.[0]?.resource?.meta;
  const listsNewest =
    newest?.versionId !== undefined && provenance.versions.some((version) => version.versionId === newest.versionId);

  if (!provenance.malformed && total !== undefined) {
    if (provenance.versions.length === total && (total === 0 || listsNewest)) {
      return provenance.versions;
    }
    if (provenance.versions.length === total - 1 && !listsNewest && newest?.versionId && newest.lastUpdated) {
      return [{ versionId: newest.versionId, timestamp: newest.lastUpdated }, ...provenance.versions];
    }
  }

  const provenanceSummary = `${provenance.versions.length} versions${
    provenance.malformed ? ' (some targets malformed)' : ''
  }`;
  const historySummary = `${total ?? 'an unknown number'} with newest ${newest?.versionId ?? 'unknown'} ${
    listsNewest ? 'listed' : 'not listed'
  }`;
  console.warn(
    `get-version-history: Provenance lists ${provenanceSummary} of ChargeItemDefinition/${resourceId}, ` +
      `but the history has ${historySummary}`
  );
  throw VERSION_HISTORY_UNAVAILABLE_ERROR;
}

export async function listChargeItemDefinitionVersions(
  oystehr: Oystehr,
  resourceId: string
): Promise<VersionSummary[]> {
  const [provenances, newestPage] = await Promise.all([
    getAllFhirSearchPages<Provenance>(
      {
        resourceType: 'Provenance',
        params: [{ name: 'target', value: `ChargeItemDefinition/${resourceId}` }],
      },
      oystehr
    ),
    oystehr.fhir.history<ChargeItemDefinition>({ resourceType: 'ChargeItemDefinition', id: resourceId, count: 1 }),
  ]);

  return reconcileVersions(resourceId, versionsFromProvenance(provenances, resourceId), newestPage);
}
