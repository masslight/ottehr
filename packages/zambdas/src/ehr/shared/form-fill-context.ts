import Oystehr from '@oystehr/sdk';
import { Account, Appointment, Coverage, Organization } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getInsuranceRelatedRefsFromAppointmentExtension } from '../../shared/appointment/helpers';
import { ProgressNoteInput } from '../../shared/pdf/types';
import { searchInsuranceInformation } from './harvest';

/** Shared prefix so a prefill run's diagnostics can be pulled out of the server log in one grep. */
export const LOG_TAG = '[form-prefill]';

export interface FormFillCoverage {
  coverage: Coverage;
  /** Payer name — see `resolvePayerNames` for where it is read from. */
  payerName?: string;
}

export interface FormFillInsurance {
  primary?: FormFillCoverage;
  secondary?: FormFillCoverage;
}

/**
 * Everything a token can be resolved from.
 *
 * `ProgressNoteInput` supplies most of it: the raw `Patient` and `Encounter`, the full chart data, and
 * the appointment package (location, practitioners). Insurance is the exception — the note input carries
 * a single coverage, while forms routinely ask for primary and secondary separately, so those are
 * resolved alongside it rather than inferred from the one.
 */
/**
 * Workers' compensation, which is filed against its own account rather than the patient's billing one.
 *
 * A separate account because it is a different payer relationship: the employer is the guarantor and the
 * carrier covers the injury, neither of which belongs alongside the patient's own insurance.
 */
export interface FormFillWorkersComp {
  /** The employer, named as the account's guarantor. */
  employer?: Organization;
  coverage?: Coverage;
  carrierName?: string;
}

export interface FormFillContext extends ProgressNoteInput {
  insurance?: FormFillInsurance;
  workersComp?: FormFillWorkersComp;
}

/**
 * The patient's accounts, separated by what they are for.
 *
 * Both are fetched in one search because reading either from the appointment bundle is unsafe: that
 * bundle keeps whichever `Account` the search happened to return first, so a patient with both a billing
 * account and a workers' compensation one gets an arbitrary choice between them — and a workers'
 * compensation patient is precisely the patient who has both.
 */
export const loadFormFillAccounts = async (
  oystehr: Oystehr,
  patientId: string | undefined
): Promise<{ billing?: Account; workersComp?: Account }> => {
  if (!patientId) return {};

  const accounts = (
    await oystehr.fhir.search<Account>({
      resourceType: 'Account',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'status', value: 'active' },
      ],
    })
  ).unbundle();

  const hasType = (account: Account, code: string): boolean =>
    (account.type?.coding ?? []).some((coding) => coding.code === code);

  return {
    billing: accounts.find((account) => hasType(account, 'PBILLACCT')),
    workersComp: accounts.find((account) => hasType(account, 'WCOMPACCT')),
  };
};

/**
 * Resolves the employer and carrier behind a workers' compensation account.
 *
 * The employer is reached through the account's guarantor, which may be a contained resource or a
 * reference to a standalone one depending on when the account was written — both shapes exist.
 */
export const loadFormFillWorkersComp = async (
  oystehr: Oystehr,
  account: Account | undefined
): Promise<FormFillWorkersComp | undefined> => {
  if (!account) return undefined;

  const [employer, coverage] = await Promise.all([
    resolveEmployer(oystehr, account),
    resolveWorkersCompCoverage(oystehr, account),
  ]);

  const carrierName = coverage ? (await resolvePayerNames(oystehr, [coverage], []))[0] : undefined;
  return { employer, coverage, carrierName };
};

const resolveEmployer = async (oystehr: Oystehr, account: Account): Promise<Organization | undefined> => {
  const reference = account.guarantor?.map((guarantor) => guarantor.party?.reference).find(Boolean);
  if (!reference) return undefined;

  if (reference.startsWith('#')) {
    const contained = account.contained?.find((resource) => resource.id === reference.slice(1));
    return contained?.resourceType === 'Organization' ? contained : undefined;
  }

  const id = removePrefix('Organization/', reference);
  if (!id) return undefined;

  try {
    return await oystehr.fhir.get<Organization>({ resourceType: 'Organization', id });
  } catch (error) {
    console.warn(`${LOG_TAG} Could not read the employer organisation ${reference}: ${error}`);
    return undefined;
  }
};

