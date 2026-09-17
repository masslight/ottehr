/**
 * An in-memory FHIR server for the chart tests: interprets the search URLs the chart code issues the way
 * the real server does, over a fixed set of resources, and records every request it sees.
 *
 * It is deliberately strict — a search parameter it does not understand throws — so a new search that
 * leans on a parameter the mock cannot honour fails loudly instead of quietly matching too much or too
 * little.
 */
import Oystehr from '@oystehr/sdk';
import { Bundle, Coding, Encounter, FhirResource } from 'fhir/r4b';

export interface RecordedFhirRequest {
  kind: 'batch' | 'search';
  urls: string[];
}

export interface GoldenFhirServer {
  oystehr: Oystehr;
  /** Every FHIR round trip in call order; a batch is one round trip with one URL per search. */
  recorded: RecordedFhirRequest[];
  reset: () => void;
}

type AnyResource = FhirResource & Record<string, any>;

const refId = (reference: string | undefined): string | undefined => reference?.split('/').at(-1);

/** Is `reference` the resource `value` names? `value` may be `Type/id` or a bare id. */
const referenceMatches = (reference: string | undefined, value: string): boolean =>
  reference !== undefined && (reference === value || (!value.includes('/') && refId(reference) === value));

/** Token search: `code`, `system|`, `system|code`. */
const codingMatchesToken = (coding: Coding, token: string): boolean => {
  if (!token.includes('|')) return coding.code === token;
  const [system, code] = token.split('|');
  if (system === '' && code === '') return false;
  return (system === '' || coding.system === system) && (code === '' || coding.code === code);
};

const anyCodingMatches = (codings: Coding[] | undefined, tokens: string[]): boolean =>
  (codings ?? []).some((coding) => tokens.some((token) => codingMatchesToken(coding, token)));

/** The references one `_include` / `_revinclude` leg follows, per `Type:searchParam`. */
const INCLUDE_LEGS: Record<string, (resource: AnyResource) => (string | undefined)[]> = {
  'MedicationStatement:source': (r) => [r.informationSource?.reference],
  'MedicationRequest:requester': (r) => [r.requester?.reference],
  'DiagnosticReport:based-on': (r) => (r.basedOn ?? []).map((ref: { reference?: string }) => ref.reference),
  'DiagnosticReport:result': (r) => (r.result ?? []).map((ref: { reference?: string }) => ref.reference),
  'DocumentReference:related': (r) => (r.context?.related ?? []).map((ref: { reference?: string }) => ref.reference),
};

const leg = (name: string, url: string): { type: string; follow: (resource: AnyResource) => string[] } => {
  const follow = INCLUDE_LEGS[name];
  if (!follow) throw new Error(`golden FHIR server: unsupported include "${name}" in ${url}`);
  return { type: name.split(':')[0], follow: (r) => follow(r).filter((ref): ref is string => ref !== undefined) };
};

/** The date a `_sort` key reads, per key. */
const SORT_KEYS: Record<string, (resource: AnyResource) => string | undefined> = {
  _lastUpdated: (r) => r.meta?.lastUpdated,
  effective: (r) => r.effectiveDateTime ?? r.effectivePeriod?.start,
  sent: (r) => r.sent,
};

const encounterReferences = (resource: AnyResource): string[] => [
  resource.encounter?.reference,
  ...(resource.context?.encounter ?? []).map((ref: { reference?: string }) => ref.reference),
];

