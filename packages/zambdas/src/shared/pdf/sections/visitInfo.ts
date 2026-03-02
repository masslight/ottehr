import { Appointment } from 'fhir/r4b';
import { formatDateToMDYWithTime, getAppointmentServiceCategoryAbbreviation, getAppointmentType } from 'utils';
import { DataComposer } from '../pdf-common';
import { PdfSection, VisitDataInput, VisitInfo } from '../types';

export const validateVisitData = (appointment: Appointment): void => {
  if (!appointment?.id) {
    throw new Error('Visit ID is required');
  }
};

export const composeVisitData: DataComposer<VisitDataInput, VisitInfo> = ({ appointment, location, timezone }) => {
  const { type } = getAppointmentType(appointment);
  const serviceCategory = getAppointmentServiceCategoryAbbreviation(appointment);
  const { date = '', time = '' } = formatDateToMDYWithTime(appointment?.start, timezone ?? 'America/New_York') ?? {};
  const locationName = location?.name ?? '';
  const reasonForVisit = appointment?.description ?? '';
  return { type, serviceCategory, time, date, location: locationName, reasonForVisit };
};

export const createVisitInfoSection = <TData extends { visit?: VisitInfo }>(): PdfSection<TData, VisitInfo> => ({
  dataSelector: (data) => data.visit,
  shouldRender: (visitInfo) => !!visitInfo?.type,
  render: (client, visitInfo, styles) => {
    const headerParts = [visitInfo.type, visitInfo.serviceCategory, visitInfo.time, visitInfo.date].filter(Boolean);
    client.drawText(headerParts.join(' | '), styles.textStyles.regular);
    client.drawText(visitInfo.location ?? '', styles.textStyles.regular);
  },
});
