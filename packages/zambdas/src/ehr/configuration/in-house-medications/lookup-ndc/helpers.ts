import { Medication } from 'fhir/r4b';
import { getMedicationName } from 'utils/lib/fhir/medication-administration';
import { CODE_SYSTEM_NDC } from 'utils/lib/helpers/rcm/constants';
import { LookupNdcResponse } from 'utils/lib/types/api/config/in-house-medications';

// The public openFDA NDC directory: no key, no PHI, one box NDC per request.
const OPENFDA_NDC_URL = 'https://api.fda.gov/drug/ndc.json';
const OPENFDA_TIMEOUT_MS = 5_000;
const CODE_SYSTEM_RXNORM = 'http://www.nlm.nih.gov/research/umls/rxnorm';

export type NdcProduct = NonNullable<LookupNdcResponse['product']>;

/** The subset of an openFDA NDC directory result this zambda reads. */
export interface OpenFdaNdcResult {
  product_ndc?: string;
  generic_name?: string;
  brand_name?: string;
  labeler_name?: string;
  dosage_form?: string;
  active_ingredients?: { name?: string; strength?: string }[];
  packaging?: { package_ndc?: string; description?: string }[];
  openfda?: { rxcui?: string[] };
}

/**
 * The hyphenated 10-digit package NDCs a typed NDC could mean, as the directory spells them.
 * Hyphenated 10-digit input (4-4-2, 5-3-2, 5-4-1) is itself; unhyphenated 10 digits could be any of the
 * three splits; an 11-digit billing NDC (5-4-2, hyphenated or not) has a padding zero in one segment that
 * can be dropped three ways. Empty when the input cannot be a package NDC.
 */
export const ndcPackageCandidates = (input: string): string[] => {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  const hyphenated = /^\d{4,5}-\d{3,4}-\d{1,2}$/.test(trimmed) ? trimmed.split('-') : undefined;
  if (hyphenated && digits.length === 10) return [trimmed];

  const [labeler, product, pkg] = hyphenated ?? [];
  if (digits.length === 11 && (!hyphenated || (labeler.length === 5 && product.length === 4 && pkg.length === 2))) {
    const [l, p, k] = [digits.slice(0, 5), digits.slice(5, 9), digits.slice(9, 11)];
    return [
      ...(l.startsWith('0') ? [`${l.slice(1)}-${p}-${k}`] : []),
      ...(p.startsWith('0') ? [`${l}-${p.slice(1)}-${k}`] : []),
      ...(k.startsWith('0') ? [`${l}-${p}-${k.slice(1)}`] : []),
    ];
  }
  if (digits.length === 10 && !hyphenated && !trimmed.includes('-')) {
    return [
      `${digits.slice(0, 4)}-${digits.slice(4, 8)}-${digits.slice(8)}`,
      `${digits.slice(0, 5)}-${digits.slice(5, 8)}-${digits.slice(8)}`,
      `${digits.slice(0, 5)}-${digits.slice(5, 9)}-${digits.slice(9)}`,
    ];
  }
  return [];
};

const toProduct = (result: OpenFdaNdcResult, candidates: string[]): NdcProduct => {
  const pkg = result.packaging?.find((p) => p.package_ndc && candidates.includes(p.package_ndc));
  const strength = result.active_ingredients
    ?.map((ingredient) => ingredient.strength)
    .filter(Boolean)
    .join(' / ');
  const genericName = result.generic_name;
  const nameParts = [
    result.brand_name && result.brand_name.toLowerCase() !== genericName?.toLowerCase()
      ? `${result.brand_name} (${genericName ?? ''})`
      : genericName,
    strength,
    result.dosage_form?.toLowerCase(),
  ];
  return {
    packageNdc: pkg?.package_ndc ?? candidates[0],
    name: nameParts.filter(Boolean).join(' '),
    genericName,
    brandName: result.brand_name,
    manufacturer: result.labeler_name,
    packageDescription: pkg?.description,
    rxcuis: result.openfda?.rxcui ?? [],
  };
};

/**
 * Looks a package NDC up in the openFDA NDC directory. `undefined` means the directory has no such package.
 * Throws on timeout or any failure; the caller turns that into "lookup unavailable" so receiving is never blocked.
 */
export async function fetchNdcProduct(candidates: string[]): Promise<NdcProduct | undefined> {
  if (candidates.length === 0) return undefined;
  const search = `package_ndc:(${candidates.map((ndc) => `"${ndc}"`).join(' OR ')})`;
  const url = `${OPENFDA_NDC_URL}?search=${encodeURIComponent(search)}&limit=1`;
  const response = await fetch(url, { signal: AbortSignal.timeout(OPENFDA_TIMEOUT_MS) });
  if (response.status === 404) return undefined;
  if (!response.ok) throw new Error(`openFDA NDC lookup failed: HTTP ${response.status}`);
  const body = (await response.json()) as { results?: OpenFdaNdcResult[] };
  const result = body.results?.[0];
  return result ? toProduct(result, candidates) : undefined;
}

const ingredientWords = (product: NdcProduct): string[] =>
  (product.genericName ?? '')
    .split(/,| and /i)
    .map((ingredient) => ingredient.trim().split(/\s+/)[0]?.toLowerCase())
    .filter((word): word is string => Boolean(word));

/**
 * Whether the box is the catalog drug. By RxCUI when the catalog Medication carries an RxNorm coding and the
 * directory returned RxCUIs; otherwise by name: every active ingredient of the box (first word of each part
 * of the generic name) must appear in the catalog name, or the box's product NDC must equal the catalog's.
 */
export const compareNdcProduct = (
  product: NdcProduct,
  catalog: Medication
): Pick<LookupNdcResponse, 'status' | 'comparedBy'> => {
  const catalogRxcuis = (catalog.code?.coding ?? [])
    .filter((coding) => coding.system === CODE_SYSTEM_RXNORM && coding.code)
    .map((coding) => coding.code as string);
  if (catalogRxcuis.length > 0 && product.rxcuis.length > 0) {
    const match = product.rxcuis.some((rxcui) => catalogRxcuis.includes(rxcui));
    return { status: match ? 'match' : 'mismatch', comparedBy: 'rxcui' };
  }

  const catalogNdc = catalog.code?.coding?.find((coding) => coding.system === CODE_SYSTEM_NDC)?.code;
  const sameProduct =
    !!catalogNdc &&
    ndcPackageCandidates(catalogNdc).some(
      (ndc) => ndc.split('-').slice(0, 2).join('-') === product.packageNdc.split('-').slice(0, 2).join('-')
    );
  const catalogName = (getMedicationName(catalog) ?? catalog.code?.text ?? '').toLowerCase();
  const words = ingredientWords(product);
  const sameName = words.length > 0 && words.every((word) => catalogName.includes(word));
  return { status: sameProduct || sameName ? 'match' : 'mismatch', comparedBy: 'name' };
};
