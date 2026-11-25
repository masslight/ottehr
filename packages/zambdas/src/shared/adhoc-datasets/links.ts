import Oystehr from '@oystehr/sdk';
import { BILLING_LAYERS, BillingBaseRowSchema } from 'utils/lib/types/adhoc/datasets/billing';
import { BILLING_CLAIMS_LAYERS, BillingClaimsBaseRowSchema } from 'utils/lib/types/adhoc/datasets/billing-claims';
import { AdHocLayerMap, layerIncludeFlags } from 'utils/lib/types/adhoc/datasets/dataset';
import { joinRows } from 'utils/lib/types/adhoc/datasets/join';
import {
  AdHocDatasetLink,
  LINK_BASE_LAYER,
  linkColumnMap,
  linkMatchedColumn,
  linksOfHost,
  requestedLinkColumns,
  sourceLayerIdOf,
} from 'utils/lib/types/adhoc/datasets/links';
import { z } from 'zod';
import { fetchAdHocClaimRows } from '../../billing/adhoc/claims';
import { fetchAdHocBillingRows } from './billing';

type Row = Record<string, unknown>;

export interface LinkSourceContext {
  oystehr: Oystehr;
  billingOystehr: Oystehr;
  eraReadClient: () => Oystehr;
  dateRange: { start: string; end: string };
  deadline?: number;
}

export interface LinkSource {
  rowKey: string;
  base: z.ZodObject<z.ZodRawShape>;
  layers: AdHocLayerMap;
  fetch(ctx: LinkSourceContext, args: { keys: string[]; flags: Record<string, boolean> }): Promise<Row[]>;
}

export const LINK_SOURCES: Record<string, LinkSource> = {
  'billing-claims': {
    rowKey: 'claimId',
    base: BillingClaimsBaseRowSchema,
    layers: BILLING_CLAIMS_LAYERS,
    fetch: (ctx, { keys, flags }) =>
      fetchAdHocClaimRows(
        ctx.billingOystehr,
        { dateRange: ctx.dateRange, ...flags },
        { eraReadClient: ctx.eraReadClient(), encounterIds: keys, deadline: ctx.deadline }
      ),
  },
  billing: {
    rowKey: 'encounterId',
    base: BillingBaseRowSchema,
    layers: BILLING_LAYERS,
    fetch: (ctx, { flags }) =>
      fetchAdHocBillingRows(ctx.oystehr, { dateRange: ctx.dateRange, ...flags }, ctx.billingOystehr),
  },
};

export function requestedLinks(
  hostId: string,
  hostLayers: AdHocLayerMap,
  options: Record<string, boolean>
): Array<{ link: AdHocDatasetLink; layerIds: string[] }> {
  return linksOfHost(hostId)
    .map((link) => ({
      link,
      layerIds: Object.keys(options).filter(
        (id) => options[id] === true && hostLayers[id] !== undefined && sourceLayerIdOf(link, id) !== undefined
      ),
    }))
    .filter(({ layerIds }) => layerIds.length > 0);
}

export async function applyDatasetLinks<T extends Row>(params: {
  hostId: string;
  hostLayers: AdHocLayerMap;
  rows: T[];
  options: Record<string, boolean>;
  ctx: LinkSourceContext;
  sources?: Record<string, LinkSource>;
}): Promise<Array<T & Row>> {
  const { hostId, hostLayers, options, ctx, sources = LINK_SOURCES } = params;
  const links = requestedLinks(hostId, hostLayers, options);
  if (!links.length) return params.rows;

  const fetched = await Promise.all(
    links.map(async ({ link, layerIds }) => {
      const source = sources[link.source];
      if (!source) throw new Error(`No source fetcher for linked dataset "${link.source}"`);
      const selected = Object.fromEntries(
        layerIds
          .map((id) => sourceLayerIdOf(link, id)!)
          .filter((id) => id !== LINK_BASE_LAYER)
          .map((id) => [id, true])
      );
      const keys = Array.from(
        new Set(
          params.rows.map((row) => row[link.key]).filter((key): key is string => typeof key === 'string' && !!key)
        )
      );
      const startedAt = Date.now();
      const sourceRows = await source.fetch(ctx, {
        keys,
        flags: layerIncludeFlags(source.layers, selected) as Record<string, boolean>,
      });
      console.log(
        `[adhoc] link ${link.host} <- ${link.source}: layers=${JSON.stringify(layerIds)} keys=${keys.length} ` +
          `sourceRows=${sourceRows.length} ms=${Date.now() - startedAt}`
      );
      return sourceRows;
    })
  );

  let rows: Array<T & Row> = params.rows;
  links.forEach(({ link, layerIds }, index) => {
    const source = sources[link.source];
    const columns = requestedLinkColumns({
      link,
      hostLayers,
      requestedLayerIds: layerIds,
      columnMap: linkColumnMap({ link, sourceBase: source.base, sourceLayers: source.layers }),
    });
    const joined = joinRows({ host: rows, source: fetched[index], link, columns, sourceRowKey: source.rowKey });
    if (joined.duplicateKeys > 0) {
      console.warn(
        `[adhoc] link ${link.host} <- ${link.source}: ${joined.duplicateKeys} duplicate ${link.sourceKey} value(s); ` +
          `kept the row with the smallest ${source.rowKey}`
      );
    }
    const matched = joined.rows.filter((row) => row[linkMatchedColumn(link)] === true).length;
    console.log(`[adhoc] link ${link.host} <- ${link.source}: matched=${matched}/${joined.rows.length}`);
    rows = joined.rows as Array<T & Row>;
  });
  return rows;
}
