import { ContactPoint } from 'fhir/r4b';
import { formatDOB, genderMap, standardizePhoneNumber } from 'utils';
import { getPatientLastFirstName } from '../../../patients';
import { DataComposer } from '../../pdf-common';
import { ICON_STYLE } from '../../pdf-consts';
import { PatientInfoForDischargeSummary, PdfSection } from '../../types';
import { FullAppointmentResourcePackage } from '../../visit-details-pdf/types';

export const composePatientInformationForDischargeSummary: DataComposer<
  { appointmentPackage: FullAppointmentResourcePackage },
  PatientInfoForDischargeSummary
> = ({ appointmentPackage }) => {
  const { patient } = appointmentPackage;
  if (!patient) throw new Error('No patient found for this encounter');

  const fullName = getPatientLastFirstName(patient) ?? '';
  const dob = formatDOB(patient?.birthDate) ?? '';
  const sex = genderMap[patient.gender as keyof typeof genderMap] ?? '';
  const id = patient.id ?? '';
  const phone = standardizePhoneNumber(
    patient.telecom?.find((telecom: ContactPoint) => telecom.system === 'phone')?.value
  );
  return {
    fullName,
    dob,
    sex,
    id,
    phone,
  };
};

export const createPatientHeaderForDischargeSummary = <
  TData extends { patient?: PatientInfoForDischargeSummary },
>(): PdfSection<TData, PatientInfoForDischargeSummary> => ({
  dataSelector: (data) => data.patient,
  render: (client, data, styles, assets) => {
    client.drawText(data.fullName, styles.textStyles.patientName);

    client.drawText(`DOB: ${data.dob} | ${data.sex}`, styles.textStyles.regular);
    client.drawText(`PID: ${data.id}`, styles.textStyles.regular);
    if (data.phone) {
      client.drawImage(assets.icons!.call, ICON_STYLE, styles.textStyles.text);
      client.drawTextSequential(` ${data.phone}`, styles.textStyles.regular);
    }
  },
});
