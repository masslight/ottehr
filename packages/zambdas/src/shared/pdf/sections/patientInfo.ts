import { DateTime } from 'luxon';
import { DATE_FORMAT, genderMap, getFormattedPatientFullName, standardizePhoneNumber } from 'utils';
import { DataComposer } from '../pdf-common';
import { PatientDataInput, PatientInfo, PdfSection } from '../types';

export const composePatientData: DataComposer<PatientDataInput, PatientInfo> = ({ patient, appointment }) => {
  const fullName = getFormattedPatientFullName(patient, { skipNickname: true }) ?? '';
  const preferredName = patient.name?.find((name) => name.use === 'nickname')?.given?.[0] ?? '';
  const dob = patient?.birthDate ? DateTime.fromFormat(patient?.birthDate, DATE_FORMAT).toFormat('MM.dd.yyyy') : '';
  const sex = genderMap[patient.gender as keyof typeof genderMap] ?? '';
  const id = patient.id ?? '';
  const phone = standardizePhoneNumber(patient.telecom?.find((telecom) => telecom.system === 'phone')?.value) ?? '';
  const reasonForVisit = appointment.description ?? '';

  return { fullName, preferredName, dob, sex, id, phone, reasonForVisit };
};

export const createPatientHeader = <TData extends { patient?: PatientInfo }>(): PdfSection<TData, PatientInfo> => ({
  dataSelector: (data) => data.patient,
  render: (client, patientInfo, styles) => {
    client.drawText(patientInfo.fullName, styles.textStyles.patientName);
    client.drawText(`PID: ${patientInfo.id}`, styles.textStyles.regular);
  },
});

export const createPatientInfoSection = <TData extends { patient?: PatientInfo }>(): PdfSection<
  TData,
  PatientInfo
> => ({
  title: 'About the patient',
  dataSelector: (data) => data.patient,
  render: (client, patientInfo, styles) => {
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
    client.drawLabelValueRow(
      'Date of birth (Unmatched)',
      patientInfo.dob,
      styles.textStyles.regular,
      styles.textStyles.regular,
      {
        drawDivider: true,
        dividerMargin: 8,
      }
    );
    client.drawLabelValueRow('Birth sex', patientInfo.sex, styles.textStyles.regular, styles.textStyles.regular, {
      drawDivider: true,
      dividerMargin: 8,
    });
    client.drawLabelValueRow(
      'Reason for visit',
      patientInfo.reasonForVisit,
      styles.textStyles.regular,
      styles.textStyles.regular,
      { spacing: 16 }
    );
  },
});
