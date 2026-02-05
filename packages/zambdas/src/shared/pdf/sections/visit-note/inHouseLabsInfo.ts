import { filterNotDeletedServiceRequests, NonNormalResult, NonNormalResultContained } from 'utils';
import { mapResourcesToInHouseLabOrders } from '../../helpers/mappers';
import { createConfiguredSection, DataComposer } from '../../pdf-common';
import { ICON_STYLE } from '../../pdf-consts';
import { rgbNormalized } from '../../pdf-utils';
import { InHouseLabs, PdfSection, TextStyle } from '../../types';
import { AllChartData } from '../../visit-details-pdf/types';

export const composeInHouseLabs: DataComposer<{ allChartData: AllChartData }, InHouseLabs> = ({ allChartData }) => {
  const { additionalChartData, inHouseOrdersData } = allChartData;
  const inHouseLabResults = additionalChartData?.inHouseLabResults?.labOrderResults ?? [];
  const inHouseLabOrders = inHouseOrdersData?.serviceRequests?.length
    ? mapResourcesToInHouseLabOrders(
        filterNotDeletedServiceRequests(inHouseOrdersData?.serviceRequests),
        inHouseOrdersData?.activityDefinitions,
        inHouseOrdersData?.observations
      )
    : [];

  return { inHouseLabResults, inHouseLabOrders };
};

export const createInHouseLabsSection = <TData extends { inHouseLabs?: InHouseLabs }>(): PdfSection<
  TData,
  InHouseLabs
> => {
  return createConfiguredSection(null, () => ({
    title: 'In-House Labs',
    dataSelector: (data) => data.inHouseLabs,
    shouldRender: (sectionData) => !!sectionData.inHouseLabResults?.length || !!sectionData.inHouseLabOrders?.length,
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
      if (data.inHouseLabOrders.length) {
        client.drawText('Orders:', styles.textStyles.subHeader);
        data.inHouseLabOrders.forEach((order) => {
          client.drawText(order.testItemName, styles.textStyles.regularText);
        });
      }
      if (data.inHouseLabResults.length) {
        client.drawText('Results:', styles.textStyles.subHeader);
        data.inHouseLabResults.forEach((result) => {
          const testNameTextStyle = getTestNameTextStyle(result.nonNormalResultContained, 'inhouse');
          client.drawTextSequential(result.name, testNameTextStyle, {
            leftBound: client.getLeftBound(),
            rightBound: client.getRightBound(),
          });
          drawResultFlags(result.nonNormalResultContained, 'inhouse');
        });
      }
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
};