export function createGoldenFhirServer(store: FhirResource[]): GoldenFhirServer {
  const recorded: RecordedFhirRequest[] = [];
  const resources = store as AnyResource[];

  const encountersById = (ids: string[]): Encounter[] =>
    resources.filter((r): r is Encounter => r.resourceType === 'Encounter' && ids.includes(r.id ?? ''));
  const subjectsOfEncounters = (ids: string[]): string[] =>
    encountersById(ids).flatMap((encounter) => (encounter.subject?.reference ? [encounter.subject.reference] : []));

  const runSearch = (url: string): Bundle<FhirResource> => {
    const [path, query = ''] = url.replace(/^\//, '').split('?');
    const resourceType = path;
    const params = query
      .split('&')
      .filter(Boolean)
      .map((pair): [string, string] => {
        const index = pair.indexOf('=');
        return [pair.slice(0, index), pair.slice(index + 1)];
      });

    let matches = resources.filter((r) => r.resourceType === resourceType);
    let sort: string | undefined;
    let count: number | undefined;
    let summaryCount = false;
    const includes: string[] = [];
    const iterateIncludes: string[] = [];
    const revincludes: string[] = [];

    for (const [name, value] of params) {
      const values = value.split(',');
      switch (name) {
        case '_id':
          matches = matches.filter((r) => values.includes(r.id ?? ''));
          break;
        case 'encounter':
          matches = matches.filter((r) => encounterReferences(r).some((ref) => referenceMatches(ref, value)));
          break;
        case 'context':
          matches = matches.filter((r) => referenceMatches(r.context?.reference, value));
          break;
        case 'subject:Patient._has:Encounter:subject:_id':
        case 'patient:Patient._has:Encounter:subject:_id': {
          const field = name.startsWith('subject') ? 'subject' : 'patient';
          const patients = subjectsOfEncounters(values);
          matches = matches.filter((r) => patients.includes(r[field]?.reference));
          break;
        }
        case '_has:Encounter:subject:_id': {
          if (resourceType !== 'Patient') throw new Error(`golden FHIR server: ${name} is only for Patient (${url})`);
          const patients = subjectsOfEncounters(values);
          matches = matches.filter((r) => patients.includes(`Patient/${r.id}`));
          break;
        }
        case '_has:Encounter:participant:_id': {
          if (resourceType !== 'Practitioner') {
            throw new Error(`golden FHIR server: ${name} is only for Practitioner (${url})`);
          }
          const participants = encountersById(values).flatMap((encounter) =>
            (encounter.participant ?? []).flatMap((p) => (p.individual?.reference ? [p.individual.reference] : []))
          );
          matches = matches.filter((r) => participants.includes(`Practitioner/${r.id}`));
          break;
        }
        case '_tag':
          matches = matches.filter((r) => anyCodingMatches(r.meta?.tag, values));
          break;
        case 'status':
          matches = matches.filter((r) => values.includes(r.status));
          break;
        case 'type':
          matches = matches.filter((r) => anyCodingMatches(r.type?.coding, values));
          break;
        case 'code':
          matches = matches.filter((r) => anyCodingMatches(r.code?.coding, values));
          break;
        case '_sort':
          sort = value;
          break;
        case '_count':
          count = Number(value);
          break;
        case '_summary':
          if (value !== 'count') throw new Error(`golden FHIR server: unsupported _summary=${value} in ${url}`);
          summaryCount = true;
          break;
        case '_include':
          includes.push(value);
          break;
        case '_include:iterate':
          iterateIncludes.push(value);
          break;
        case '_revinclude':
          revincludes.push(value);
          break;
        default:
          throw new Error(`golden FHIR server: unsupported search parameter "${name}" in ${url}`);
      }
    }

    if (sort !== undefined) {
      const descending = sort.startsWith('-');
      const read = SORT_KEYS[sort.replace(/^-/, '')];
      if (!read) throw new Error(`golden FHIR server: unsupported _sort=${sort} in ${url}`);
      // Array.prototype.sort is stable: equal or missing keys keep store order.
      matches = [...matches].sort((a, b) => {
        const [x, y] = [read(a) ?? '', read(b) ?? ''];
        return descending ? y.localeCompare(x) : x.localeCompare(y);
      });
    }
    if (count !== undefined) matches = matches.slice(0, count);

    if (summaryCount) {
      return { resourceType: 'Bundle', type: 'searchset', total: matches.length };
    }

    // Includes resolve against the whole store; `_include:iterate` keeps following until nothing new turns up.
    const included: AnyResource[] = [];
    const seen = new Set<AnyResource>(matches);
    const add = (resource: AnyResource | undefined): boolean => {
      if (!resource || seen.has(resource)) return false;
      seen.add(resource);
      included.push(resource);
      return true;
    };
    const follow = (from: AnyResource[], names: string[]): boolean =>
      names.some((name) => {
        const { type, follow: references } = leg(name, url);
        return from
          .filter((r) => r.resourceType === type)
          .flatMap(references)
          .map((ref) => add(resources.find((r) => `${r.resourceType}/${r.id}` === ref)))
          .some(Boolean);
      });
    follow(matches, includes);
    let frontier: AnyResource[] = [...matches, ...included];
    while (iterateIncludes.length > 0 && frontier.length > 0) {
      const before = included.length;
      follow(frontier, iterateIncludes);
      frontier = included.slice(before);
    }
    revincludes.forEach((name) => {
      const { type, follow: references } = leg(name, url);
      const targets = new Set(matches.map((r) => `${r.resourceType}/${r.id}`));
      resources.filter((r) => r.resourceType === type && references(r).some((ref) => targets.has(ref))).forEach(add);
    });

    return {
      resourceType: 'Bundle',
      type: 'searchset',
      total: matches.length,
      entry: [
        ...matches.map((resource) => ({ resource: structuredClone(resource), search: { mode: 'match' as const } })),
        ...included.map((resource) => ({ resource: structuredClone(resource), search: { mode: 'include' as const } })),
      ],
    };
  };

  const oystehr = {
    fhir: {
      batch: async ({ requests }: { requests: { method: string; url: string }[] }): Promise<Bundle<FhirResource>> => {
        recorded.push({ kind: 'batch', urls: requests.map((r) => r.url) });
        return {
          resourceType: 'Bundle',
          type: 'batch-response',
          entry: requests.map((request) => {
            if (request.method !== 'GET') {
              throw new Error(`golden FHIR server: only GET is supported, got ${request.method} ${request.url}`);
            }
            return {
              response: { status: '200', outcome: { resourceType: 'OperationOutcome', id: 'ok', issue: [] } },
              resource: runSearch(request.url) as FhirResource,
            };
          }),
        };
      },
      search: async ({
        resourceType,
        params,
      }: {
        resourceType: string;
        params: { name: string; value: string | string[] }[];
      }): Promise<Bundle<FhirResource> & { unbundle: () => FhirResource[] }> => {
        const url = `/${resourceType}?${params
          .map((p) => `${p.name}=${Array.isArray(p.value) ? p.value.join(',') : p.value}`)
          .join('&')}`;
        recorded.push({ kind: 'search', urls: [url] });
        const bundle = runSearch(url);
        return { ...bundle, unbundle: () => (bundle.entry ?? []).flatMap((e) => (e.resource ? [e.resource] : [])) };
      },
    },
  } as unknown as Oystehr;

  return {
    oystehr,
    recorded,
    reset: () => {
      recorded.length = 0;
    },
  };
}
