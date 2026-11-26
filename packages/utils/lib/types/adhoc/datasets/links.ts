import { z } from 'zod';
import { AdHocLayerMap, layerFields } from './dataset';

export interface AdHocDatasetLink {
  host: string;
  source: string;
  key: string;
  sourceKey: string;
  prefix: string;
}

export const DATASET_LINKS: readonly AdHocDatasetLink[] = [
  {
    host: 'encounters-comprehensive',
    source: 'billing-claims',
    key: 'encounterId',
    sourceKey: 'encounterId',
    prefix: 'claim',
  },
  { host: 'billing', source: 'billing-claims', key: 'encounterId', sourceKey: 'encounterId', prefix: 'claim' },
  {
    host: 'encounters-comprehensive',
    source: 'billing',
    key: 'encounterId',
    sourceKey: 'encounterId',
    prefix: 'billing',
  },
];

export const findLink = (host: string, source: string): AdHocDatasetLink | undefined =>
  DATASET_LINKS.find((link) => link.host === host && link.source === source);

export const linksOfHost = (host: string): AdHocDatasetLink[] => DATASET_LINKS.filter((link) => link.host === host);

export const LINK_BASE_LAYER = 'base';

export const linkColumnName = (prefix: string, field: string): string => {
  const next = field.charAt(prefix.length);
  if (field.startsWith(prefix) && next !== '' && next === next.toUpperCase() && next !== next.toLowerCase()) {
    return field;
  }
  return `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}`;
};

export const linkMatchedColumn = (link: Pick<AdHocDatasetLink, 'prefix'>): string => `${link.prefix}Matched`;

export const linkLayerId = (link: Pick<AdHocDatasetLink, 'source'>, layerId: string): string =>
  `${link.source}.${layerId}`;

export const sourceLayerIdOf = (link: Pick<AdHocDatasetLink, 'source'>, hostLayerId: string): string | undefined =>
  hostLayerId.startsWith(`${link.source}.`) ? hostLayerId.slice(link.source.length + 1) : undefined;

export function linkLayers(params: {
  link: AdHocDatasetLink;
  sourceLabel: string;
  sourceNoun: string;
  sourceBase: z.ZodObject<z.ZodRawShape>;
  sourceLayers: AdHocLayerMap;
  sourceInternalFields: readonly string[];
  hostBase: z.ZodObject<z.ZodRawShape>;
}): AdHocLayerMap {
  const { link, sourceLabel, sourceNoun: noun, sourceBase, sourceLayers, sourceInternalFields, hostBase } = params;
  const matched = z
    .boolean()
    .describe(
      `True when the visit has a ${noun} (its columns are filled). False = no ${noun}: its columns are null, not ` +
        `zero — leave such rows out of ${noun} rates, sums and averages.`
    );

  const linkSchema = (shape: z.ZodRawShape, fields: string[]): z.ZodObject<z.ZodRawShape> =>
    z.object({
      ...Object.fromEntries(
        fields.map((field) => {
          const schema = shape[field] as z.ZodTypeAny;
          const description = schema.description ?? '';
          return [
            linkColumnName(link.prefix, field),
            schema.nullable().describe(`${sourceLabel}: ${description} Null when the visit has no ${noun}.`),
          ];
        })
      ),
      [linkMatchedColumn(link)]: matched,
    });

  const out: AdHocLayerMap = {};

  const baseFields = Object.keys(sourceBase.shape).filter(
    (field) => !(field in hostBase.shape) && !sourceInternalFields.includes(field)
  );
  if (baseFields.length) {
    out[linkLayerId(link, LINK_BASE_LAYER)] = {
      label: `${sourceLabel}: summary`,
      description: `The visit's ${noun}: its main columns (at most one ${noun} per visit).`,
      default: false,
      key: link.key,
      schema: linkSchema(sourceBase.shape, baseFields),
    };
  }

  for (const [layerId, def] of Object.entries(sourceLayers)) {
    const fields = layerFields(def).filter((field) => !sourceInternalFields.includes(field));
    if (!fields.length) continue;
    out[linkLayerId(link, layerId)] = {
      label: `${sourceLabel}: ${def.label}`,
      description: `${def.description} (the visit's ${noun}; at most one per visit)`,
      default: false,
      key: link.key,
      schema: linkSchema(def.schema.shape, fields),
    };
  }

  return out;
}

export const linkFieldList = (
  link: AdHocDatasetLink,
  layers: AdHocLayerMap,
  sourceFields: readonly string[]
): string[] => {
  const present = new Set(
    Object.entries(layers)
      .filter(([id]) => sourceLayerIdOf(link, id) !== undefined)
      .flatMap(([, def]) => layerFields(def))
  );
  return sourceFields.map((field) => linkColumnName(link.prefix, field)).filter((column) => present.has(column));
};

export function linkColumnMap(params: {
  link: AdHocDatasetLink;
  sourceBase: z.ZodObject<z.ZodRawShape>;
  sourceLayers: AdHocLayerMap;
}): Map<string, string> {
  const { link, sourceBase, sourceLayers } = params;
  const out = new Map<string, string>();
  const fields = new Set([...Object.keys(sourceBase.shape), ...Object.values(sourceLayers).flatMap(layerFields)]);
  for (const field of fields) {
    const column = linkColumnName(link.prefix, field);
    const taken = out.get(column);
    if (taken !== undefined && taken !== field) {
      throw new Error(`Link ${link.host} ← ${link.source}: "${taken}" and "${field}" both become "${column}"`);
    }
    out.set(column, field);
  }
  return out;
}

export function requestedLinkColumns(params: {
  link: AdHocDatasetLink;
  hostLayers: AdHocLayerMap;
  requestedLayerIds: readonly string[];
  columnMap: Map<string, string>;
}): Array<{ field: string; column: string }> {
  const { link, hostLayers, requestedLayerIds, columnMap } = params;
  const matched = linkMatchedColumn(link);
  const columns = new Set(
    requestedLayerIds
      .filter((id) => sourceLayerIdOf(link, id) !== undefined && hostLayers[id])
      .flatMap((id) => layerFields(hostLayers[id]))
      .filter((column) => column !== matched)
  );
  return Array.from(columns).map((column) => {
    const field = columnMap.get(column);
    if (!field) throw new Error(`Link ${link.host} ← ${link.source}: no source field for column "${column}"`);
    return { field, column };
  });
}
