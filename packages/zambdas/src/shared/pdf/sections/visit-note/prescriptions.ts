import { mapResourceByNameField } from '../../helpers/mappers';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { PdfSection, Prescriptions } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composePrescriptions: DataComposer<{ allChartData: AllChartData }, Prescriptions> = ({ allChartData }) => {
  const { additionalChartData } = allChartData;
  const prescriptions = additionalChartData?.prescribedMedications
    ? mapResourceByNameField(additionalChartData.prescribedMedications)
    : [];
  return { prescriptions };
};

export const createPrescriptionsSection = <TData extends { prescriptions?: Prescriptions }>(): PdfSection<
  TData,
  Prescriptions
> => {
  return createConfiguredSection(null, () => ({
    title: 'Prescriptions',
    dataSelector: (data) => data.prescriptions,
    shouldRender: (sectionData) => !!sectionData.prescriptions?.length,
    render: (client, data, styles) => {
      data.prescriptions.forEach((prescription) => {
        drawRegularText(client, styles, prescription);
      });

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
