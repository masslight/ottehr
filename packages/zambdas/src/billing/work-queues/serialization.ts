import { Basic, Extension, List } from 'fhir/r4b';
import { ottehrExtensionUrl } from 'utils/lib/fhir/systemUrls';
import { ClaimsListFiltersSchema, ClaimsListLayoutSchema } from 'utils/lib/types/data/billing/claims-list-view.schemas';
import { WorkQueue, WorkQueueSchema } from 'utils/lib/types/data/billing/work-queue.schemas';
import { BillingOystehr } from '../shared';

// ---------------------------------------------------------------------------
// Serialization between the work queue domain model and FHIR.
//
// All work queues live in one List (identified by its meta.tag) whose entries reference Basic
// resources contained within it, one Basic per queue — the same shape as the rules engines' rules
// (see ../rules-engine/serialization.ts). There are few enough queues that the whole List is always
// read at once and searched in memory. The queue's name and description are discrete extensions;
// its filters and grid layout are JSON strings on extensions; its owner is Basic.author.
// ---------------------------------------------------------------------------

export const WORK_QUEUE_TAG_SYSTEM = 'https://fhir.ottehr.com/billing/work-queues';
export const WORK_QUEUES_LIST_CODE = 'work-queues-list';
const WORK_QUEUES_LIST_TITLE = 'Billing work queues';
export const WORK_QUEUE_BASIC_CODE = 'work-queue';

export const WORK_QUEUE_NAME_EXTENSION_URL = ottehrExtensionUrl('work-queue-name');
export const WORK_QUEUE_DESCRIPTION_EXTENSION_URL = ottehrExtensionUrl('work-queue-description');
export const WORK_QUEUE_FILTERS_EXTENSION_URL = ottehrExtensionUrl('work-queue-filters');
export const WORK_QUEUE_LAYOUT_EXTENSION_URL = ottehrExtensionUrl('work-queue-layout');

export function workQueueToContainedBasic(queue: WorkQueue): Basic {
  return {
    resourceType: 'Basic',
    id: queue.id,
    code: { coding: [{ system: WORK_QUEUE_TAG_SYSTEM, code: WORK_QUEUE_BASIC_CODE }], text: queue.name },
    ...(queue.owner
      ? { author: { reference: `Practitioner/${queue.owner.practitionerId}`, display: queue.owner.name } }
      : {}),
    extension: [
      { url: WORK_QUEUE_NAME_EXTENSION_URL, valueString: queue.name },
      ...(queue.description ? [{ url: WORK_QUEUE_DESCRIPTION_EXTENSION_URL, valueString: queue.description }] : []),
      { url: WORK_QUEUE_FILTERS_EXTENSION_URL, valueString: JSON.stringify(queue.filters) },
      { url: WORK_QUEUE_LAYOUT_EXTENSION_URL, valueString: JSON.stringify(queue.layout) },
    ],
  };
}

// Undefined (and logged) for a Basic that doesn't hold a valid queue. Its Basic is left in the List
// untouched — saves replace only the queue they write — so the next save can't silently delete it.
export function containedBasicToWorkQueue(basic: Basic): WorkQueue | undefined {
  const ext = (url: string): Extension | undefined => basic.extension?.find((e) => e.url === url);
  const json = (url: string): unknown => {
    const raw = ext(url)?.valueString;
    return raw ? JSON.parse(raw) : {};
  };
  const practitionerId = basic.author?.reference?.startsWith('Practitioner/')
    ? basic.author.reference.slice('Practitioner/'.length)
    : undefined;
  try {
    return WorkQueueSchema.parse({
      id: basic.id,
      name: ext(WORK_QUEUE_NAME_EXTENSION_URL)?.valueString ?? basic.code?.text,
      description: ext(WORK_QUEUE_DESCRIPTION_EXTENSION_URL)?.valueString,
      owner: practitionerId ? { practitionerId, name: basic.author?.display ?? '' } : undefined,
      filters: ClaimsListFiltersSchema.parse(json(WORK_QUEUE_FILTERS_EXTENSION_URL)),
      layout: ClaimsListLayoutSchema.parse(json(WORK_QUEUE_LAYOUT_EXTENSION_URL)),
    });
  } catch (error) {
    console.error(`[work-queues] unparseable work queue (Basic/${basic.id}):`, error);
    return undefined;
  }
}

export function listToWorkQueues(list: List | undefined): WorkQueue[] {
  const containedById = new Map<string, Basic>();
  for (const resource of list?.contained ?? []) {
    if (resource.resourceType === 'Basic' && resource.id) containedById.set(resource.id, resource);
  }
  const queues: WorkQueue[] = [];
  for (const entry of list?.entry ?? []) {
    const reference = entry.item?.reference;
    if (!reference?.startsWith('#')) continue;
    const basic = containedById.get(reference.slice(1));
    const queue = basic && containedBasicToWorkQueue(basic);
    if (queue) queues.push(queue);
  }
  return queues;
}

// The List with `queue` written into it: replacing the queue's Basic when it's already there,
// otherwise appending it. Every other contained resource and entry is kept as it was.
export function withWorkQueue(list: List | undefined, queue: WorkQueue): List {
  const basic = workQueueToContainedBasic(queue);
  const base: List = list ?? {
    resourceType: 'List',
    status: 'current',
    mode: 'working',
    title: WORK_QUEUES_LIST_TITLE,
    meta: { tag: [{ system: WORK_QUEUE_TAG_SYSTEM, code: WORK_QUEUES_LIST_CODE }] },
  };
  const contained = base.contained ?? [];
  const exists = contained.some((r) => r.resourceType === 'Basic' && r.id === queue.id);
  return {
    ...base,
    contained: exists
      ? contained.map((r) => (r.resourceType === 'Basic' && r.id === queue.id ? basic : r))
      : [...contained, basic],
    entry: exists ? base.entry : [...(base.entry ?? []), { item: { reference: `#${queue.id}` } }],
  };
}

export async function findWorkQueuesLists(oystehr: BillingOystehr): Promise<List[]> {
  const result = await oystehr.fhir.search<List>({
    resourceType: 'List',
    params: [
      { name: '_tag', value: `${WORK_QUEUE_TAG_SYSTEM}|${WORK_QUEUES_LIST_CODE}` },
      { name: '_sort', value: '_id' },
    ],
  });
  return result.unbundle();
}

export async function findWorkQueuesList(oystehr: BillingOystehr): Promise<List | undefined> {
  return (await findWorkQueuesLists(oystehr))[0];
}
