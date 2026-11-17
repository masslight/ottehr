import { Encounter, QuestionnaireResponse } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { formatFhirEncounterToPatientFollowupDetails, isAnnotationFollowupEncounter } from 'utils/lib/fhir/encounter';
import { getProviderNameWithProfession } from 'utils/lib/fhir/helpers';
import { isInPersonAppointment } from 'utils/lib/fhir/moduleIdentification';
import { getAdmitterPractitionerId, getAttendingPractitionerId } from 'utils/lib/fhir/practitioners';
import { getQuestionnaireResponseByLinkId } from 'utils/lib/helpers/paperwork/paperwork-response';
import { Timezone } from 'utils/lib/types/common';
import { formatDateTimeToZone } from 'utils/lib/utils/date';
import { getPatientLastFirstName } from '../../../patients';
import { drawFieldLine } from '../../helpers/render/drawFieldLine';
import { drawRegularText } from '../../helpers/render/regularText';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfClient, PdfSection, PdfStyles, ProgressNoteVisitDataInput, VisitDetailsForProgressNote } from '../../types';

function getStatusRelatedDates(
  encounter: Encounter,
  timezone: Timezone
): { dateOfService?: string; signedOnDate?: string } {
  const dateOfService = formatDateTimeToZone(
    (encounter.statusHistory ?? []).find((item) => item.status === 'in-progress')?.period?.start,
    timezone
  );
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
  // Only annotation follow-ups render the abbreviated visit-note layout — scheduled
  // follow-ups are full visits and get the same details as a main appointment.
  const isFollowup = encounter ? isAnnotationFollowupEncounter(encounter) : false;
  if (!patient) throw new Error('No patient found for this encounter');
  const patientName = getPatientLastFirstName(patient);
  const personAccompanying = getPersonAccompanying(questionnaireResponse);
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
      personAccompanying,
    };
  } else {
    const { dateOfService, signedOnDate } = getStatusRelatedDates(mainEncounter ?? encounter, timezone);
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
      personAccompanying,
    };
  }
};

type VisitDetailsField = { label: string; value?: string };

const FIELD_LABEL_GAP = 4;

const drawVisitDetailsField = (client: PdfClient, styles: PdfStyles, { label, value }: VisitDetailsField): void => {
  drawFieldLine(client, styles, { label: `${label}:`, value, gap: FIELD_LABEL_GAP });
};

const fitsInWidth = (
  client: PdfClient,
  styles: PdfStyles,
  { label, value }: VisitDetailsField,
  width: number
): boolean => {
  const labelWidth = client.getTextDimensions(`${label}:`, styles.textStyles.fieldHeader).width + FIELD_LABEL_GAP;
  const longestWord = Math.max(
    0,
    ...(value ?? '').split(/\s+/).map((word) => client.getTextDimensions(word, styles.textStyles.fieldText).width)
  );
  return labelWidth + longestWord <= width;
};

// Fields that can't wrap into a column (no spaces) get full-width rows after the columns.
const drawVisitDetailsColumns = (
  client: PdfClient,
  styles: PdfStyles,
  leftFields: VisitDetailsField[],
  rightFields: VisitDetailsField[]
): void => {
  const leftBound = client.getLeftBound();
  const rightBound = client.getRightBound();
  const middle = leftBound + (rightBound - leftBound) / 2;
  const fullWidthFields: VisitDetailsField[] = [];
  const columns = [
    { fields: leftFields, left: leftBound, right: middle - 10 },
    { fields: rightFields, left: middle + 10, right: rightBound },
  ].map((column) => ({
    ...column,
    fields: column.fields.filter((field) => {
      const fits = fitsInWidth(client, styles, field, column.right - column.left);
      if (!fits) fullWidthFields.push(field);
      return fits;
    }),
  }));

  for (let row = 0; row < Math.max(...columns.map(({ fields }) => fields.length)); row++) {
    const rowStartPage = client.getCurrentPageIndex();
    const rowStartY = client.getY();
    let rowEndY = rowStartY;

    columns.forEach(({ fields, left, right }) => {
      const field = fields[row];
      if (!field) return;
      const pageBeforeCell = client.getCurrentPageIndex();
      client.setY(pageBeforeCell === rowStartPage ? rowStartY : client.getPageTopY());
      client.setLeftBound(left);
      client.setRightBound(right);
      drawVisitDetailsField(client, styles, field);
      rowEndY = client.getCurrentPageIndex() === pageBeforeCell ? Math.min(rowEndY, client.getY()) : client.getY();
    });

    client.setY(rowEndY);
  }

  client.setLeftBound(leftBound);
  client.setRightBound(rightBound);
  client.setX(leftBound);
  fullWidthFields.forEach((field) => drawVisitDetailsField(client, styles, field));
};

export const createProgressNoteVisitDetailsSection = <
  TData extends { visit: VisitDetailsForProgressNote },
>(): PdfSection<TData, VisitDetailsForProgressNote> => {
  return createConfiguredSection(null, () => ({
    title: 'Visit Details',
    dataSelector: (data) => data.visit,
    render: (client, data, styles) => {
      if (data.visitType === 'followup') {
        const fields: VisitDetailsField[] = [
          { label: 'Reason', value: data.reason },
          { label: 'Other reason', value: data.otherReason },
          { label: 'Follow-up provider', value: data.provider?.name },
          { label: 'Location', value: data.location?.name },
          { label: 'Comment', value: data.message },
          { label: 'Person accompanying the minor patient', value: data.personAccompanying },
        ];
        fields.filter((field) => field.value).forEach((field) => drawVisitDetailsField(client, styles, field));
      } else {
        const leftFields: VisitDetailsField[] = [
          { label: 'Reason for visit', value: data.reasonForVisit },
          { label: 'Provider', value: data.provider },
          ...(data.intakePerson ? [{ label: 'Intake completed by', value: data.intakePerson }] : []),
          { label: 'Date of Service', value: data.dateOfService },
          { label: 'Signed on', value: data.signedOn },
          ...(data.personAccompanying
            ? [{ label: 'Person accompanying the minor patient', value: data.personAccompanying }]
            : []),
        ];
        const rightFields: VisitDetailsField[] = [
          ...(data.insuranceCompany ? [{ label: 'Insurance Company', value: data.insuranceCompany }] : []),
          ...(data.insuranceSubscriberId ? [{ label: 'Subscriber ID', value: data.insuranceSubscriberId }] : []),
          { label: 'Visit State', value: data.visitState },
          { label: 'Address', value: data.address },
          { label: 'Visit ID', value: data.visitID },
        ];
        drawVisitDetailsColumns(client, styles, leftFields, rightFields);
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

function getPersonAccompanying(questionnaireResponse?: QuestionnaireResponse): string | undefined {
  if (!questionnaireResponse) return;

  const firstName = getQuestionnaireResponseByLinkId('person-accompanying-minor-first-name', questionnaireResponse)
    ?.answer?.[0]?.valueString;
  const lastName = getQuestionnaireResponseByLinkId('person-accompanying-minor-last-name', questionnaireResponse)
    ?.answer?.[0]?.valueString;

  if (!firstName && !lastName) return;

  return [lastName, firstName].filter(Boolean).join(', ');
}
