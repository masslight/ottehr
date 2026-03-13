import { NonNormalResult, NonNormalResultContained } from 'utils';
import { ICON_STYLE } from '../../pdf-consts';
import { rgbNormalized } from '../../pdf-utils';
import { LabOrder, PdfAssets, PdfClient, PdfStyles, TextStyle } from '../../types';

export type LabType = 'inhouse' | 'external';

export type LabsRenderData = {
  orders: LabOrder[];
  results: {
    name: string;
    nonNormalResultContained: NonNormalResultContained;
  }[];
};

export function renderLabsSection(
  client: PdfClient,
  labsData: LabsRenderData,
  styles: PdfStyles,
  assets: PdfAssets,
  labType: LabType
): void {
  if (!assets?.icons) return;

  const { icons } = assets;

  const regularTextNoLineAfter = {
    ...styles.textStyles.regularText,
    newLineAfter: false,
  };

  const getFlagsExcludingNeutral = (flags: NonNormalResult[]): NonNormalResult[] =>
    flags.filter((flag) => flag !== NonNormalResult.Neutral);

  const getCurBounds = (): { leftBound: number; rightBound: number } => ({
    leftBound: client.getX(),
    rightBound: client.getRightBound(),
  });

  const getTestNameTextStyle = (nonNormalResultContained: NonNormalResultContained): TextStyle => {
    // results are normal, no flags
    if (!nonNormalResultContained?.length) {
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

  const drawResultFlags = (nonNormalResultContained: NonNormalResultContained): void => {
    const resultFlagIconStyle = { ...ICON_STYLE, margin: { left: 5, right: 5 } };
    if (nonNormalResultContained && nonNormalResultContained.length > 0) {
      const flagsExcludingNeutral = getFlagsExcludingNeutral(nonNormalResultContained);
      if (flagsExcludingNeutral?.length) {
        flagsExcludingNeutral.forEach((flag, idx) => {
          const lastFlag = flagsExcludingNeutral?.length === idx + 1;
          const style = lastFlag ? styles.textStyles.regularText : regularTextNoLineAfter;

          if (flag === NonNormalResult.Abnormal) {
            client.drawImage(icons.abnormal, resultFlagIconStyle, regularTextNoLineAfter);
            client.drawTextSequential('Abnormal', { ...style, color: rgbNormalized(237, 108, 2) }, getCurBounds());
          } else if (flag === NonNormalResult.Inconclusive) {
            client.drawImage(icons.inconclusive, resultFlagIconStyle, regularTextNoLineAfter);
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
      client.drawImage(icons.normal, resultFlagIconStyle, regularTextNoLineAfter);
      client.drawTextSequential(
        'Normal',
        { ...styles.textStyles.regularText, color: rgbNormalized(46, 125, 50) },
        getCurBounds()
      );
    }
  };

  if (labsData.orders.length) {
    client.drawText('Orders:', styles.textStyles.subHeader);
    labsData.orders.forEach((order) => client.drawText(order.testItemName, styles.textStyles.regularText));
  }

  if (labsData.results.length) {
    client.drawText('Results:', styles.textStyles.subHeader);
    labsData.results.forEach((result) => {
      client.drawTextSequential(result.name, getTestNameTextStyle(result.nonNormalResultContained), {
        leftBound: client.getLeftBound(),
        rightBound: client.getRightBound(),
      });
      drawResultFlags(result.nonNormalResultContained);
    });
  }

  client.drawSeparatedLine(styles.lineStyles.separator);
}
