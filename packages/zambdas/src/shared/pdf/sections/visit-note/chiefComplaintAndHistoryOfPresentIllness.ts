import { getSpentTime, isInPersonAppointment } from 'utils';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import {
  ChiefComplaintAndHistoryOfPresentIllness,
  EncounterInfo,
  PdfSection,
  ProgressNoteVisitDataInput,
} from '../../types';

export const composeChiefComplaintAndHistoryOfPresentIllness: DataComposer<
  ProgressNoteVisitDataInput,
  ChiefComplaintAndHistoryOfPresentIllness
> = ({ allChartData, appointmentPackage }) => {
  const { chartData } = allChartData;
  const { encounter, appointment } = appointmentPackage;
  const chiefComplaint = chartData.chiefComplaint?.text;
  const spentTime = chartData.addToVisitNote?.value ? getSpentTime(encounter.statusHistory) ?? '' : '';
  const isInPerson = isInPersonAppointment(appointment);

  return {
    chiefComplaint,
    spentTime,
    isInPerson,
  };
};

export const createChiefComplaintAndHistoryOfPresentIllnessSection = <
  TData extends {
    encounter?: EncounterInfo;
    chiefComplaintAndHistoryOfPresentIllness?: ChiefComplaintAndHistoryOfPresentIllness;
  },
>(): PdfSection<TData, ChiefComplaintAndHistoryOfPresentIllness> => {
  return createConfiguredSection(null, () => ({
    title: 'Chief complaint & History of Present Illness',
    dataSelector: (data) => data.chiefComplaintAndHistoryOfPresentIllness,
    shouldRender: (sectionData, rootData) =>
      !rootData?.encounter?.isFollowup && (!!sectionData.chiefComplaint || !!sectionData.spentTime),
    render: (client, data, styles) => {
      if (data.chiefComplaint && data.chiefComplaint.length > 0) {
        drawRegularText(client, styles, data.chiefComplaint);
      }
      if (data.spentTime && !data.isInPerson) {
        client.drawText(
          `Provider spent ${data.spentTime} minutes on real-time audio & video with this patient`,
          styles.textStyles.smallGreyText
        );
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
