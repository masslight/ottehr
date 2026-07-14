import { DateTime } from 'luxon';
import { formatDateTimeToZone } from 'utils';
import { drawFieldLine } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, FollowupCompleted, PdfSection } from '../../types';
import { FullAppointmentResourcePackage } from '../../visit-details-pdf/types';

export const composeFollowupCompleted: DataComposer<
  { appointmentPackage: FullAppointmentResourcePackage },
  FollowupCompleted
> = ({ appointmentPackage }) => {
  const { encounter, timezone } = appointmentPackage;

  const endIso = encounter.period?.end ?? DateTime.now().toISO();
  const completedDateTime = formatDateTimeToZone(endIso ?? undefined, timezone) ?? '';
  return {
    completedDateTime,
  };
};

export const createFollowupCompletedSection = <
  TData extends {
    encounter?: EncounterInfo;
    followupCompleted?: FollowupCompleted;
  },
>(): PdfSection<TData, FollowupCompleted> => {
  return createConfiguredSection(null, () => ({
    dataSelector: (data) => data.followupCompleted,
    shouldRender: (_sectionData, rootData) => !!rootData?.encounter?.isFollowup,
    render: (client, data, styles) => {
      drawFieldLine(client, styles, { label: 'Follow-up completed', value: data.completedDateTime });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
