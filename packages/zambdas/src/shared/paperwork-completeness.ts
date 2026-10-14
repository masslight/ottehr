import { DocumentReference, Encounter, Patient, QuestionnaireResponse, QuestionnaireResponseItem } from 'fhir/r4b';
import { getAttestedConsentFromEncounter } from 'utils/lib/fhir/helpers';
import { isPatientDemographicsComplete } from 'utils/lib/fhir/patient';
import { flattenItems } from 'utils/lib/helpers/paperwork/validation';
import { CONSENT_FORMS_CONFIG } from 'utils/lib/ottehr-config/consent-forms';

export interface PaperworkCompleteness {
  demographics: boolean;
  photoID: boolean;
  insuranceCard: boolean;
  consent: boolean;
  consentByPaperworkSignatures: boolean;
  consentByStaffAttestation: boolean;
  ovrpInterest: boolean;
}

export const getPaperworkCompleteness = ({
  patient,
  encounter,
  questionnaireResponse,
  docRefs,
}: {
  patient: Patient | undefined;
  encounter: Encounter | undefined;
  questionnaireResponse: QuestionnaireResponse | undefined;
  docRefs: DocumentReference[];
}): PaperworkCompleteness => {
  const flattenedItems = flattenItems(questionnaireResponse?.item ?? []);

  const consentComplete =
    CONSENT_FORMS_CONFIG.forms.every(
      (form) =>
        flattenedItems.find((item: { linkId: string }) => item.linkId === form.id)?.answer?.[0]?.valueBoolean === true
    ) &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'signature') &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'full-name') &&
    flattenedItems.find((item: { linkId: string }) => item.linkId === 'consent-form-signer-relationship');

  const docRefComplete = (type: string, frontTitle: string): boolean => {
    const docFound = docRefs.filter(
      (document) =>
        document.context?.related?.find((related) => related.reference === `Patient/${patient?.id}`) &&
        document.type?.text === type
    );
    return !!docFound.find((doc) => doc.content.find((content) => content.attachment.title === frontTitle));
  };

  const ovrpInterest = flattenedItems.find((response: QuestionnaireResponseItem) => response.linkId === 'ovrp-interest')
    ?.answer?.[0]?.valueString;

  // if the QR has been updated at least once, this tag will not be present
  const demographicsByPaperworkSubmission = !!questionnaireResponse?.authored;
  const demographicsByPatientResource = patient ? isPatientDemographicsComplete(patient) : false;
  const consentByPaperworkSignatures = !!consentComplete;
  const consentByStaffAttestation = !!(encounter && getAttestedConsentFromEncounter(encounter));

  return {
    demographics: demographicsByPaperworkSubmission || demographicsByPatientResource,
    photoID: docRefComplete('Photo ID cards', 'photo-id-front'),
    insuranceCard: docRefComplete('Insurance cards', 'insurance-card-front'),
    consent: consentByPaperworkSignatures || consentByStaffAttestation,
    consentByPaperworkSignatures,
    consentByStaffAttestation,
    ovrpInterest: Boolean(ovrpInterest && ovrpInterest.startsWith('Yes')),
  };
};
