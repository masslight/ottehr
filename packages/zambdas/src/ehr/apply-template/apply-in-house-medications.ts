import Oystehr, { BatchInputPostRequest } from '@oystehr/sdk';
import {
  Encounter,
  FhirResource,
  List,
  Medication,
  MedicationAdministration,
  MedicationRequest,
  Procedure,
} from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  ApplyTemplateWarning,
  chartDataTagSystem,
  getCptCodesFromMA,
  getDosageUnitsAndRouteOfMedication,
  getMedicationName,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MedicationApplianceLocation,
  MedicationData,
  resourceHasTagSystem,
  searchRouteByCode,
  Secrets,
  TemplateSectionAction,
} from 'utils';
import { v4 as uuidV4 } from 'uuid';
import { getMyPractitionerId } from '../../shared';
import { makeProcedureResource } from '../../shared/chart-data';
import {
  createMedicationAdministrationResource,
  createMedicationRequest,
  MedicationAdministrationData,
} from '../create-update-medication-order/fhir-resources-creation';

const IN_HOUSE_MEDICATION_PLAN_TAG_SYSTEM = chartDataTagSystem('in-house-medication-administration-template');

export const isInHouseMedicationTemplatePlan = (resource: FhirResource): resource is MedicationAdministration => {
  if (resource.resourceType !== 'MedicationAdministration') return false;
  return resourceHasTagSystem(resource, IN_HOUSE_MEDICATION_PLAN_TAG_SYSTEM);
};

interface ApplyInHouseMedicationPlansInput {
  templateList: List;
  encounter: Encounter;
  oystehr: Oystehr;
  userToken: string;
  secrets: Secrets | null;
  action: TemplateSectionAction;
}

interface ApplyInHouseMedicationPlansResult {
  warnings: ApplyTemplateWarning[];
}

