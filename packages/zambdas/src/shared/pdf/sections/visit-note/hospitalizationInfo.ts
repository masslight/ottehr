import { NOTE_TYPE } from 'utils';
import { mapResourceByNameField } from '../../helpers/mappers';
import { drawBlockHeader, drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { HospitalizationData, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeHospitalization: DataComposer<{ allChartData: AllChartData }, HospitalizationData> = ({
  allChartData,
}) => {
  const { additionalChartData } = allChartData;
  const hospitalization =
    additionalChartData?.episodeOfCare && mapResourceByNameField(additionalChartData.episodeOfCare);
  const hospitalizationNotes = additionalChartData?.notes
    ?.filter((note) => note.type === NOTE_TYPE.HOSPITALIZATION)
    ?.map((note) => note.text);

  return {
    hospitalization,
    hospitalizationNotes,
  };
};

export const createHospitalizationSection = <TData extends { hospitalization?: HospitalizationData }>(): PdfSection<
  TData,
  HospitalizationData
> => {
  return createConfiguredSection(null, () => ({
    title: 'Hospitalization',
    dataSelector: (data) => data.hospitalization,
    shouldRender: (sectionData) => !!sectionData.hospitalization?.length || !!sectionData.hospitalizationNotes?.length,
    render: (client, data, styles) => {
      if (data.hospitalization?.length) {
        data.hospitalization.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      } else {
        drawRegularText(client, styles, 'No hospitalizations');
      }

      if (data.hospitalizationNotes && data.hospitalizationNotes.length > 0) {
        drawBlockHeader(client, styles, 'Hospitalization notes', styles.textStyles.blockSubHeader);
        data.hospitalizationNotes.forEach((record) => {
          drawRegularText(client, styles, record);
        });
      }

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
