import { isInPersonAppointment, NOTE_TYPE } from 'utils';
import { mapResourceByNameField } from '../../helpers/mappers';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, ProgressNoteVisitDataInput, SurgicalHistoryData } from '../../types';

export const composeSurgicalHistory: DataComposer<ProgressNoteVisitDataInput, SurgicalHistoryData> = ({
  allChartData,
  appointmentPackage,
}) => {
  const { chartData, additionalChartData } = allChartData;
  const { appointment } = appointmentPackage;
  const surgicalHistory = chartData.surgicalHistory ? mapResourceByNameField(chartData.surgicalHistory) : [];
  const isInPerson = isInPersonAppointment(appointment);
  const surgicalHistoryNotes = isInPerson
    ? additionalChartData?.notes?.filter((note) => note.type === NOTE_TYPE.SURGICAL_HISTORY)?.map((note) => note.text)
    : additionalChartData?.surgicalHistoryNote?.text
    ? [additionalChartData?.surgicalHistoryNote?.text]
    : [];
  return {
    surgicalHistory,
    surgicalHistoryNotes,
  };
};

export const createSurgicalHistorySection = <TData extends { surgicalHistory?: SurgicalHistoryData }>(): PdfSection<
  TData,
  SurgicalHistoryData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Surgical history',
    dataSelector: (data) => data.surgicalHistory,
    shouldRender: (sectionData) => !!sectionData.surgicalHistory?.length || !!sectionData.surgicalHistoryNotes?.length,
    render: (client, data, styles) => {
      if (data.surgicalHistory?.length) {
        data.surgicalHistory.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      } else {
        drawRegularText(client, styles, 'No surgical history');
      }

      if (data.surgicalHistoryNotes && data.surgicalHistoryNotes.length > 0) {
        drawBlockHeader(client, styles, 'Surgical history notes', styles.textStyles.blockSubHeader);
        data.surgicalHistoryNotes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
