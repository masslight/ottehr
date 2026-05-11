import { getRosFindingFieldKeys, InPersonRosConfig } from 'utils';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { EncounterInfo, PdfSection, ProgressNoteVisitDataInput, RosObservations } from '../../types';

export const composeRosObservations: DataComposer<ProgressNoteVisitDataInput, RosObservations> = ({ allChartData }) => {
  const observations = allChartData.chartData.rosObservations || [];
  const obsMap = new Map(observations.filter((o) => o.value).map((o) => [o.field, o]));

  const rosObservations: RosObservations['rosObservations'] = {};

  for (const [_systemKey, system] of Object.entries(InPersonRosConfig)) {
    const items: Array<{ field: string; label: string; abnormal: boolean }> = [];

    for (const [baseKey, item] of Object.entries(system.items)) {
      const { deniesKey, reportsKey } = getRosFindingFieldKeys(baseKey);
      if (obsMap.has(deniesKey)) {
        items.push({ field: deniesKey, label: item.label, abnormal: false });
      }
      if (obsMap.has(reportsKey)) {
        items.push({ field: reportsKey, label: item.label, abnormal: true });
      }
    }

    if (items.length > 0) {
      rosObservations[system.label] = { items };
    }
  }

  return { rosObservations };
};

export const createRosObservationsSection = <
  TData extends { encounter?: EncounterInfo; rosObservations?: RosObservations },
>(): PdfSection<TData, RosObservations> => {
  return createConfiguredSection(null, () => ({
    title: 'Review of Systems',
    dataSelector: (data) => data.rosObservations,
    shouldRender: (sectionData, rootData) =>
      !rootData?.encounter?.isFollowup && Boolean(Object.keys(sectionData.rosObservations ?? {}).length),
    render: (client, data, styles, assets) => {
      const rosData = data.rosObservations;

      if (rosData && Object.keys(rosData).length > 0) {
        Object.entries(rosData).forEach(([sectionLabel, section]) => {
          if (section.items && section.items.length > 0) {
            client.drawTextSequential(`${sectionLabel}:   `, styles.textStyles.examCardHeader);
            const headerDims = client.getTextDimensions(`${sectionLabel}:   `, styles.textStyles.examCardHeader);
            client.setLeftBound(client.getLeftBound() + headerDims.width);

            section.items.forEach((item) => {
              const itemText = ` ${item.label}   `;
              const textDimensions = client.getTextDimensions(itemText, styles.textStyles.examBoldField);
              if (
                textDimensions.width + styles.imageStyles!.examColorDotsStyle.width + client.getX() >
                client.getRightBound()
              ) {
                client.newLine(textDimensions.height + styles.textStyles.examBoldField.spacing);
              }
              if (item.abnormal) {
                client.drawImage(
                  assets.icons!.redDot,
                  styles.imageStyles!.examColorDotsStyle,
                  styles.textStyles.examBoldField
                );
                client.drawTextSequential(itemText, styles.textStyles.examBoldField);
              } else {
                client.drawImage(
                  assets.icons!.greenDot,
                  styles.imageStyles!.examColorDotsStyle,
                  styles.textStyles.examRegularField
                );
                client.drawTextSequential(itemText, styles.textStyles.examRegularField);
              }
            });

            client.setLeftBound(client.getLeftBound() - headerDims.width);
            client.newLine(client.getTextDimensions('a', styles.textStyles.examRegularField).height + 2);
          }
        });
      }

      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
