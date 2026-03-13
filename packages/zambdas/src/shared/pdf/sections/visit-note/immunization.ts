import { DateTime } from 'luxon';
import { ImmunizationOrder, searchRouteByCode } from 'utils';
import { drawRegularText } from '../../helpers/render';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { ImmunizationOrders, PdfSection } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeImmunizationOrders: DataComposer<{ allChartData: AllChartData }, ImmunizationOrders> = ({
  allChartData,
}) => {
  const { immunizationOrders } = allChartData;
  const immunizationOrdersToRender = immunizationOrders
    ?.filter((order) => ['administered', 'administered-partly'].includes(order.status))
    .map(immunizationOrderToString);

  return {
    immunizationOrders: immunizationOrdersToRender,
  };
};

export const createImmunizationOrdersSection = <
  TData extends { immunizationOrders?: ImmunizationOrders },
>(): PdfSection<TData, ImmunizationOrders> => {
  return createConfiguredSection(null, () => ({
    title: 'Immunization',
    dataSelector: (data) => data.immunizationOrders,
    shouldRender: (sectionData) => Boolean(sectionData.immunizationOrders && sectionData.immunizationOrders.length),
    render: (client, data, styles) => {
      data.immunizationOrders?.forEach((record) => {
        drawRegularText(client, styles, record);
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};

function immunizationOrderToString(order: ImmunizationOrder): string {
  const route = searchRouteByCode(order.details.route)?.display ?? '';
  const location = order.details.location?.name ?? '';
  const administratedDateTime = order.administrationDetails?.administeredDateTime
    ? DateTime.fromISO(order.administrationDetails?.administeredDateTime)?.toFormat('MM/dd/yyyy HH:mm a')
    : '';
  return `${order.details.medication.name} - ${order.details.dose} ${order.details.units} / ${route} - ${location}\n${administratedDateTime}`;
}
