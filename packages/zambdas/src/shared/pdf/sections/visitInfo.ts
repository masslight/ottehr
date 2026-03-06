import { Appointment } from 'fhir/r4b';
import {
  FhirAppointmentType,
  formatDateToMDYWithTime,
  getAppointmentServiceCategoryAbbreviation,
  isInPersonAppointment,
  isTelemedAppointment,
} from 'utils';
import { DataComposer } from '../pdf-common';
import { PdfSection, VisitDataInput, VisitInfo } from '../types';

export const validateVisitData = (appointment: Appointment): void => {
  if (!appointment?.id) {
    throw new Error('Visit ID is required');
  }
};

export const getVisitTypeForPdf = (appointment: Appointment): string => {
  if (isInPersonAppointment(appointment)) {
    return 'In Person';
  }

  if (isTelemedAppointment(appointment)) {
    return 'Virtual';
  }

  return '';
};

export const getBookingTypeForPdf = (appointment: Appointment): string | undefined => {
  const appointmentTypeText = appointment.appointmentType?.text?.trim().toLowerCase();

  switch (appointmentTypeText) {
    case FhirAppointmentType.walkin:
      return 'On Demand';
    case FhirAppointmentType.prebook:
    case FhirAppointmentType.posttelemed:
      return 'Scheduled';
    default:
      return undefined;
  }
};

export const composeVisitData: DataComposer<VisitDataInput, VisitInfo> = ({ appointment, location, timezone }) => {
  const type = getVisitTypeForPdf(appointment);
  const serviceCategory = getAppointmentServiceCategoryAbbreviation(appointment);
  const bookingType = getBookingTypeForPdf(appointment);
  const { date = '', time = '' } = formatDateToMDYWithTime(appointment?.start, timezone ?? 'America/New_York') ?? {};
  const locationName = location?.name ?? '';
  const reasonForVisit = appointment?.description ?? '';
  return { type, serviceCategory, bookingType, time, date, location: locationName, reasonForVisit };
};

export const createVisitInfoSection = <TData extends { visit?: VisitInfo }>(): PdfSection<TData, VisitInfo> => ({
  dataSelector: (data) => data.visit,
  shouldRender: (visitInfo) => !!visitInfo,
  render: (client, visitInfo, styles) => {
    const headerParts = [
      visitInfo.type,
      visitInfo.serviceCategory,
      visitInfo.bookingType,
      visitInfo.time,
      visitInfo.date,
    ].filter(Boolean);
    client.drawText(headerParts.join(' | '), styles.textStyles.regular);
    client.drawText(visitInfo.location ?? '', styles.textStyles.regular);
  },
});
