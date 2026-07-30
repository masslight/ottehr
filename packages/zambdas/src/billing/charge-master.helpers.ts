import { ChargeItemDefinition, ChargeItemDefinitionPropertyGroup } from 'fhir/r4b';
import {
  CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM,
  ChargeItemDefinitionDefault,
  CPT_CODE_SYSTEM,
  EXTENSION_URL_CPT_MODIFIER,
} from 'utils';

// ---------------------------------------------------------------------------
// Charge master (billing-app ChargeItemDefinition) pricing.
//
// Shared by create-billing-claim-from-encounter (prices service lines when a claim is first built)
// and the rules engine's applyChargeMasterPrices action (re-prices lines mid-run, after rules may
// have changed them). Both callers must price the same way, so the lookup lives here.
//
// A charge master stores one price entry per propertyGroup: a `base` priceComponent whose code
// carries the CPT coding, whose amount is the price, and whose optional EXTENSION_URL_CPT_MODIFIER
// extension scopes the price to a modifier (see procedureCodesToPropertyGroups in shared.ts).
// ---------------------------------------------------------------------------

type ChargeMasterPriceComponent = NonNullable<ChargeItemDefinitionPropertyGroup['priceComponent']>[number];

const entryModifier = (pc: ChargeMasterPriceComponent): string | undefined =>
  pc.extension?.find((ext) => ext.url === EXTENSION_URL_CPT_MODIFIER)?.valueCode;

/**
 * The charge master's price for a CPT code with the given modifiers, or undefined when the charge
 * master has no matching entry (callers choose their own fallback).
 *
 * Modifier semantics are exact both ways: a line with modifiers is priced only by an entry whose
 * modifier is one of the line's, and a line without modifiers only by an entry without a modifier —
 * a modifier-specific price never applies to a modifier-less line, and vice versa. Ties (several
 * matching entries) resolve to the charge master's first, so lookups are deterministic.
 */
export function getChargeMasterPrice(
  chargeMaster: ChargeItemDefinition,
  cptCode: string,
  modifiers: string[]
): number | undefined {
  const entries = (chargeMaster.propertyGroup ?? [])
    .map((pg) => pg.priceComponent?.[0])
    .filter(
      (pc): pc is ChargeMasterPriceComponent =>
        !!pc &&
        pc.type === 'base' &&
        !!pc.code?.coding?.some((coding) => coding.system === CPT_CODE_SYSTEM && coding.code === cptCode)
    );
  const match = modifiers.length
    ? entries.find((pc) => {
        const modifier = entryModifier(pc);
        return modifier != null && modifiers.includes(modifier);
      })
    : entries.find((pc) => entryModifier(pc) == null);
  return match?.amount?.value;
}

const hasDefaultTag = (cid: ChargeItemDefinition, kind: ChargeItemDefinitionDefault): boolean =>
  !!cid.meta?.tag?.some((t) => t.system === CHARGE_ITEM_DEFINITION_DEFAULT_SYSTEM && t.code === kind);

/**
 * The best applicable charge master among the candidates: active, designated as the default for the
 * given kind (insurance / self-pay), effective (ChargeItemDefinition.date) on or before the date of
 * service — most recent effective date first. Undefined when none qualifies.
 */
export function selectBestChargeMaster(
  candidates: ChargeItemDefinition[],
  kind: ChargeItemDefinitionDefault,
  dateOfService: string
): ChargeItemDefinition | undefined {
  return candidates
    .filter(
      (cid) =>
        cid.status === 'active' &&
        hasDefaultTag(cid, kind) &&
        // `date` may be a full dateTime; compare date parts so "effective on the DOS" qualifies.
        !!cid.date &&
        cid.date.slice(0, 10) <= dateOfService.slice(0, 10)
    )
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0];
}
