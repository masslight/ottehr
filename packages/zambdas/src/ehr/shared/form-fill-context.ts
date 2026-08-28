import Oystehr from '@oystehr/sdk';
import { Appointment, Coverage, Organization } from 'fhir/r4b';
import { removePrefix } from 'utils/lib/helpers/helpers';
import { getInsuranceRelatedRefsFromAppointmentExtension } from '../../shared/appointment/helpers';
import { ProgressNoteInput } from '../../shared/pdf/types';

export interface FormFillCoverage {
  coverage: Coverage;
  /** Payer name, from the payor reference's display or the Organization it points at. */
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
export interface FormFillContext extends ProgressNoteInput {
  insurance?: FormFillInsurance;
}

/**
 * Resolves the appointment's primary and secondary coverage, with payer names.
 *
 * Which coverage is which is recorded on the appointment as an extension rather than on the Coverage
 * resources, so the references come from there. Both are fetched in a single search that `_include`s
 * the payor organisations, since a payer name is usually only a reference display away but not always.
 */
export const loadFormFillInsurance = async (
  oystehr: Oystehr,
  appointment: Appointment | undefined
): Promise<FormFillInsurance> => {
  if (!appointment) return {};

  const refs = getInsuranceRelatedRefsFromAppointmentExtension(appointment);
  const primaryId = refs.primaryCoverage ? removePrefix('Coverage/', refs.primaryCoverage) : undefined;
  const secondaryId = refs.secondaryCoverage ? removePrefix('Coverage/', refs.secondaryCoverage) : undefined;

  const ids = [primaryId, secondaryId].filter((id): id is string => !!id);
  if (ids.length === 0) return {};

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
  const organizations = new Map(
    resources.filter((r): r is Organization => r.resourceType === 'Organization').map((o) => [o.id, o])
  );

  const describe = (id: string | undefined): FormFillCoverage | undefined => {
    const coverage = id ? coverages.get(id) : undefined;
    if (!coverage) return undefined;
    const payor = coverage.payor?.[0];
    const payorId = payor?.reference ? removePrefix('Organization/', payor.reference) : undefined;
    return {
      coverage,
      payerName: payor?.display ?? (payorId ? organizations.get(payorId)?.name : undefined),
    };
  };

  return { primary: describe(primaryId), secondary: describe(secondaryId) };
};
