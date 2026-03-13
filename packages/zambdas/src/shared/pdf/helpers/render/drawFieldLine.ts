import { PdfClient, PdfStyles } from '../../types';

export const drawFieldLine = (
  client: PdfClient,
  styles: PdfStyles,
  params: {
    label?: string;
    value?: string;
    gap?: number;
    labelStyle?: typeof styles.textStyles.fieldHeader;
    valueStyle?: typeof styles.textStyles.fieldText;
  }
): void => {
  const {
    label = '',
    value = '',
    gap = 10,
    labelStyle = styles.textStyles.fieldHeader,
    valueStyle = styles.textStyles.fieldText,
  } = params;

  const leftBound = client.getLeftBound();
  const labelWidth = client.getTextDimensions(label, labelStyle).width + gap;

  client.drawText(label, labelStyle);
  client.setLeftBound(leftBound + labelWidth);

  client.drawText(value, valueStyle);
  client.setLeftBound(leftBound);
};
