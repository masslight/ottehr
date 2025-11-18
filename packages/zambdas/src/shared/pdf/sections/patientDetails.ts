import {
  getFullName,
  PATIENT_INDIVIDUAL_PRONOUNS_URL,
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
  const pronouns =
    patient.extension?.find((e) => e.url === PATIENT_INDIVIDUAL_PRONOUNS_URL)?.valueCodeableConcept?.coding?.[0]
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

  return {
    patientsEthnicity,
    patientsRace,
    pronouns,
    howDidYouHearAboutUs,
    preferredLanguage,
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
    client.drawLabelValueRow('Pronouns', details.pronouns, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
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
