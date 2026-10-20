import { z } from 'zod';
import { CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES } from '../../../helpers/rcm/constants';
import { ClaimSortSchema, ExportBillingClaimsInput } from './billing.schemas';

// A view of the claims list: the filters that pick its claims and the grid layout (column order,
// sort) they're shown in — what the claims list screen edits, and what can be kept to open it again.

const nonEmptyString = z.string().trim().min(1);
const stringList = z.array(nonEmptyString);

// A chosen option, kept with its display name so the filter can be shown again without a lookup.
const NamedOptionSchema = z.object({ id: nonEmptyString, name: z.string() });

// The claims list filters, in the shape the filter bar edits them. Every list matches a claim with
// any one of its values; an empty or missing list doesn't filter.
export const ClaimsListFiltersSchema = z.object({
  searchText: z.string().trim().optional(),
  arStage: stringList.optional(),
  status: stringList.optional(),
  tag: stringList.optional(),
  type: z.array(z.enum(CODE_SYSTEM_CLAIM_TYPE_CODE_NAMES)).optional(),
  service: stringList.optional(),
  createdFrom: z.string().optional(),
  createdTo: z.string().optional(),
  serviceDateFrom: z.string().optional(),
  serviceDateTo: z.string().optional(),
  payers: z.array(NamedOptionSchema.extend({ payerId: nonEmptyString })).optional(),
  nonInsuranceOrgs: z.array(NamedOptionSchema).optional(),
  patients: z.array(NamedOptionSchema).optional(),
});

// How the claims grid is laid out. Columns missing from columnOrder (e.g. added after the layout was
// kept) keep their default place after the ordered ones.
export const ClaimsListLayoutSchema = z.object({
  columnOrder: stringList.optional(),
  sort: ClaimSortSchema.optional(),
});

export type ClaimsListFilters = z.output<typeof ClaimsListFiltersSchema>;
export type ClaimsListLayout = z.output<typeof ClaimsListLayoutSchema>;

export interface ClaimsListViewConfig {
  filters: ClaimsListFilters;
  layout: ClaimsListLayout;
}

// The claim search the filters stand for.
export function claimsListFiltersToSearchInput(filters: ClaimsListFilters): ExportBillingClaimsInput {
  const params: ExportBillingClaimsInput = {};
  const list = <T>(values: T[] | undefined): T[] | undefined => (values?.length ? values : undefined);

  if (filters.searchText) params.searchText = filters.searchText;
  params.arStage = list(filters.arStage);
  params.status = list(filters.status);
  params.tag = list(filters.tag);
  params.type = list(filters.type);
  params.service = list(filters.service);
  if (filters.createdFrom) params.createdFrom = filters.createdFrom;
  if (filters.createdTo) params.createdTo = filters.createdTo;
  if (filters.serviceDateFrom) params.serviceDateFrom = filters.serviceDateFrom;
  if (filters.serviceDateTo) params.serviceDateTo = filters.serviceDateTo;
  params.payerId = list(filters.payers?.map((p) => p.payerId));
  params.nonInsurancePayerId = list(filters.nonInsuranceOrgs?.map((o) => o.id));
  params.patientId = list(filters.patients?.map((p) => p.id));

  return Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined)
  ) as ExportBillingClaimsInput;
}

// The filters with empty values dropped and keys in one fixed order, so two equivalent filter sets
// serialize identically.
export function normalizeClaimsListFilters(filters: ClaimsListFilters): ClaimsListFilters {
  const keys = Object.keys(ClaimsListFiltersSchema.shape) as (keyof ClaimsListFilters)[];
  const normalized: Record<string, unknown> = {};
  for (const key of keys) {
    const value = key === 'searchText' ? filters.searchText?.trim() : filters[key];
    if (value === undefined || value === '' || (Array.isArray(value) && value.length === 0)) continue;
    normalized[key] = value;
  }
  return normalized as ClaimsListFilters;
}

export function normalizeClaimsListLayout(layout: ClaimsListLayout): ClaimsListLayout {
  return {
    ...(layout.columnOrder?.length ? { columnOrder: layout.columnOrder } : {}),
    ...(layout.sort ? { sort: { field: layout.sort.field, direction: layout.sort.direction } } : {}),
  };
}

// Whether two views show the same claims the same way (e.g. to tell a kept view has unsaved changes).
export function isSameClaimsListView(a: ClaimsListViewConfig, b: ClaimsListViewConfig): boolean {
  const serialize = (view: ClaimsListViewConfig): string =>
    JSON.stringify([normalizeClaimsListFilters(view.filters), normalizeClaimsListLayout(view.layout)]);
  return serialize(a) === serialize(b);
}
