import { getSpentTime, isInPersonAppointment } from 'utils';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { ChiefComplaint, EncounterInfo, PdfSection, ProgressNoteVisitDataInput } from '../../types';

export const composeChiefComplaint: DataComposer<ProgressNoteVisitDataInput, ChiefComplaint> = ({
  allChartData,
  appointmentPackage,
}) => {
  const { chartData } = allChartData;
  const { encounter, appointment } = appointmentPackage;
  const chiefComplaint = chartData.historyOfPresentIllness?.text;
  const spentTime = chartData.addToVisitNote?.value ? getSpentTime(encounter.statusHistory) ?? '' : '';
  const isInPerson = isInPersonAppointment(appointment);

  return {
    chiefComplaint,
    spentTime,
    isInPerson,
  };
};

export const createChiefComplaintSection = <
  TData extends {
    encounter?: EncounterInfo;
    chiefComplaint?: ChiefComplaint;
  },
>(): PdfSection<TData, ChiefComplaint> => {
  return createConfiguredSection(null, () => ({
    title: 'Additional information',
    dataSelector: (data) => data.chiefComplaint,
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
