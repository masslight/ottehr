import { PdfClient, PdfStyles } from '../../types';

export const drawRegularText = (
  client: PdfClient,
  styles: PdfStyles,
  text?: string,
  alternativeText?: string
): void => {
  if (text) {
    client.drawText(text, styles.textStyles.regularText);
  } else if (alternativeText) {
    client.drawText(alternativeText, styles.textStyles.alternativeRegularText);
  }
};
