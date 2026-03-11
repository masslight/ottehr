import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, HistoryOfPresentIllness, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeHistoryOfPresentIllness: DataComposer<{ allChartData: AllChartData }, HistoryOfPresentIllness> = ({
  allChartData,
}) => {
  const { chartData } = allChartData;
  const historyOfPresentIllness = chartData.chiefComplaint?.text;

  return {
    historyOfPresentIllness,
  };
};

export const createHistoryOfPresentIllnessSection = <
  TData extends {
    encounter?: EncounterInfo;
    historyOfPresentIllness?: HistoryOfPresentIllness;
  },
>(): PdfSection<TData, HistoryOfPresentIllness> => {
  return createConfiguredSection(null, () => ({
    title: 'History of Present Illness',
    dataSelector: (data) => data.historyOfPresentIllness,
    shouldRender: (sectionData) => !!sectionData.historyOfPresentIllness,
    render: (client, data, styles) => {
      drawRegularText(client, styles, data.historyOfPresentIllness);

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
