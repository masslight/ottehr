import { Practitioner } from 'fhir/r4b';
import { formatDateToMDYWithTime } from 'utils';
import { ParticipantInfo } from 'utils/lib/types/data/appointments/appointments.types';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, PhysicianData } from '../../types';
import { FullAppointmentResourcePackage } from '../../visit-details-pdf/types';

const parseParticipantInfo = (practitioner: Practitioner): ParticipantInfo => ({
  firstName: practitioner.name?.[0]?.given?.[0] ?? '',
  lastName: practitioner.name?.[0]?.family ?? '',
});

export const composePhysician: DataComposer<{ appointmentPackage: FullAppointmentResourcePackage }, PhysicianData> = ({
  appointmentPackage,
}) => {
  const { encounter, practitioners, timezone } = appointmentPackage;
  const attenderParticipant = encounter.participant?.find(
    (p) => p?.type?.find((t) => t?.coding?.find((coding) => coding.code === 'ATND'))
  );
  const attenderPractitionerId = attenderParticipant?.individual?.reference?.split('/').at(-1);
  const attenderPractitioner = practitioners?.find((practitioner) => practitioner.id === attenderPractitionerId);

  const { firstName: physicianFirstName, lastName: physicianLastName } = attenderPractitioner
    ? parseParticipantInfo(attenderPractitioner)
    : {};

  const { date: dischargedDate, time: dischargeTime } =
    formatDateToMDYWithTime(attenderParticipant?.period?.end, timezone ?? 'America/New_York') ?? {};
  const dischargeDateTime = dischargedDate && dischargeTime ? `${dischargedDate} at ${dischargeTime}` : undefined;

  return { name: `${physicianFirstName} ${physicianLastName}`, dischargeDateTime };
};

export const createPhysicianSection = <TData extends { physician?: PhysicianData }>(): PdfSection<
  TData,
  PhysicianData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Treating provider:',
    dataSelector: (data) => data.physician,
    render: (client, data, styles) => {
      client.drawText(data.name, styles.textStyles.regular);
      if (data.dischargeDateTime) {
        client.drawSeparatedLine(styles.lineStyles.separator);
        client.drawText('Discharged:', styles.textStyles.subHeader);
        client.drawText(data.dischargeDateTime, styles.textStyles.regular);
      }
    },
  }));
};
