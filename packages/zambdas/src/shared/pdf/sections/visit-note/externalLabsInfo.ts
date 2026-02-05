import { NonNormalResult, NonNormalResultContained } from 'utils';
import { mapResourcesToExternalLabOrders } from '../../helpers/mappers';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { ICON_STYLE } from '../../pdf-consts';
import { rgbNormalized } from '../../pdf-utils';
import { ExternalLabs, PdfSection, TextStyle } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeExternalLabs: DataComposer<{ allChartData: AllChartData }, ExternalLabs> = ({ allChartData }) => {
  const { additionalChartData, externalLabsData } = allChartData;
  const externalLabResults = additionalChartData?.externalLabResults?.labOrderResults ?? [];

  const externalLabOrders = externalLabsData?.serviceRequests?.length
    ? mapResourcesToExternalLabOrders(externalLabsData?.serviceRequests)
    : [];

  return { externalLabResults, externalLabOrders };
};

export const createExternalLabsSection = <TData extends { externalLabs?: ExternalLabs }>(): PdfSection<
  TData,
  ExternalLabs
> => {
  return createConfiguredSection(null, () => ({
    title: 'External Labs',
    dataSelector: (data) => data.externalLabs,
    shouldRender: (sectionData) => !!sectionData.externalLabResults?.length || !!sectionData.externalLabOrders?.length,
    render: (client, data, styles, assets) => {
      if (!assets?.icons) return;
      const { icons } = assets;
      const getFlagsExcludingNeutral = (flags: NonNormalResult[]): NonNormalResult[] =>
        flags.filter((flag) => flag !== NonNormalResult.Neutral);
      const regularTextNoLineAfter = { ...styles.textStyles.regularText, newLineAfter: false };
      const getCurBounds = (): { leftBound: number; rightBound: number } => ({
        leftBound: client.getX(),
        rightBound: client.getRightBound(),
      });

      const getTestNameTextStyle = (
        nonNormalResultContained: NonNormalResultContained,
        labType: 'inhouse' | 'external'
      ): TextStyle => {
        // results are normal, no flags
        if (!nonNormalResultContained) {
          if (labType === 'inhouse') {
            // there will be a normal flag therefore the test name should not have a new line after it is written
            return regularTextNoLineAfter;
          } else {
            // no normal flag therefore the test name should have a new line after it is written
            return styles.textStyles.regularText;
          }
        }
        const flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
        if (flagsExcludingNeutral.length > 0) {
          // results have a flag to display therefore the test name should not have a new line after it is written
          return regularTextNoLineAfter;
        } else {
          // no flags for neutral tests, new line after test name
          return styles.textStyles.regularText;
        }
      };
      const drawResultFlags = (
        nonNormalResultContained: NonNormalResultContained,
        labType: 'inhouse' | 'external'
      ): void => {
        const resultFlagIconStyle = { ...ICON_STYLE, margin: { left: 5, right: 5 } };
        if (nonNormalResultContained && nonNormalResultContained.length > 0) {
          const flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
          if (flagsExcludingNeutral?.length) {
            flagsExcludingNeutral.forEach((flag, idx) => {
              const lastFlag = flagsExcludingNeutral?.length === idx + 1;
              const style = lastFlag ? styles.textStyles.regularText : regularTextNoLineAfter;

              if (flag === NonNormalResult.Abnormal) {
                client.drawImage(icons.abnormalIcon, resultFlagIconStyle, regularTextNoLineAfter);
                client.drawTextSequential('Abnormal', { ...style, color: rgbNormalized(237, 108, 2) }, getCurBounds());
              } else if (flag === NonNormalResult.Inconclusive) {
                client.drawImage(icons.inconclusiveIcon, resultFlagIconStyle, regularTextNoLineAfter);
                client.drawTextSequential(
                  'Inconclusive',
                  { ...style, color: rgbNormalized(117, 117, 117) },
                  getCurBounds()
                );
              }
            });
          }
        } else if (labType === 'inhouse') {
          // too hairy to assume normal results for external labs so we will only do this for inhouse
          client.drawImage(icons.normalIcon, resultFlagIconStyle, regularTextNoLineAfter);
          client.drawTextSequential(
            'Normal',
            { ...styles.textStyles.regularText, color: rgbNormalized(46, 125, 50) },
            getCurBounds()
          );
        }
      };
      if (data.externalLabOrders.length) {
        client.drawText('Orders:', styles.textStyles.subHeader);
        data.externalLabOrders.forEach((order) => {
          client.drawText(order.testItemName, styles.textStyles.regularText);
        });
      }
      if (data.externalLabResults.length) {
        client.drawText('Results:', styles.textStyles.subHeader);
        data.externalLabResults.forEach((result) => {
          const testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'external');
          client.drawTextSequential(result.name, testNameTextStyle, {
            leftBound: client.getLeftBound(),
            rightBound: client.getRightBound(),
          });
          drawResultFlags(result.nonNormalResultContained, 'external');
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
