import {
  getFullName,
  PATIENT_GENDER_IDENTITY_URL,
  PATIENT_SEXUAL_ORIENTATION_URL,
  PRACTICE_NAME_URL,
  PRIVATE_EXTENSION_BASE_URL,
  standardizePhoneNumber,
} from 'utils';
import { DataComposer } from '../pdf-common';
import { PatientDetails, PatientDetailsInput, PdfSection } from '../types';

export const composePatientDetailsData: DataComposer<PatientDetailsInput, PatientDetails> = ({
  patient,
  physician,
}) => {
  const patientsEthnicity =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/ethnicity`)?.valueCodeableConcept
      ?.coding?.[0]?.display ?? '';
  const patientsRace =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/race`)?.valueCodeableConcept?.coding?.[0]
      ?.display ?? '';
  const howDidYouHearAboutUs =
    patient.extension?.find((e) => e.url === `${PRIVATE_EXTENSION_BASE_URL}/point-of-discovery`)?.valueString ?? '';
  const preferredLanguage = patient.communication?.find((lang) => lang.preferred)?.language.coding?.[0].display ?? '';
  const pcpName = physician ? getFullName(physician) : '';
  const pcpPracticeName =
    physician?.extension?.find((e: { url: string }) => e.url === PRACTICE_NAME_URL)?.valueString ?? '';
  const pcpAddress = physician?.address?.[0]?.text ?? '';
  const pcpPhone =
    standardizePhoneNumber(
      physician?.telecom?.find((c) => c.system === 'phone' && c.period?.end === undefined)?.value
    ) ?? '';
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
    pcpName,
    pcpPracticeName,
    pcpAddress,
    pcpPhone,
  };
};

export const createPatientDetailsSection = <TData extends { details?: PatientDetails }>(): PdfSection<
  TData,
  PatientDetails
> => ({
  title: 'Patient details',
  dataSelector: (data) => data.details,
  render: (client, details, styles) => {
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
    client.drawLabelValueRow('Race', details.patientsRace, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
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
    if (details.patientGenderIdentity === 'Other') {
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
    client.drawLabelValueRow(
      'Send marketing messages',
      details.patientCommonWellConsent ? 'Yes' : 'No',
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      'PCP first and last name',
      details.pcpName,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow(
      'PCP practice name',
      details.pcpPracticeName,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow('PCP address', details.pcpAddress, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow(
      'PCP phone number',
      details.pcpPhone,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        spacing: 16,
      }
    );
  },
});
