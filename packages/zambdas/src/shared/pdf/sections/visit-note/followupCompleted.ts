import { drawFieldLine } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, FollowupCompleted, PdfSection } from '../../types';
import { FullAppointmentResourcePackage } from '../../visit-details-pdf/types';

export const composeFollowupCompleted: DataComposer<
  { appointmentPackage: FullAppointmentResourcePackage },
  FollowupCompleted
> = ({ appointmentPackage }) => {
  const { encounter } = appointmentPackage;

  const completedDateTime = encounter.period?.end
    ? new Date(encounter.period.end).toLocaleString()
    : new Date().toLocaleString();
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
    },
  }));
};
