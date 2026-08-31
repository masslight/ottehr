import { PdfSection, VisitInfo } from '../../types';

export const createReasonForVisitSection = <TData extends { visit?: VisitInfo }>(): PdfSection<TData, VisitInfo> => ({
  title: 'Reason for visit',
  dataSelector: (data) => data.visit,
  shouldRender: (visitInfo) => !!visitInfo?.reasonForVisit,
  render: (client, visitInfo, styles) => {
    client.drawText(visitInfo.reasonForVisit!, styles.textStyles.regular);
    client.drawSeparatedLine(styles.lineStyles.separator);
  },
});
