import { PATIENT_GENDER_IDENTITY_URL, PATIENT_SEXUAL_ORIENTATION_URL, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { PatientDetails, PatientDetailsInput, PdfSection } from '../types';

export const composePatientDetailsData: DataComposer<PatientDetailsInput, PatientDetails> = ({ patient }) => {
  const patientsEthnicity =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`)?.valueCodeableConcept
      ?.coding?.[0]?.display ?? '';
  const patientsRace =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/race`)?.valueCodeableConcept?.coding?.[0]
      ?.display ?? '';
  const howDidYouHearAboutUs =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`)?.valueString ?? '';
  const preferredLanguage = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display ?? '';
  const patientSendMarketing =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/send-marketing`)?.valueBoolean ?? false;
  const patientCommonWellConsent =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/common-well-consent`)?.valueBoolean ??
    false;
  const patientSexualOrientation =
    patient.extension?.find((e) => e.url === PATIENT_SEXUAL_ORIENTATION_URL)?.valueCodeableConcept?.coding?.[0]
      ?.display ?? '';
  const patientGenderIdentity =
    patient.extension?.find((e) => e.url === PATIENT_GENDER_IDENTITY_URL)?.valueCodeableConcept?.coding?.[0]?.display ??
    '';
  const patientGenderIdentityDetails =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/individual-genderIdentity`)?.valueString ??
    '';

  return {
    patientsEthnicity,
    patientsRace,
    patientSexualOrientation,
    patientGenderIdentity,
    patientGenderIdentityDetails,
    howDidYouHearAboutUs,
    patientSendMarketing,
    preferredLanguage,
    patientCommonWellConsent,
  };
};

export const createPatientDetailsSection = <TData extends { details?: PatientDetails }>(): PdfSection<
  TData,
  PatientDetails
> => {
  return createConfiguredSection('patientDetails', (shouldShow) => ({
    title: 'Patient details',
    dataSelector: (data) => data.details,
    render: (client, details, styles) => {
      if (shouldShow('patient-ethnicity')) {
        client.drawLabelValueRow(
          'Ethnicity',
          details.patientsEthnicity,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-race')) {
        client.drawLabelValueRow('Race', details.patientsRace, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('patient-sexual-orientation')) {
        client.drawLabelValueRow(
          'Sexual orientation',
          details.patientSexualOrientation,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-gender-identity')) {
        client.drawLabelValueRow(
          'Gender identity',
          details.patientGenderIdentity,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-gender-identity-details') && details.patientGenderIdentity === 'Other') {
        client.drawLabelValueRow(
          '',
          details.patientGenderIdentityDetails,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-point-of-discovery')) {
        client.drawLabelValueRow(
          'How did you hear about us',
          details.howDidYouHearAboutUs,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('mobile-opt-in')) {
        client.drawLabelValueRow(
          'Send marketing messages',
          details.patientSendMarketing ? 'Yes' : 'No',
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('preferred-language')) {
        client.drawLabelValueRow(
          'Preferred language',
          details.preferredLanguage,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('common-well-consent')) {
        client.drawLabelValueRow(
          'CommonWell consent',
          details.patientCommonWellConsent ? 'Yes' : 'No',
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            spacing: 16,
          }
        );
      }
    },
  }));
};
