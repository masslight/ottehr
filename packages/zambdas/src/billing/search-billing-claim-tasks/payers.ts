import Oystehr from '@oystehr/sdk';
import { Account, Appointment, Coverage, Encounter, Organization } from 'fhir/r4b';
import { chunkThings } from 'utils/lib/fhir/chat';
import { ACCOUNT_TYPE_CODE_SYSTEM, SERVICE_CATEGORY_SYSTEM } from 'utils/lib/fhir/constants';
import { getAllFhirSearchPages } from 'utils/lib/fhir/getAllFhirSearchPages';
import { getCoding } from 'utils/lib/fhir/helpers';
import { extractPayerIdFromUrl } from 'utils/lib/helpers/helpers';
import {
  findOccupationalMedicineAccount,
  findRef,
  getNonInsurancePayerReference,
  isEmployerBilledVisit,
  resolvePayersByRef,
  selectClaimCoverages,
} from '../shared';

export async function getClaimTaskPayerNames(
  clinical: Oystehr,
  billing: Oystehr,
  resources: (Encounter | Appointment | Account)[],
  payerCache = new Map<string, Organization>()
): Promise<Map<string, string[]>> {
  const visits = resources
    .filter((r): r is Encounter => r.resourceType === 'Encounter')
    .map((encounter) => {
      const appointment = findRef<Appointment>(resources, encounter.appointment?.[0]?.reference);
      const service = getCoding(appointment?.serviceCategory, SERVICE_CATEGORY_SYSTEM)?.code;
      const accounts = (encounter.account ?? []).flatMap((ref) => findRef<Account>(resources, ref.reference) ?? []);
      const employerAccount = findOccupationalMedicineAccount(accounts);
      return {
        encounter,
        service,
        accounts,
        payer: getNonInsurancePayerReference(encounter, employerAccount),
        needsEmployerAccount: !employerAccount && isEmployerBilledVisit(service, encounter),
      };
    });
  // Occupational medicine accounts are not always linked directly to the encounter.
  const patientRefs = [
    ...new Set(visits.flatMap((v) => (v.needsEmployerAccount ? v.encounter.subject?.reference || [] : []))),
  ];
  const employerAccounts = patientRefs.length
    ? await getAllFhirSearchPages<Account>(
        {
          resourceType: 'Account',
          params: [
            { name: 'patient', value: patientRefs.join(',') },
            { name: 'status', value: 'active' },
            { name: 'type', value: `${ACCOUNT_TYPE_CODE_SYSTEM}|OCCUPATIONALMEDICINEACCT` },
          ],
        },
        clinical
      )
    : [];
  for (const visit of visits) {
    if (visit.needsEmployerAccount) {
      const account = employerAccounts.find(
        (a) => a.subject?.some((s) => s.reference === visit.encounter.subject?.reference)
      );
      visit.payer = getNonInsurancePayerReference(visit.encounter, account);
    }
  }
  const accounts = visits.flatMap((v) => v.accounts);
  const coverageRefs = accounts.flatMap((a) => a.coverage ?? []);
  const coverageIds = [...new Set(coverageRefs.flatMap((c) => c.coverage.reference?.split('/')[1] || []))];
  const coverageResources: (Coverage | Organization)[] = [];
  for (const ids of chunkThings(coverageIds, 100)) {
    const chunk = await getAllFhirSearchPages<Coverage | Organization>(
      {
        resourceType: 'Coverage',
        params: [
          { name: '_id', value: ids.join(',') },
          { name: '_include', value: 'Coverage:payor' },
        ],
      },
      clinical
    );
    coverageResources.push(...chunk);
  }
  const coverages = coverageResources.filter(
    (r): r is Coverage =>
      r.resourceType === 'Coverage' &&
      !!r.payor?.[0]?.reference &&
      extractPayerIdFromUrl(r.payor[0].reference) !== '00000'
  );
  const organizations = coverageResources.filter((r): r is Organization => r.resourceType === 'Organization');
  const nioIds = [...new Set(visits.flatMap((v) => v.payer?.reference?.split('/')[1] || []))];
  const payerRefs = coverages.map((c) => c.payor[0].reference);
  const [resolvedPayers, nonInsurancePayers] = await Promise.all([
    resolvePayersByRef(
      clinical,
      payerRefs.filter((ref) => ref && !payerCache.has(ref))
    ),
    nioIds.length
      ? getAllFhirSearchPages<Organization>(
          { resourceType: 'Organization', params: [{ name: '_id', value: nioIds.join(',') }] },
          billing
        )
      : [],
  ]);
  resolvedPayers.forEach((payer, ref) => payerCache.set(ref, payer));
  return new Map(
    visits.map((visit) => {
      const selected = selectClaimCoverages(visit.service, visit.accounts, coverages, (c) => `Coverage/${c.id}`);
      const names = selected.flatMap((coverage) => {
        const payor = coverage.payor[0];
        const organization = payerCache.get(payor.reference!) ?? findRef<Organization>(organizations, payor.reference);
        return organization?.name || payor.display || [];
      });
      const employerName =
        findRef<Organization>(nonInsurancePayers, visit.payer?.reference)?.name || visit.payer?.display;
      if (employerName) names.push(employerName);
      return [visit.encounter.id!, [...new Set(names)]];
    })
  );
}
