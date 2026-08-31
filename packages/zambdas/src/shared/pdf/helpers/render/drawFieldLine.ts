import { PDFImage } from 'pdf-lib';
import { ICON_STYLE } from '../../pdf-consts';
import { ImageStyle, PdfClient, PdfStyles } from '../../types';

export const drawFieldLine = (
  client: PdfClient,
  styles: PdfStyles,
  params: {
    label?: string;
    value?: string;
    gap?: number;
    labelStyle?: typeof styles.textStyles.fieldHeader;
    valueStyle?: typeof styles.textStyles.fieldText;
    /** optional icon drawn flush-left before the label */
    icon?: PDFImage;
    iconStyle?: ImageStyle;
    iconGap?: number;
  }
): void => {
  const {
    label = '',
    value = '',
    gap = 10,
    labelStyle = styles.textStyles.fieldHeader,
    valueStyle = styles.textStyles.fieldText,
    icon,
    iconStyle = ICON_STYLE,
    iconGap = 4,
  } = params;

  const leftBound = client.getLeftBound();
  // a preceding field line leaves the X cursor indented at its value; reset so this row starts flush-left
  client.setX(leftBound);

  let indent = 0;
  if (icon) {
    client.drawImage(icon, iconStyle, labelStyle);
    indent = iconStyle.width + iconGap;
    client.setLeftBound(leftBound + indent);
  }

  const labelWidth = client.getTextDimensions(label, labelStyle).width + gap;

  client.drawText(label, labelStyle);
  client.setLeftBound(leftBound + indent + labelWidth);

  client.drawText(value, valueStyle);
  client.setLeftBound(leftBound);
};
