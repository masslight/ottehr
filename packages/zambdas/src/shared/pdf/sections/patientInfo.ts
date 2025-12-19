import {
  FHIR_EXTENSION,
  formatDateForDisplay,
  genderMap,
  getFormattedPatientFullName,
  getNameSuffix,
  getUnconfirmedDOBForAppointment,
  PATIENT_INDIVIDUAL_PRONOUNS_URL,
  standardizePhoneNumber,
} from 'utils';
import { createConfiguredSection, DataComposer } from '../pdf-common';
import { PatientDataInput, PatientInfo, PdfSection } from '../types';

export const composePatientData: DataComposer<PatientDataInput, PatientInfo> = ({ patient, appointment }) => {
  const fullName = getFormattedPatientFullName(patient, { skipNickname: true }) ?? '';
  const suffix = getNameSuffix(patient) ?? '';
  const preferredName = patient.name?.find((name) => name.use === 'nickname')?.given?.[0] ?? '';
  const dob = formatDateForDisplay(patient?.birthDate) ?? '';
  const unconfirmedDOB = formatDateForDisplay(getUnconfirmedDOBForAppointment(appointment));
  const sex = genderMap[patient.gender as keyof typeof genderMap] ?? '';
  const id = patient.id ?? '';
  const phone = standardizePhoneNumber(patient.telecom?.find((telecom) => telecom.system === 'phone')?.value) ?? '';
  const reasonForVisit = appointment.description ?? '';
  const authorizedNonlegalGuardians =
    patient?.extension?.find((e) => e.url === FHIR_EXTENSION.Patient.authorizedNonLegalGuardians.url)?.valueString ||
    'none';
  const pronouns =
    patient.extension?.find((e) => e.url === PATIENT_INDIVIDUAL_PRONOUNS_URL)?.valueCodeableConcept?.coding?.[0]
      ?.display ?? '';
  let patientSex = '';
  if (patient?.gender === 'male') {
    patientSex = 'Male';
  } else if (patient?.gender === 'female') {
    patientSex = 'Female';
  } else if (patient?.gender !== undefined) {
    patientSex = 'Intersex';
  }
  const ssn =
    patient?.identifier?.find(
      (id) => id.system === 'http://hl7.org/fhir/sid/us-ssn' && id.type?.coding?.[0]?.code === 'SS'
    )?.value ?? '';

  return {
    fullName,
    suffix,
    preferredName,
    dob,
    unconfirmedDOB,
    sex,
    id,
    phone,
    reasonForVisit,
    authorizedNonlegalGuardians,
    pronouns,
    ssn,
    patientSex,
  };
};

export const createPatientHeader = <TData extends { patient?: PatientInfo }>(): PdfSection<TData, PatientInfo> => ({
  dataSelector: (data) => data.patient,
  render: (client, patientInfo, styles) => {
    client.drawText(patientInfo.fullName, styles.textStyles.patientName);
    client.drawText(`PID: ${patientInfo.id}`, styles.textStyles.regular);
  },
});

export const createPatientInfoSection = <TData extends { patient?: PatientInfo }>(): PdfSection<TData, PatientInfo> => {
  return createConfiguredSection('patientSummary', (shouldShow) => ({
    title: 'About the patient',
    dataSelector: (data) => data.patient,
    render: (client, patientInfo, styles) => {
      if (shouldShow('patient-name-suffix')) {
        client.drawLabelValueRow('Suffix', patientInfo.suffix, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('patient-preferred-name')) {
        client.drawLabelValueRow(
          'Chosen or preferred name',
          patientInfo.preferredName,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-birthdate')) {
        client.drawLabelValueRow(
          'Date of birth (Original)',
          patientInfo.dob,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (patientInfo.unconfirmedDOB) {
        client.drawLabelValueRow(
          'Date of birth (Unmatched)',
          patientInfo.unconfirmedDOB,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-birth-sex')) {
        client.drawLabelValueRow('Birth sex', patientInfo.sex, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      if (shouldShow('patient-pronouns')) {
        client.drawLabelValueRow(
          'Preferred pronouns',
          patientInfo.pronouns,
          styles.textStyles.regular,
          styles.textStyles.regular,
          {
            drawDivider: true,
            dividerMargin: 8,
          }
        );
      }
      if (shouldShow('patient-ssn')) {
        client.drawLabelValueRow('SSN', patientInfo.ssn, styles.textStyles.regular, styles.textStyles.regular, {
          drawDivider: true,
          dividerMargin: 8,
        });
      }
      client.drawLabelValueRow(
        'Reason for visit',
        patientInfo.reasonForVisit,
        styles.textStyles.regular,
        styles.textStyles.regular,
        {
          drawDivider: true,
          dividerMargin: 8,
        }
      );
      client.drawLabelValueRow(
        'Authorized non-legal guardian(s)',
        patientInfo.authorizedNonlegalGuardians,
        styles.textStyles.regular,
        styles.textStyles.regular,
        { spacing: 16 }
      );
    },
  }));
};
