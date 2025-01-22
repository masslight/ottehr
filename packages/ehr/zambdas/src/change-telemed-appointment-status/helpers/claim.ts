import {
  ClaimQueueHistoryExtension,
  ClaimStatusHistoryExtension,
  Cms1500,
  mapEncounterStatusHistory,
  PRIVATE_EXTENSION_BASE_URL,
} from 'utils';
import { createReference, getResourcesFromBatchInlineRequests } from 'utils';
import { cms1500ToFhir } from 'utils';
import { getInsuranceRelatedRefsFromAppointmentExtension } from '../../shared/appointment/helpers';
import { ChargeItem, Claim, Condition, Extension, Organization, Procedure } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { createSearchUrlFromReference } from '../../get-claims/helpers/fhir-utils';
import Oystehr from '@oystehr/sdk';
import { VideoResourcesAppointmentPackage } from '../../shared/pdf/visit-details-pdf/types';

export async function createClaim(
  oystehr: Oystehr,
  visitResources: VideoResourcesAppointmentPackage
): Promise<string | undefined> {
  try {
    const { patient, practitioner, encounter, appointment, location } = visitResources;
    const insuranceRelatedRefs = getInsuranceRelatedRefsFromAppointmentExtension(appointment);
    console.log(
      `claim patient: ${patient?.id}, coverage: ${insuranceRelatedRefs.primaryCoverage}, practitioner: ${practitioner?.id}, encounter: ${encounter.id}, location: ${location?.id}`
    );
    const additionalFhirResources = await getAdditionalFhirResources(oystehr, visitResources);
    const telemedStatusHistory = mapEncounterStatusHistory(encounter.statusHistory!, appointment.status);
    const payorOrganizationExtension =
      additionalFhirResources.payerOrganization?.extension?.find(
        (ext) => ext.url === `${PRIVATE_EXTENSION_BASE_URL}/npi-type-needed`
      )?.valueString === 'Group';

    if (patient && practitioner && encounter && location) {
      const cms: Cms1500 = {
        patient: createReference(patient).reference,
        primaryCoverage: insuranceRelatedRefs.primaryCoverage,
        otherCoverage: insuranceRelatedRefs.secondaryCoverage,
        billingProvider: location.managingOrganization?.reference,
        serviceFacilityLocation: createReference(location).reference,
        type: 'professional',
        totalCharge: additionalFhirResources.chargeItem?.quantity?.value ?? 0, // ???
        physicianSignedDate: telemedStatusHistory.find((el) => el.status === 'complete')?.start, // check pdf where we take this thing
        diagnosis: {
          icdIndicator: '0', // this indicator means that we are using icd-10 system
          codes: additionalFhirResources.diagnosisConditions?.map((condition) => {
            const conditionCoding = condition.code?.coding?.find(
              (coding) => coding.system === 'http://hl7.org/fhir/sid/icd-10'
            );
            return {
              code: conditionCoding?.code,
              display: conditionCoding?.display,
            };
          }),
        },
        services: [
          {
            encounter: createReference(encounter).reference,
            renderingProvider: payorOrganizationExtension
              ? location.managingOrganization?.reference
              : createReference(practitioner).reference,
            procedures: {
              cptOrHcpcs: additionalFhirResources.procedure?.note?.find((note) => note.text !== undefined)?.text ?? '1',
            },
            placeOfService: createReference(location).reference, // facility location
            diagnosisPointer: 'B', // (and it doesn't work with 0) it should be index of diagnosis, but we left it 0 for this moment
            charges: additionalFhirResources.chargeItem?.quantity?.value ?? 0, // ???
            daysOrUnits: 1, // const
            datesOfService: {
              from: telemedStatusHistory.find((el) => el.status === 'pre-video')?.start, //??
              to: telemedStatusHistory.find((el) => el.status === 'complete')?.start,
            },
          },
        ],
      };
      console.log('CMS1500 we are sending: ', JSON.stringify(cms));
      const claimResource = cms1500ToFhir(cms);
      addTagAndExtensionToClaim(claimResource);
      console.log('Claim resource we are sending: ', JSON.stringify(claimResource));
      const resultClaim = await oystehr.fhir.create(claimResource);
      return resultClaim.id;
    }
    return undefined;
  } catch (e) {
    console.error('Error during creating Claim resource: ', e);
    return undefined;
  }
}

interface FhirResourcesForClaim {
  diagnosisConditions?: Condition[];
  chargeItem?: ChargeItem;
  payerOrganization?: Organization;
  procedure?: Procedure;
}

async function getAdditionalFhirResources(
  oystehr: Oystehr,
  visitResources: VideoResourcesAppointmentPackage
): Promise<FhirResourcesForClaim> {
  const requests: string[] = [
    `/Encounter?_id=${visitResources.encounter.id}&_include=Encounter:diagnosis&_revinclude=ChargeItem:context`,
  ];
  if (visitResources.insurancePlan?.ownedBy?.reference)
    requests.push(createSearchUrlFromReference(visitResources.insurancePlan?.ownedBy?.reference));
  if (visitResources.patient?.id) requests.push(`/Procedure?subject=${visitResources.patient?.id}`);
  const resources = await getResourcesFromBatchInlineRequests(oystehr, requests);
  const diagnosis = resources.filter((res) => res.resourceType === 'Condition') as Condition[];
  const chargeItem = resources.find((res) => res.resourceType === 'ChargeItem') as ChargeItem;
  const payerOrganization = resources.find((res) => res.resourceType === 'Organization') as Organization;
  const procedure = resources.find((res) => res.resourceType === 'Procedure') as Procedure;
  return {
    diagnosisConditions: diagnosis,
    chargeItem,
    payerOrganization,
    procedure,
  };
}

function addTagAndExtensionToClaim(claimResource: Claim): void {
  if (!claimResource.meta) claimResource.meta = {};
  if (!claimResource.meta.tag) claimResource.meta.tag = [];
  claimResource.meta.tag.push(
    {
      system: 'current-queue',
      code: 'registration',
    },
    {
      system: 'current-status',
      code: 'open',
    }
  );
  if (!claimResource.extension) claimResource.extension = [];
  const statusHistory: ClaimStatusHistoryExtension = {
    url: 'status-history',
    extension: [
      {
        url: 'status-history-entry',
        extension: [
          { url: 'status', valueString: 'open' },
          { url: 'period', valuePeriod: { start: DateTime.now().toISO() ?? undefined } },
        ],
      },
    ],
  };
  const queueHistory: ClaimQueueHistoryExtension = {
    url: 'queue-history',
    extension: [
      {
        url: 'queue-history-entry',
        extension: [
          { url: 'queue', valueString: 'registration' },
          { url: 'period', valuePeriod: { start: DateTime.now().toISO() ?? undefined } },
        ],
      },
    ],
  };
  claimResource.extension.push(statusHistory as Extension, queueHistory as Extension);
}
