import { PageSizes } from 'pdf-lib';
import { ImageStyle, PdfClientStyles } from './types';

export const Y_POS_GAP = 30;

export const STANDARD_FONT_SIZE = 12;
export const STANDARD_FONT_SPACING = 12;
export const STANDARD_NEW_LINE = 17;

export const PDF_CLIENT_STYLES: PdfClientStyles = {
  initialPage: {
    width: PageSizes.A4[0],
    height: PageSizes.A4[1],
    pageMargins: {
      left: 40,
      top: 40,
      right: 40,
      bottom: 40,
    },
  },
};

export const ICON_STYLE: ImageStyle = {
  width: 10,
  height: 10,
};
