import { Appointment, Encounter } from 'fhir/r4b';
import { DateTime } from 'luxon';
import {
  formatDateTimeToZone,
  formatFhirEncounterToPatientFollowupDetails,
  getAdmitterPractitionerId,
  getAttendingPractitionerId,
  getProviderNameWithProfession,
  getQuestionnaireResponseByLinkId,
  getTelemedEncounterStatusHistory,
  isFollowupEncounter,
  isInPersonAppointment,
  Timezone,
} from 'utils';
import { getPatientLastFirstName } from '../../../patients';
import { drawFieldLine, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, ProgressNoteVisitDataInput, VisitDetailsForProgressNote } from '../../types';

function getStatusRelatedDates(
  encounter: Encounter,
  appointment: Appointment,
  timezone: Timezone
): { dateOfService?: string; signedOnDate?: string } {
  const statuses =
    encounter.statusHistory && appointment?.status
      ? getTelemedEncounterStatusHistory(encounter.statusHistory, appointment.status)
      : undefined;
  const dateOfService = formatDateTimeToZone(statuses?.find((item) => item.status === 'on-video')?.start, timezone);
  const currentTimeISO = DateTime.now().toISO();
  const signedOnDate = formatDateTimeToZone(currentTimeISO, timezone);

  return { dateOfService, signedOnDate };
}

export const composeProgressNoteVisitDetails: DataComposer<ProgressNoteVisitDataInput, VisitDetailsForProgressNote> = ({
  allChartData,
  appointmentPackage,
}) => {
  const { additionalChartData } = allChartData;
  const { patient, encounter, mainEncounter, appointment, location, questionnaireResponse, practitioners, timezone } =
    appointmentPackage;
  const isFollowup = encounter ? isFollowupEncounter(encounter) : false;
  if (!patient) throw new Error('No patient found for this encounter');
  const patientName = getPatientLastFirstName(patient);
  if (isFollowup && encounter) {
    const followupDetails = formatFhirEncounterToPatientFollowupDetails(encounter, patientName ?? '', location);

    const provider =
      followupDetails.provider ??
      (practitioners?.[0]
        ? {
            practitionerId: practitioners[0].id ?? '',
            name: getProviderNameWithProfession(practitioners[0]),
          }
        : undefined);

    return {
      visitType: 'followup',
      reason: followupDetails.reason,
      otherReason: followupDetails.reason === 'Other' ? followupDetails.otherReason : undefined,
      message: followupDetails.message,
      location: followupDetails.location ?? location,
      provider,
    };
  } else {
    const { dateOfService, signedOnDate } = getStatusRelatedDates(mainEncounter ?? encounter, appointment, timezone);
    const reasonForVisit = appointment?.description ?? '';
    let providerName: string;
    let intakePersonName: string | undefined = undefined;

    if (isInPersonAppointment(appointment)) {
      const admitterId = getAdmitterPractitionerId(encounter);
      const admitterPractitioner = additionalChartData?.practitioners?.find(
        (practitioner) => practitioner.id === admitterId
      );
      intakePersonName = admitterPractitioner && getProviderNameWithProfession(admitterPractitioner);

      const attenderId = getAttendingPractitionerId(encounter);
      const attenderPractitioner = additionalChartData?.practitioners?.find(
        (practitioner) => practitioner.id === attenderId
      );
      providerName = (attenderPractitioner && getProviderNameWithProfession(attenderPractitioner)) ?? '';
    } else {
      providerName = practitioners?.[0] ? getProviderNameWithProfession(practitioners[0]) : '';
    }
    const visitID = appointment.id ?? '';
    const visitState = location?.address?.state ?? '';
    const address =
      getQuestionnaireResponseByLinkId('patient-street-address', questionnaireResponse)?.answer?.[0].valueString ?? '';
    const insuranceCompany = appointmentPackage.insurancePlan?.name;
    const subscriberID = getQuestionnaireResponseByLinkId('insurance-member-id', questionnaireResponse)?.answer?.[0]
      .valueString;

    return {
      visitType: 'initial',
      dateOfService: dateOfService ?? '',
      reasonForVisit,
      provider: providerName,
      intakePerson: intakePersonName,
      signedOn: signedOnDate ?? '',
      visitID,
      visitState,
      insuranceCompany,
      insuranceSubscriberId: subscriberID,
      address,
    };
  }
};

export const createProgressNoteVisitDetailsSection = <
  TData extends { visit: VisitDetailsForProgressNote },
>(): PdfSection<TData, VisitDetailsForProgressNote> => {
  return createConfiguredSection(null, () => ({
    title: 'Visit Details',
    dataSelector: (data) => data.visit,
    render: (client, data, styles) => {
      if (data.visitType === 'followup') {
        if (data.reason) {
          drawFieldLine(client, styles, { label: 'Reason', value: data.reason });
        }
        if (data.otherReason) {
          drawFieldLine(client, styles, { label: 'Other reason', value: data.otherReason });
        }
        if (data.provider?.name) {
          drawFieldLine(client, styles, { label: 'Follow-up provider', value: data.provider.name });
        }
        if (data.location?.name) {
          drawFieldLine(client, styles, { label: 'Location', value: data.location.name });
        }
        if (data.message) {
          drawFieldLine(client, styles, { label: 'Comment', value: data.message });
        }
      } else {
        drawFieldLine(client, styles, { label: 'Date of Service', value: data.dateOfService });
        drawFieldLine(client, styles, { label: 'Reason for Visit', value: data.reasonForVisit });
        drawFieldLine(client, styles, { label: 'Provider', value: data.provider });
        if (data.intakePerson) {
          drawFieldLine(client, styles, { label: 'Intake completed by', value: data.intakePerson });
        }
        drawFieldLine(client, styles, { label: 'Signed On', value: data.signedOn });
        drawFieldLine(client, styles, { label: 'Visit ID', value: data.visitID });
        drawFieldLine(client, styles, { label: 'Visit State', value: data.visitState });
        if (data.insuranceCompany) {
          drawFieldLine(client, styles, { label: 'Insurance Company', value: data.insuranceCompany });
        }
        if (data.insuranceSubscriberId) {
          drawFieldLine(client, styles, { label: 'Subscriber ID', value: data.insuranceSubscriberId });
        }
        drawFieldLine(client, styles, { label: 'Address', value: data.address });
      }

      drawRegularText(
        client,
        styles,
        'Provider confirmed patient’s name, DOB, introduced themselves, and gave their licensure and credentials.'
      );
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
