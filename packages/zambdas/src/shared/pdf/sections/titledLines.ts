import { drawBlockHeader } from '../helpers/render/blockHeader';
import { drawRegularText } from '../helpers/render/regularText';
import { createConfiguredSection } from '../pdf-common';
import { PdfSection } from '../types';

export interface TitledLines {
  title: string;
  lines: string[];
}

export const createTitledLinesSection = <TData, TSectionData>({
  title,
  dataSelector,
  blocks,
}: {
  title: string;
  dataSelector: (data: TData) => TSectionData | undefined;
  blocks: (sectionData: TSectionData) => TitledLines[];
}): PdfSection<TData, TSectionData> =>
  createConfiguredSection(null, () => ({
    title,
    dataSelector,
    shouldRender: (sectionData) => !!blocks(sectionData).length,
    render: (client, sectionData, styles) => {
      blocks(sectionData).forEach((block) => {
        drawBlockHeader(client, styles, block.title, styles.textStyles.blockSubHeader);
        block.lines.forEach((line) => drawRegularText(client, styles, line));
      });
      client.drawSeparatedLine(styles.lineStyles.separator);
    },
  }));