const resolveWorkersCompCoverage = async (oystehr: Oystehr, account: Account): Promise<Coverage | undefined> => {
  const reference = account.coverage?.map((entry) => entry.coverage?.reference).find(Boolean);
  const id = reference ? removePrefix('Coverage/', reference) : undefined;
  if (!id) return undefined;

  try {
    return await oystehr.fhir.get<Coverage>({ resourceType: 'Coverage', id });
  } catch (error) {
    console.warn(`${LOG_TAG} Could not read the workers' compensation coverage ${reference}: ${error}`);
    return undefined;
  }
};

/**
 * Resolves the visit's primary and secondary coverage, with payer names.
 *
 * Two sources, in preference order.
 *
 * The appointment's `insurance-related-resources` extension is checked first, because it is the only
 * visit-scoped record of which coverages applied *at the time of the appointment* — the point of it being
 * that a later change to the patient's insurance cannot rewrite what a past visit was billed under.
 * ⚠️ Nothing in this repository writes that extension today, so in practice this branch does not fire;
 * it is read so that prefill starts honouring it the moment something does.
 *
 * The account is therefore what actually runs. It records the patient's coverages with an explicit
 * `priority`, which is the same ordering the extension would carry, and is the source of truth for that
 * ordering — `Coverage.order` is deliberately left unset rather than kept in sync with it.
 *
 * The patient's coverages are also reachable straight off the appointment bundle, via a
 * `Coverage:beneficiary` revinclude, but only as an unordered set. That route is not used: picking from it
 * would put whichever coverage came back first into the primary box, which on a claim form is a wrong
 * answer rather than a missing one.
 */
export const loadFormFillInsurance = async (
  oystehr: Oystehr,
  appointment: Appointment | undefined,
  sources?: { account?: Account; packageCoverage?: Coverage }
): Promise<FormFillInsurance> => {
  if (!appointment) return {};
  const { account, packageCoverage } = sources ?? {};

  const refs = getInsuranceRelatedRefsFromAppointmentExtension(appointment);
  let primaryId = refs.primaryCoverage ? removePrefix('Coverage/', refs.primaryCoverage) : undefined;
  let secondaryId = refs.secondaryCoverage ? removePrefix('Coverage/', refs.secondaryCoverage) : undefined;
  if (primaryId || secondaryId) {
    console.log(`${LOG_TAG} Appointment/${appointment.id}: coverage ordering from the appointment extension.`);
  }

  if (!primaryId && !secondaryId) {
    const entries = account?.coverage ?? [];
    const referenceForPriority = (priority: number): string | undefined =>
      entries.find((entry) => entry.priority === priority)?.coverage?.reference;

    primaryId = removePrefix('Coverage/', referenceForPriority(1) ?? '');
    secondaryId = removePrefix('Coverage/', referenceForPriority(2) ?? '');

    // An account listing exactly one coverage has no ordering question to answer, so an absent priority
    // costs nothing: ambiguity needs at least two candidates. This is not the same as picking from the
    // patient's coverages at large, which is an unordered set that may well contain a secondary.
    //
    // It exists because not every writer sets a priority. `buildEmployerAccountResource` omits it, so a
    // workers-comp account — which by construction holds a single coverage, primary and secondary sharing
    // a different account entirely — would otherwise contribute nothing to a form.
    if (!primaryId && !secondaryId && entries.length === 1) {
      primaryId = removePrefix('Coverage/', entries[0].coverage?.reference ?? '');
    }

    console.log(
      `${LOG_TAG} Appointment/${appointment.id}: nothing on the appointment extension. ` +
        `Account/${account?.id ?? 'none'} lists ${entries.length} coverage entries: ` +
        `[${entries
          .map((entry) => `priority=${entry.priority ?? '-'} ${entry.coverage?.reference ?? 'no-reference'}`)
          .join('; ')}]. ` +
        `Bundle coverage: ${packageCoverage?.id ? `Coverage/${packageCoverage.id}` : 'none'}. ` +
        `Resolved primary=${primaryId ?? 'none'} secondary=${secondaryId ?? 'none'}.`
    );
  }

  let primary: Coverage | undefined;
  let secondary: Coverage | undefined;
  let included: Organization[] = [];

  const ids = [primaryId, secondaryId].filter((id): id is string => !!id);
  if (ids.length > 0) {
    const resources = (
      await oystehr.fhir.search<Coverage | Organization>({
        resourceType: 'Coverage',
        params: [
          { name: '_id', value: ids.join(',') },
          { name: '_include', value: 'Coverage:payor' },
        ],
      })
    ).unbundle();

    const coverages = new Map(
      resources.filter((r): r is Coverage => r.resourceType === 'Coverage').map((c) => [c.id, c])
    );
    included = resources.filter((r): r is Organization => r.resourceType === 'Organization');

    primary = primaryId ? coverages.get(primaryId) : undefined;
    secondary = secondaryId ? coverages.get(secondaryId) : undefined;
  } else if (packageCoverage) {
    // A coverage exists but nothing establishes it as the primary one: the appointment bundle reaches the
    // patient's coverages as an unordered set. It is reported and then dropped.
    //
    // Filling the primary insurer from it would be a guess presented as a fact. On a claim form naming the
    // wrong insurer as primary is a worse outcome than an empty box, which the provider can see and
    // complete; a filled box invites nobody to check it.
    console.warn(
      `${LOG_TAG} Appointment/${appointment.id}: Coverage/${packageCoverage.id} is available but its ` +
        `priority is unknown, so the insurance fields are left blank rather than assumed to be primary.`
    );
    return {};
  } else {
    // Distinguishes "this visit has no insurance recorded" from "the lookup failed", which look identical
    // on the finished form: a blank box either way.
    console.log(`${LOG_TAG} Appointment/${appointment.id} carries no coverage at all; insurance tokens will be blank.`);
    return {};
  }

  const payerNames = await resolvePayerNames(oystehr, [primary, secondary], included);

  return {
    primary: primary ? { coverage: primary, payerName: payerNames[0] } : undefined,
    secondary: secondary ? { coverage: secondary, payerName: payerNames[1] } : undefined,
  };
};

