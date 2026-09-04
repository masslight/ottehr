import Oystehr from '@oystehr/sdk';
import { Device, Practitioner, Provenance } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { ReportDateWindowParams, ReportDateWindowParamsSchema } from 'utils/lib/types/data/billing/billing.schemas';
import {
  GetBillingProductivityReportResponse,
  ProductivityReportRow,
} from 'utils/lib/types/data/billing/billing.types';
import { CLAIM_PROVENANCE_ACTIVITY, CLAIM_PROVENANCE_AGENT_TYPE } from 'utils/lib/types/data/billing/claim-history';
import { fhirName } from '../../shared';
import { ReportDefinition } from '../framework/types';

const ACTOR_BATCH_SIZE = 100;
const CLAIM_ACTIVITY_SYSTEM = CLAIM_PROVENANCE_ACTIVITY.create.system;

type ProductivityReportPayload = Omit<GetBillingProductivityReportResponse, 'fromCache' | 'status'>;

export const productivityReport: ReportDefinition<ReportDateWindowParams, ProductivityReportPayload> = {
  kind: 'productivity',
  cacheVersion: 'v1',
  paramsSchema: ReportDateWindowParamsSchema,
  cacheKeyOf: (params) => `${params.dateFrom ?? 'all'}:${params.dateTo ?? 'all'}`,
  emptyPayload: () => ({ rows: [], totals: { actions: 0, claimsTouched: 0, actors: 0 }, generatedAt: '' }),
  compute: async (ctx, params, onProgress) => {
    await onProgress('tallying claim actions…');
    return { payload: await computeProductivityReport(ctx.oystehr, ctx.untaggedClient, params) };
  },
  summarize: (payload) => `productivity report cached (${payload.totals.actors} actors)`,
};

interface ActorAccumulator {
  actorRef: string;
  actorType: 'human' | 'system';
  actionsByActivity: Record<string, number>;
  totalActions: number;
  claimIds: Set<string>;
  lastActionAt: string;
}

async function computeProductivityReport(
  oystehr: Oystehr,
  untaggedClient: Oystehr,
  params: ReportDateWindowParams
): Promise<ProductivityReportPayload> {
  const searchParams = [{ name: '_elements', value: 'id,agent,activity,recorded,target' }];
  if (params.dateFrom) searchParams.push({ name: 'recorded', value: `ge${params.dateFrom}` });
  if (params.dateTo) searchParams.push({ name: 'recorded', value: `le${params.dateTo}` });

  const provenances = await getAllFhirSearchPages<Provenance>(
    { resourceType: 'Provenance', params: searchParams },
    oystehr
  );

  const byActor = new Map<string, ActorAccumulator>();
  const allClaimIds = new Set<string>();
  let totalActions = 0;
  for (const provenance of provenances) {
    // only claim-history entries; the billing store may hold other provenance kinds
    const activity = provenance.activity?.coding?.find((c) => c.system === CLAIM_ACTIVITY_SYSTEM);
    if (!activity?.code) continue;
    const agent =
      provenance.agent?.find(
        (candidate) => candidate.type?.coding?.some((c) => c.code === CLAIM_PROVENANCE_AGENT_TYPE.human.code)
      ) ?? provenance.agent?.[0];
    const actorRef = agent?.who?.reference;
    if (!actorRef) continue;
    const isHuman = agent?.type?.coding?.some((c) => c.code === CLAIM_PROVENANCE_AGENT_TYPE.human.code) ?? false;

    const acc = byActor.get(actorRef) ?? {
      actorRef,
      actorType: isHuman ? ('human' as const) : ('system' as const),
      actionsByActivity: {},
      totalActions: 0,
      claimIds: new Set<string>(),
      lastActionAt: '',
    };
    acc.actionsByActivity[activity.code] = (acc.actionsByActivity[activity.code] ?? 0) + 1;
    acc.totalActions += 1;
    for (const target of provenance.target ?? []) {
      const claimId = target.reference?.match(/^Claim\/(.+)$/)?.[1];
      if (claimId) {
        acc.claimIds.add(claimId);
        allClaimIds.add(claimId);
      }
    }
    if (provenance.recorded && provenance.recorded > acc.lastActionAt) acc.lastActionAt = provenance.recorded;
    byActor.set(actorRef, acc);
    totalActions += 1;
  }

  const nameByRef = await resolveActorNames(untaggedClient, [...byActor.keys()]);

  const rows: ProductivityReportRow[] = [...byActor.values()]
    .map((acc) => ({
      actorRef: acc.actorRef,
      actorName: nameByRef.get(acc.actorRef) ?? acc.actorRef,
      actorType: acc.actorType,
      actionsByActivity: acc.actionsByActivity,
      totalActions: acc.totalActions,
      claimsTouched: acc.claimIds.size,
      lastActionAt: acc.lastActionAt,
    }))
    .sort((a, b) => b.totalActions - a.totalActions);

  return {
    rows,
    totals: { actions: totalActions, claimsTouched: allClaimIds.size, actors: rows.length },
    generatedAt: DateTime.now().toUTC().toISO(),
  };
}

async function resolveActorNames(untaggedClient: Oystehr, actorRefs: string[]): Promise<Map<string, string>> {
  const idsByType = new Map<'Practitioner' | 'Device', string[]>();
  for (const ref of actorRefs) {
    const [type, id] = ref.split('/');
    if ((type === 'Practitioner' || type === 'Device') && id) {
      idsByType.set(type, [...(idsByType.get(type) ?? []), id]);
    }
  }

  const nameByRef = new Map<string, string>();
  for (const [type, ids] of idsByType) {
    for (let i = 0; i < ids.length; i += ACTOR_BATCH_SIZE) {
      const batch = ids.slice(i, i + ACTOR_BATCH_SIZE);
      try {
        const bundle = await untaggedClient.fhir.search<Practitioner | Device>({
          resourceType: type,
          params: [{ name: '_id', value: batch.join(',') }],
        });
        for (const resource of bundle.unbundle()) {
          const name =
            resource.resourceType === 'Practitioner' ? fhirName(resource) : resource.deviceName?.[0]?.name ?? 'System';
          if (resource.id) nameByRef.set(`${type}/${resource.id}`, name);
        }
      } catch (err) {
        console.warn(`Failed to resolve ${type} names:`, (err as Error)?.message);
      }
    }
  }
  return nameByRef;
}
