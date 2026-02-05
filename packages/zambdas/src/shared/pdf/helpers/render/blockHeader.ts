import { PDF_CLIENT_STYLES } from '../../pdf-consts';
import { PdfClient, PdfClientStyles, PdfStyles } from '../../types';

export const ensureSpace = (client: PdfClient, page: PdfClientStyles['initialPage'], requiredHeight: number): void => {
  if (client.getY() - requiredHeight < (page.pageMargins.bottom ?? 0)) {
    client.addNewPage(page);
  }
};

export const drawBlockHeader = (
  client: PdfClient,
  styles: PdfStyles,
  text: string,
  textStyle = styles.textStyles.subHeader
): void => {
  const headerDims = client.getTextDimensions(text, textStyle);
  const regularDims = client.getTextDimensions('a', styles.textStyles.regularText);

  ensureSpace(
    client,
    PDF_CLIENT_STYLES.initialPage,
    headerDims.height + (textStyle.newLineAfter ? textStyle.spacing : 0) + regularDims.height
  );

  client.drawText(text, textStyle);
};
