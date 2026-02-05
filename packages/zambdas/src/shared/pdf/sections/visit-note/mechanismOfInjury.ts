import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, MechanismOfInjury, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeMechanismOfInjury: DataComposer<{ allChartData: AllChartData }, MechanismOfInjury> = ({
  allChartData,
}) => {
  const { chartData } = allChartData;

  const mechanismOfInjury = chartData.mechanismOfInjury?.text;
  return {
    mechanismOfInjury,
  };
};

export const createMechanismOfInjurySection = <
  TData extends {
    encounter?: EncounterInfo;
    mechanismOfInjury?: MechanismOfInjury;
  },
>(): PdfSection<TData, MechanismOfInjury> => {
  return createConfiguredSection(null, () => ({
    title: 'Mechanism of Injury',
    dataSelector: (data) => data.mechanismOfInjury,
    shouldRender: (sectionData, rootData) => !rootData?.encounter?.isFollowup && !!sectionData.mechanismOfInjury,
    render: (client, data, styles) => {
      drawRegularText(client, styles, data.mechanismOfInjury);
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