export async function applyInHouseMedicationPlans(
  input: ApplyInHouseMedicationPlansInput
): Promise<ApplyInHouseMedicationPlansResult> {
  const warnings: ApplyTemplateWarning[] = [];
  const sectionName = 'inHouseMedications' as const;
  const medInteractionDetected = false;

  try {
    const { templateList, encounter, oystehr, secrets, userToken, action } = input;
    if (action === 'skip') return { warnings: [] };

    const templateContained = templateList.contained ?? [];

    const templateMedAdministrations = templateContained.filter((r): r is MedicationAdministration =>
      isInHouseMedicationTemplatePlan(r)
    );
    if (templateMedAdministrations.length === 0) return { warnings: [] };

    const patientId = encounter.subject?.reference?.replace('Patient/', '');
    if (!patientId) {
      warnings.push({
        section: sectionName,
        message: 'Skipped in-house medication orders — encounter has no patient linked.',
      });
      return { warnings };
    }

    const encounterId = encounter.id;
    if (!encounterId) {
      warnings.push({
        section: sectionName,
        message: 'Skipped in-house medication orders — encounter has no ID.',
      });
      return { warnings };
    }

    const requests: BatchInputPostRequest<MedicationAdministration | MedicationRequest | Procedure>[] = [];

    const medicationsByIdMap = makeMedicationsByIdMap(templateContained);

    for (const templateMA of templateMedAdministrations) {
      const containedMedId = templateMA.medicationReference?.reference?.replace('#', '');
      const medicationForMa = medicationsByIdMap.get(containedMedId ?? '');
      const medName = deriveMedicationName(containedMedId, medicationsByIdMap);

      if (!medicationForMa) {
        warnings.push({
          section: sectionName,
          message: `Skipped "${medName}" — medication information not found in template.`,
        });
        continue;
      }

      const { route, dose, units } = getDosageUnitsAndRouteOfMedication(templateMA);
      const routeAppliance = searchRouteByCode(route);

      if (dose === undefined) {
        warnings.push({
          section: sectionName,
          message: `Skipped "${medName}" — dose not found in template.`,
        });
        continue;
      }

      if (!routeAppliance || !routeAppliance.display) {
        warnings.push({
          section: sectionName,
          message: `Skipped "${medName}" — route of administration not found in template.`,
        });
        continue;
      }

      // MAs that were administered at template creation time will have this info but others will not. that's ok
      const siteCoding = templateMA.dosage?.site?.coding?.[0];
      const location: MedicationApplianceLocation | undefined = siteCoding?.code
        ? { code: siteCoding.code, display: siteCoding.display ?? '', system: siteCoding.system ?? '' }
        : undefined;

      const reasonNote = templateMA.note?.find((n) => n.authorString === MEDICATION_ADMINISTRATION_REASON_CODE)?.text;
      const otherReasonNote = templateMA.note?.find(
        (n) => n.authorString === MEDICATION_ADMINISTRATION_OTHER_REASON_CODE
      )?.text;

      const cptCodes = getCptCodesFromMA(templateMA);

      const orderData: MedicationData = {
        patient: patientId,
        encounterId,
        // routeCoding.code was validated non-null above; route string is required by MedicationData
        route: routeAppliance.display,
        dose: dose,
        units,
        instructions: templateMA.dosage?.text,
        reason: reasonNote,
        otherReason: otherReasonNote,
        ...(cptCodes && cptCodes.length > 0 ? { cptCodes } : {}),
      };

      // ATHENA TODO: do we need to check that these providers are allowed to order erx?
      // product said to use the person applying the template for the ordering provider
      const currentUserProviderId = await getMyPractitionerId(userToken, secrets);

      const medicationAdministrationData: MedicationAdministrationData = {
        orderData,
        status: 'in-progress',
        route: routeAppliance,
        location,
        medicationResource: medicationForMa,
        createdProviderId: currentUserProviderId,
        orderedByProviderId: currentUserProviderId,
        dateTimeCreated: DateTime.now().toISO(), // the dateTimeCreated on the templateMA is not valid and needs to be replaced

        // orderData: MedicationData;
        // status: MedicationAdministration['status'];
        // route: MedicationApplianceRoute;
        // location?: MedicationApplianceLocation;
        // createdProviderId?: string;
        // orderedByProviderId?: string; // NEW: provider to add to the "ordered by" history
        // administeredProviderId?: string;
        // existedMA?: MedicationAdministration;
        // dateTimeCreated?: string;
        // medicationResource?: Medication;
      };

      try {
        // ATHENA TODO: come back and figure out interactions: if there is even a single interaction detected, then no
        // in how meds should be applied at all. The section should effectively be skipped.
        // ATHENA TODO: should we be using the drug id for interactions or
        // export const MEDICATION_DISPENSABLE_DRUG_ID = 'https://terminology.fhir.oystehr.com/CodeSystem/medispan-dispensable-drug-id';
        // const medispanIdForInteractions =
        //   (medicationForMa.code?.coding ?? []).find((c) => c.system === MEDICATION_DISPENSABLE_DRUG_ID_FOR_INTERACTIONS)
        //     ?.code ?? '';

        // const erxInteractionsResponse = await oystehr.erx.checkPrecheckInteractions({
        //   patientId,
        //   drugId: medispanIdForInteractions,
        // });

        // const interactions = medicationInteractionsFromErxResponse(erxInteractionsResponse);
        // interactionsDetected = hasInteractions(interactions).
        if (medInteractionDetected) {
          return {
            warnings: [
              {
                section: sectionName,
                message: `Medication interaction detected. All medications will be skipped. Please add medications manually`,
              },
            ],
          };
        }

        const liveMA = createMedicationAdministrationResource(medicationAdministrationData);

        // interactions = undefined triggers the INTERACTIONS_UNAVAILABLE sentinel —
        // appropriate at template apply time since we have no patient-specific data yet.
        // ATHENA TODO: where am I supposed to get interactions from?
        const liveMR = createMedicationRequest(orderData, undefined, medicationForMa);

        const maFullUrl = `urn:uuid:${uuidV4()}`;
        requests.push({
          method: 'POST',
          url: '/MedicationAdministration',
          resource: liveMA,
          fullUrl: maFullUrl,
        });
        requests.push({ method: 'POST', url: '/MedicationRequest', resource: liveMR });

        // ATHENA TODO: make sure this tracks with how the other template sections think about adding cpt codes
        const cptCodes = getCptCodesFromMA(liveMA);
        if (cptCodes && cptCodes.length > 0) {
          for (const cptCode of cptCodes) {
            requests.push({
              method: 'POST',
              url: '/Procedure',
              resource: makeProcedureResource(encounterId, patientId, cptCode, 'cpt-code', maFullUrl),
            });
          }
        }
      } catch (err) {
        console.error(`Error building medication order for template MA ${templateMA.id}`, err);
        warnings.push({
          section: sectionName,
          message: `Skipped "${medName}" — something went wrong building the medication order.`,
        });
        return { warnings: [] };
      }
    }

    if (requests.length === 0) return { warnings };

    await oystehr.fhir.transaction({ requests });
  } catch (err) {
    console.error('Encountered error in applyInHouseMedicationPlans', err);
    warnings.push({
      section: sectionName,
      message: 'Something went wrong applying in-house medication orders. Skipped.',
    });
  }

  return { warnings };
}

export const makeMedicationsByIdMap = (resources: FhirResource[]): Map<string, Medication> => {
  return new Map<string, Medication>(
    resources.filter((r): r is Medication => r.resourceType === 'Medication').map((med) => [med.id!, med])
  );
};

export const deriveMedicationName = (medicationId: string | undefined, medByIdMap: Map<string, Medication>): string => {
  const unknownMedicationName = 'Unknown medication';
  if (!medicationId || !medByIdMap.has(medicationId)) return unknownMedicationName;
  return getMedicationName(medByIdMap.get(medicationId)) ?? unknownMedicationName;
};
