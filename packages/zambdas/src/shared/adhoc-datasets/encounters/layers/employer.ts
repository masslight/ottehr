import { Organization } from 'fhir/r4b';
import { getServiceCategoryCodeFromAppointment } from 'utils/lib/fhir/appointments';
import { AdHocEncounterRow } from 'utils/lib/types/adhoc/datasets/encounters';
import { PatientAccountAndCoverageResources } from 'utils/lib/types/data/account';
import { fetchScopedResources } from '../../../adhoc-report';
import {
  getOccupationalMedicineEmployerName,
  getVisitEmployerOrganizationId,
} from '../../../occupational-medicine-employer';
import { composeEmployerData } from '../../../pdf/sections/employerInfo';
import { fetchPatientAccounts } from '../../patient-accounts';
import { defineEncounterLayer } from '../context';

// Occupational medicine / workers' comp employer of the visit.
export const employerLayer = defineEncounterLayer<{
  accountsByPatient: Map<string, PatientAccountAndCoverageResources>;
  visitEmployerOrgById: Map<string, Organization>;
}>({
  id: 'employer',
  fetch: async (ctx) => {
    // The visit details face sheet's inputs: the patient's account picture and, for pre-op visits, the
    // Organization the visit's employer selection points at.
    if (!ctx.encRefs.length) return { accountsByPatient: new Map(), visitEmployerOrgById: new Map() };
    await ctx.rootLookups();

    const visitEmployerOrgIds = Array.from(
      new Set(
        Array.from(ctx.root.encounterById.values())
          .map((encounter) => getVisitEmployerOrganizationId(encounter))
          .filter((id): id is string => !!id)
      )
    );

    const [accountsByPatient, visitEmployerOrgs] = await Promise.all([
      fetchPatientAccounts(ctx.oystehr, Array.from(ctx.root.patientMap.values())),
      fetchScopedResources<Organization>(ctx.oystehr, 'Organization', '_id', visitEmployerOrgIds),
    ]);

    const visitEmployerOrgById = new Map<string, Organization>();
    for (const org of visitEmployerOrgs) if (org.id) visitEmployerOrgById.set(org.id, org);

    return { accountsByPatient, visitEmployerOrgById };
  },
  map: (input, out) => {
    const { encounter, appointment, patient } = input;
    const { accountsByPatient, visitEmployerOrgById } = out;
    const row: Partial<AdHocEncounterRow> = {};
    const account = patient?.id ? accountsByPatient.get(`Patient/${patient.id}`) : undefined;
    const visitEmployerOrgId = getVisitEmployerOrganizationId(encounter);

    row.occupationalMedicineEmployer =
      getOccupationalMedicineEmployerName({
        encounter,
        appointmentServiceCategory: getServiceCategoryCodeFromAppointment(appointment),
        occupationalMedicineEmployerOrganization: account?.occupationalMedicineEmployerOrganization,
        occupationalMedicineAccount: account?.occupationalMedicineAccount,
        visitEmployerOrganization: visitEmployerOrgId ? visitEmployerOrgById.get(visitEmployerOrgId) : undefined,
      }) ?? '';

    const workersComp = composeEmployerData({
      employer: account?.employerOrganization,
      workersCompCoverage: account?.coverages.workersComp,
      insuranceOrgs: account?.insuranceOrgs,
    });

    row.workersCompEmployer = workersComp.employerName;
    row.workersCompCarrier = workersComp.workersCompInsuranceCarrier;
    return row;
  },
});