/**
 * The payer name recorded on the coverage itself, alongside the member ID.
 *
 * `createCoverageMemberIdentifier` stamps the insurer's name onto the identifier's assigner when the
 * coverage is written, so the usual case needs no payor lookup at all — which matters because resolving a
 * payor can reach an external RCM service.
 *
 * It is a copy rather than the Organization's live name, so a renamed insurer would still read as it did
 * when the coverage was recorded. For a form describing that coverage that is defensible, and arguably
 * preferable: the name is contemporaneous with the member ID printed beside it.
 */
const payerNameFromIdentifier = (coverage: Coverage): string | undefined =>
  coverage.identifier?.find((identifier) => identifier.assigner?.display?.trim())?.assigner?.display?.trim();

/**
 * Each coverage's payer name.
 *
 * Read from the coverage where it is recorded there, and resolved from the payor `Organization` only for
 * coverages that carry no such record — written by a path that did not stamp it, most likely.
 *
 * That resolution goes through `searchInsuranceInformation` rather than the `_include` alone, because a
 * payor is only an `Organization/<uuid>` reference when the organisation has a real FHIR id; otherwise it
 * is an RCM payer URL, which no `_include` resolves and which that helper fetches directly.
 *
 * Failures are swallowed per the resolver contract: an unreachable payer service should leave the field
 * blank for the provider to complete, not fail the whole form.
 */
const resolvePayerNames = async (
  oystehr: Oystehr,
  coverages: (Coverage | undefined)[],
  included: Organization[]
): Promise<(string | undefined)[]> => {
  const fromCoverage = coverages.map((coverage) => (coverage ? payerNameFromIdentifier(coverage) : undefined));

  // Only the ones the coverage could not answer for.
  const refsToResolve = coverages.map((coverage, index) =>
    fromCoverage[index] ? undefined : coverage?.payor?.[0]?.reference
  );
  const unique = [...new Set(refsToResolve.filter((ref): ref is string => !!ref))];
  if (unique.length === 0) return fromCoverage;

  try {
    // Ordered one-for-one with the refs passed in.
    const organizations = await searchInsuranceInformation(oystehr, unique, included);
    const byRef = new Map(unique.map((ref, index) => [ref, organizations[index]]));
    return fromCoverage.map((name, index) => {
      const ref = refsToResolve[index];
      return name ?? (ref ? byRef.get(ref)?.name : undefined);
    });
  } catch (error) {
    console.warn(`${LOG_TAG} Could not resolve payer organisations: ${error}`);
    return fromCoverage;
  }
};
