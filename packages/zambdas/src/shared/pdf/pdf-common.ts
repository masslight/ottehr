import fs from 'node:fs';
import { PDFImage } from 'pdf-lib';
import { getPresignedURL, Secrets, uploadPDF } from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { PDF_CLIENT_STYLES } from './pdf-consts';
import { createPdfClient, PdfInfo } from './pdf-utils';
import {
  AssetPaths,
  ImageReference,
  PdfAssets,
  PdfClient,
  PdfData,
  PdfHeaderSection,
  PdfResult,
  PdfSection,
  PdfStyles,
  UploadMetadata,
} from './types';

export type DataComposer<TInput, TOutput extends PdfData> = (input: TInput) => TOutput;

export type StyleFactory = (assets: PdfAssets) => PdfStyles;

export interface PdfHeaderConfig<TData extends PdfData> {
  title: string;
  leftSection?: PdfHeaderSection<TData, any>;
  rightSection?: PdfHeaderSection<TData, any>;
}

export interface PdfRenderConfig<TData extends PdfData> {
  header: PdfHeaderConfig<TData>;
  assetPaths: AssetPaths;
  styleFactory: StyleFactory;
  sections: PdfSection<TData, any>[];
}

interface ImageLoader {
  loadImage: (url: string) => Promise<ArrayBuffer>;
  embedImage: (client: PdfClient, imageData: ArrayBuffer) => Promise<PDFImage>;
}

const createImageLoader = (token: string): ImageLoader => ({
  loadImage: async (url: string): Promise<ArrayBuffer> => {
    console.log(`Loading image from: ${url}`);
    const presignedUrl = await getPresignedURL(url, token);

    const res = await fetch(presignedUrl);

    return await res.arrayBuffer();
  },

  embedImage: async (client: PdfClient, imageData: ArrayBuffer): Promise<PDFImage> => {
    return await client.embedJpg(Buffer.from(imageData));
  },
});

const collectImageReferences = <TData extends PdfData>(
  data: TData,
  sections: PdfSection<TData, any>[]
): ImageReference[] => {
  const imageRefs: ImageReference[] = [];

  for (const section of sections) {
    const sectionData = section.dataSelector(data);
    if (!sectionData) continue;

    if (section.extractImages) {
      const refs = section.extractImages(sectionData);
      imageRefs.push(...refs);
    }
  }

  return imageRefs;
};

const loadAndEmbedImages = async (
  imageRefs: ImageReference[],
  pdfClient: PdfClient,
  imageLoader: ImageLoader
): Promise<Record<string, PDFImage>> => {
  const images: Record<string, PDFImage> = {};

  const uniqueRefs = Array.from(new Map(imageRefs.map((ref) => [ref.key, ref])).values());

  console.log(`Loading ${uniqueRefs.length} unique images...`);

  await Promise.all(
    uniqueRefs.map(async (ref) => {
      try {
        const imageData = await imageLoader.loadImage(ref.url);
        const embeddedImage = await imageLoader.embedImage(pdfClient, imageData);
        images[ref.key] = embeddedImage;
        console.log(`Successfully loaded image: ${ref.key}`);
      } catch (error) {
        console.error(`Failed to load image ${ref.key} from ${ref.url}:`, error);
      }
    })
  );

  console.log(`Loaded ${Object.keys(images).length} images successfully`);

  return images;
};

const renderPdfHeader = <TData extends PdfData>(
  pdfClient: PdfClient,
  data: TData,
  config: PdfHeaderConfig<TData>,
  styles: PdfStyles,
  assets: PdfAssets
): void => {
  const headerStartY = pdfClient.getY();
  const pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
  const columnWidth = pageWidth / 2;
  const leftX = pdfClient.getLeftBound();
  const rightX = leftX + columnWidth;

  let leftHeight = 0;
  let rightHeight = 0;

  const originalLeft = pdfClient.getLeftBound();
  const originalRight = pdfClient.getRightBound();

  pdfClient.setLeftBound(rightX + 10);
  pdfClient.setRightBound(originalRight);
  pdfClient.setY(headerStartY);

  pdfClient.drawText(config.title, styles.textStyles.header);

  if (config.rightSection) {
    const rightData = config.rightSection.dataSelector(data);

    if (rightData !== undefined) {
      const shouldRender = config.rightSection.shouldRender ? config.rightSection.shouldRender(rightData) : true;

      if (shouldRender) {
        const rightAlignedStyles = createRightAlignedStyles(styles);
        config.rightSection.render(pdfClient, rightData, rightAlignedStyles, assets);
      }
    }
  }

  rightHeight = pdfClient.getY() - headerStartY;

  if (config.leftSection) {
    const leftData = config.leftSection.dataSelector(data);

    if (leftData !== undefined) {
      const shouldRender = config.leftSection.shouldRender ? config.leftSection.shouldRender(leftData) : true;

      if (shouldRender) {
        pdfClient.setLeftBound(leftX);
        pdfClient.setRightBound(leftX + columnWidth - 10);
        pdfClient.setY(headerStartY);

        config.leftSection.render(pdfClient, leftData, styles, assets);

        leftHeight = pdfClient.getY() - headerStartY;
      }
    }
  }

  pdfClient.setLeftBound(originalLeft);
  pdfClient.setRightBound(originalRight);

  const maxHeight = Math.max(leftHeight, rightHeight);
  pdfClient.setY(headerStartY + maxHeight);

  pdfClient.drawSeparatedLine(styles.lineStyles.separator);
};

