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
  getMediSpanIdForInteraction,
  MEDICATION_ADMINISTRATION_OTHER_REASON_CODE,
  MEDICATION_ADMINISTRATION_REASON_CODE,
  MedicationApplianceLocation,
  MedicationData,
  resourceHasTagSystem,
  searchRouteByCode,
  Secrets,
  TemplateSectionAction,
} from 'utils';
import { getMyPractitionerId } from '../../shared';
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
    type erxInteractionPromiseResponse = { interactionDetectedOrFailed: boolean; warnings: ApplyTemplateWarning[] };
    const requestsAndErxPromise: {
      liveMA: MedicationAdministration;
      liveMR: MedicationRequest;
      erxInteractionPromise: () => Promise<erxInteractionPromiseResponse>;
    }[] = [];

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
        route: routeAppliance.display,
        dose: dose,
        units,
        instructions: templateMA.dosage?.text,
        reason: reasonNote,
        otherReason: otherReasonNote,
        ...(cptCodes && cptCodes.length > 0 ? { cptCodes } : {}),
      };

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

      const liveMA = createMedicationAdministrationResource(medicationAdministrationData);
      // interactions are passed as empty -- we disallow creation of templates with meds that have interactions, and the
      // erxInteractionPromise will be checked for every med on the template. If the promise does not detect interactions,
      // then the live MR is added to the request and can be added interaction free
      const liveMR = createMedicationRequest(
        orderData,
        { allergyInteractions: [], drugInteractions: [] },
        medicationForMa
      );

      const erxInteractionPromise = async (): Promise<erxInteractionPromiseResponse> => {
        let interactionDetectedOrFailed = false;

        const drugId = getMediSpanIdForInteraction(medicationForMa);
        if (!drugId) {
          return {
            interactionDetectedOrFailed: true,
            warnings: [
              {
                section: sectionName,
                message: `Medication interaction could not be computed due to missing drug id. All medications will be skipped. Please add medications manually`,
              },
            ],
          };
        }

        // need to wrap this in a try catch cause the oystehr call could fail
        try {
          const erxInteractionsResponse = await oystehr.erx.checkPrecheckInteractions({
            patientId,
            drugId,
          });

          console.log(`this is erxInteractionResponse`, JSON.stringify(erxInteractionsResponse));
          interactionDetectedOrFailed =
            !!erxInteractionsResponse.allergies.length || !!erxInteractionsResponse.medications.length;
          return {
            interactionDetectedOrFailed,
            warnings: interactionDetectedOrFailed
              ? [
                  {
                    section: sectionName,
                    message: `Interaction detected. All medications will be skipped. Please add medications manually.`,
                  },
                ]
              : [],
          };
        } catch (e) {
          console.error(
            'Something went wrong checking erx interactions for MedicationAdministration',
            e,
            JSON.stringify(templateMA),
            JSON.stringify(medicationForMa)
          );
          return {
            interactionDetectedOrFailed: true,
            warnings: [
              {
                section: sectionName,
                message: `Unable to determine medication interaction. All medications will be skipped. Please add medications manually.`,
              },
            ],
          };
        }
      };

      requestsAndErxPromise.push({ liveMA, liveMR, erxInteractionPromise });
    }

    // We will only apply templates for which there are no med interactions between the med on the template and the patient
    // if there is even a single interaction detected, then the meds section should effectively be skipped.
    const erxResponses = await Promise.all(requestsAndErxPromise.map((elm) => elm.erxInteractionPromise()));
    const failedErxResponse = erxResponses.find((resp) => resp.interactionDetectedOrFailed);
    if (failedErxResponse) {
      console.warn('Found a failed erx response');
      return { warnings: failedErxResponse.warnings };
    }

    requestsAndErxPromise.forEach((resp) => {
      const { liveMA, liveMR } = resp;
      // Note: we do not make the cpt code Procedures at med order time -- those are created and added to the assessment at med administration time
      requests.push({ method: 'POST', url: '/MedicationAdministration', resource: liveMA });
      requests.push({ method: 'POST', url: '/MedicationRequest', resource: liveMR });
    });

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