const createRightAlignedStyles = (styles: PdfStyles): PdfStyles => {
  const rightAlignedTextStyles: Record<string, any> = {};

  for (const [key, style] of Object.entries(styles.textStyles)) {
    rightAlignedTextStyles[key] = {
      ...style,
      side: 'right' as const,
    };
  }

  return {
    ...styles,
    textStyles: rightAlignedTextStyles,
  };
};

const renderPdf = async <TData extends PdfData>(
  data: TData,
  config: PdfRenderConfig<TData>,
  token: string
): Promise<Uint8Array> => {
  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);

  const baseAssets = await loadPdfAssets(pdfClient, config.assetPaths);

  const allSections = [
    ...(config.header.leftSection ? [config.header.leftSection] : []),
    ...(config.header.rightSection ? [config.header.rightSection] : []),
    ...config.sections,
  ];
  const imageRefs = collectImageReferences(data, allSections);

  let images: Record<string, PDFImage> = {};
  if (imageRefs.length > 0 && token) {
    console.log(`Found ${imageRefs.length} images to load`);
    const imageLoader = createImageLoader(token);
    images = await loadAndEmbedImages(imageRefs, pdfClient, imageLoader);
  }

  const assets: PdfAssets = {
    ...baseAssets,
    images,
  };

  const styles = config.styleFactory(assets);

  renderPdfHeader(pdfClient, data, config.header, styles, assets);

  renderBodySections(pdfClient, data, config.sections, styles, assets);

  return await pdfClient.save();
};

const renderBodySections = <TData extends PdfData>(
  pdfClient: PdfClient,
  data: TData,
  sections: PdfSection<TData, any>[],
  styles: PdfStyles,
  assets: PdfAssets
): void => {
  const originalLeft = pdfClient.getLeftBound();
  const originalRight = pdfClient.getRightBound();
  const pageWidth = originalRight - originalLeft;
  const columnWidth = pageWidth / 2;

  let currentColumn: 'left' | 'right' = 'left';
  let leftColumnY = pdfClient.getY();
  let rightColumnY = pdfClient.getY();

  for (const section of sections) {
    const sectionData = section.dataSelector(data);

    if (sectionData === undefined) continue;

    if (section.shouldRender && !section.shouldRender(sectionData)) {
      continue;
    }

    const layout = section.preferredWidth || 'full';

    if (layout === 'full') {
      const maxY = Math.max(leftColumnY, rightColumnY);
      pdfClient.setY(maxY);
      pdfClient.setLeftBound(originalLeft);
      pdfClient.setRightBound(originalRight);

      if (section.title) {
        pdfClient.drawText(section.title, styles.textStyles.subHeader);
      }
      section.render(pdfClient, sectionData, styles, assets);

      leftColumnY = pdfClient.getY();
      rightColumnY = pdfClient.getY();
      currentColumn = 'left';
    } else if (layout === 'column') {
      if (currentColumn === 'left') {
        pdfClient.setLeftBound(originalLeft);
        pdfClient.setRightBound(originalLeft + columnWidth - 10); // 10px padding
        pdfClient.setY(leftColumnY);

        if (section.title) {
          pdfClient.drawText(section.title, styles.textStyles.subHeader);
        }
        section.render(pdfClient, sectionData, styles, assets);

        leftColumnY = pdfClient.getY();
        currentColumn = 'right';
      } else {
        pdfClient.setLeftBound(originalLeft + columnWidth + 10); // 10px padding
        pdfClient.setRightBound(originalRight);
        pdfClient.setY(rightColumnY);

        if (section.title) {
          pdfClient.drawText(section.title, styles.textStyles.subHeader);
        }
        section.render(pdfClient, sectionData, styles, assets);

        rightColumnY = pdfClient.getY();
        currentColumn = 'left';
      }
    }
  }

  pdfClient.setLeftBound(originalLeft);
  pdfClient.setRightBound(originalRight);
  const finalY = Math.max(leftColumnY, rightColumnY);
  pdfClient.setY(finalY);
};

const loadPdfAssets = async (pdfClient: PdfClient, paths: AssetPaths): Promise<PdfAssets> => {
  const fonts: PdfAssets['fonts'] = {};
  let icons: PdfAssets['icons'] | undefined;

  if (paths.fonts) {
    for (const [key, path] of Object.entries(paths.fonts)) {
      fonts[key] = await pdfClient.embedFont(fs.readFileSync(path));
    }
  }

  if (paths.icons) {
    icons = {};
    for (const [key, path] of Object.entries(paths.icons)) {
      icons[key] = await pdfClient.embedImage(fs.readFileSync(path));
    }
  }

  return { fonts, icons };
};

const uploadPdfToStorage = async (
  pdfBytes: Uint8Array,
  metadata: UploadMetadata,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> => {
  const { patientId, fileName, bucketName } = metadata;

  const baseFileUrl = makeZ3Url({
    secrets,
    fileName,
    bucketName,
    patientID: patientId,
  });

  await uploadPDF(pdfBytes, baseFileUrl, token, patientId);

  return { title: fileName, uploadURL: baseFileUrl };
};

export const generatePdf = async <TInput, TData extends PdfData>(
  input: TInput,
  composer: DataComposer<TInput, TData>,
  renderConfig: PdfRenderConfig<TData>,
  uploadMetadata: UploadMetadata,
  secrets: Secrets | null,
  token: string
): Promise<PdfResult> => {
  console.log('Composing PDF data...');
  const data = composer(input);

  console.log('Rendering PDF...');
  const pdfBytes = await renderPdf(data, renderConfig, token);

  console.log('Uploading PDF...');
  const pdfInfo = await uploadPdfToStorage(pdfBytes, uploadMetadata, secrets, token);

  return { pdfInfo, attached: data.attachmentDocRefs };
};
