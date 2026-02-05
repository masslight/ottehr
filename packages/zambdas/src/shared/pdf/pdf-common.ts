import fs from 'node:fs';
import { PDFImage } from 'pdf-lib';
import { getPresignedURL, PATIENT_RECORD_CONFIG, Secrets, uploadPDF } from 'utils';
import { makeZ3Url } from '../presigned-file-urls';
import { PDF_CLIENT_STYLES } from './pdf-consts';
import { createPdfClient, getPdfLogo, PdfInfo } from './pdf-utils';
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
  title: string | ((data: TData) => string);
  logo?: {
    width: number;
    height: number;
  };
  leftSection?: PdfHeaderSection<TData, any>;
  rightSection?: PdfHeaderSection<TData, any>;
}

export interface PdfRenderConfig<TData extends PdfData> {
  header: PdfHeaderConfig<TData>;
  headerBodySeparator?: boolean;
  assetPaths: AssetPaths;
  styleFactory: StyleFactory;
  sections: PdfSection<TData, any>[];
}

interface ImageLoader {
  loadImage: (url: string) => Promise<ArrayBuffer>;
  embedImage: (client: PdfClient, imageData: ArrayBuffer, url: string) => Promise<PDFImage>;
}

const createImageLoader = (token: string): ImageLoader => ({
  loadImage: async (url: string): Promise<ArrayBuffer> => {
    console.log(`Loading image from: ${url}`);
    const presignedUrl = await getPresignedURL(url, token);

    const res = await fetch(presignedUrl);

    return await res.arrayBuffer();
  },

  embedImage: async (client: PdfClient, imageData: ArrayBuffer, url: string): Promise<PDFImage> => {
    const urlLower = url.toLowerCase();
    const isPng = urlLower.endsWith('.png');
    const isJpeg = urlLower.endsWith('.jpg') || urlLower.endsWith('.jpeg');

    if (isPng) {
      console.log(`Embedding PNG image from ${url}`);
      return await client.embedImage(Buffer.from(imageData));
    } else if (isJpeg) {
      console.log(`Embedding JPEG image from ${url}`);
      return await client.embedJpg(Buffer.from(imageData));
    } else {
      console.warn(`Unknown image extension for ${url}, attempting JPEG`);
      try {
        return await client.embedJpg(Buffer.from(imageData));
      } catch {
        console.warn(`Failed as JPEG, trying PNG for ${url}`);
        return await client.embedImage(Buffer.from(imageData));
      }
    }
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
        const embeddedImage = await imageLoader.embedImage(pdfClient, imageData, ref.url);
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
  console.log('In renderPdfHeader');
  console.log('Header config:', {
    title: config.title,
    hasLogo: !!config.logo,
    hasLeftSection: !!config.leftSection,
    hasRightSection: !!config.rightSection,
  });
  console.log('Styles available:', {
    textStyles: Object.keys(styles.textStyles),
    hasHeaderStyle: !!styles.textStyles.header,
  });
  const headerStartY = pdfClient.getY();
  const pageWidth = pdfClient.getRightBound() - pdfClient.getLeftBound();
  const columnWidth = pageWidth / 2;
  const leftX = pdfClient.getLeftBound();
  const rightX = leftX + columnWidth;

  let leftHeight = 0;
  let rightHeight = 0;

  const originalLeft = pdfClient.getLeftBound();
  const originalRight = pdfClient.getRightBound();

  if (config.logo && assets.logo) {
    console.log('Rendering logo...');
    const { width, height } = config.logo;
    console.log('Logo config:', {
      width,
      height,
    });
    pdfClient.drawImage(assets.logo, {
      width,
      height,
    });
  }

  pdfClient.setLeftBound(rightX + 10);
  pdfClient.setRightBound(originalRight);

  console.log('Drawing header title:', config.title);
  console.log('Header text style:', styles.textStyles.header);

  const title = typeof config.title === 'function' ? config.title(data) : config.title;

  try {
    pdfClient.drawText(title, styles.textStyles.header);
    console.log('Header title drawn successfully');
  } catch (error) {
    console.error('ERROR drawing header title:', error);
    console.error('Text style was:', styles.textStyles.header);
    throw error;
  }

  if (config.rightSection) {
    console.log('Rendering right section...');
    const rightData = config.rightSection.dataSelector(data);
    console.log('Right section data:', rightData);
    if (rightData !== undefined) {
      const shouldRender = config.rightSection.shouldRender ? config.rightSection.shouldRender(rightData) : true;

      if (shouldRender) {
        const rightAlignedStyles = createRightAlignedStyles(styles);
        config.rightSection.render(pdfClient, rightData, rightAlignedStyles, assets);
      }
    }
  }

  rightHeight = headerStartY - pdfClient.getY();

  if (config.leftSection) {
    console.log('Rendering left section...');
    const leftData = config.leftSection.dataSelector(data);
    console.log('Left section data:', leftData);
    if (leftData !== undefined) {
      const shouldRender = config.leftSection.shouldRender ? config.leftSection.shouldRender(leftData) : true;

      if (shouldRender) {
        pdfClient.setLeftBound(leftX);
        pdfClient.setRightBound(leftX + columnWidth - 10);
        pdfClient.setY(headerStartY);

        try {
          config.leftSection.render(pdfClient, leftData, styles, assets);
          console.log('Left section rendered successfully');
        } catch (error) {
          console.error('ERROR rendering left section:', error);
          throw error;
        }

        leftHeight = headerStartY - pdfClient.getY();
      }
    }
  }

  pdfClient.setLeftBound(originalLeft);
  pdfClient.setRightBound(originalRight);

  const maxHeight = Math.max(leftHeight, rightHeight);
  pdfClient.setY(headerStartY - maxHeight);
  console.log('Header rendering complete');
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
  console.log('=== Starting renderPdf ===');
  console.log('Creating PDF client...');
  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);
  console.log('Loading PDF assets...');
  const baseAssets = await loadPdfAssets(pdfClient, config.assetPaths);
  console.log('Base assets loaded:', Object.keys(baseAssets));
  const allSections = [
    ...(config.header.leftSection ? [config.header.leftSection] : []),
    ...(config.header.rightSection ? [config.header.rightSection] : []),
    ...config.sections,
  ];
  console.log(`Total sections (including header sections): ${allSections.length}`);
  const imageRefs = collectImageReferences(data, allSections);

  let images: Record<string, PDFImage> = {};
  if (imageRefs.length > 0 && token) {
    console.log(`Found ${imageRefs.length} images to load`);
    const imageLoader = createImageLoader(token);
    images = await loadAndEmbedImages(imageRefs, pdfClient, imageLoader);
  }
  console.log('Creating assets object...');
  const assets: PdfAssets = {
    ...baseAssets,
    images,
  };
  console.log('Assets created:', {
    fonts: Object.keys(assets.fonts),
    icons: assets.icons ? Object.keys(assets.icons) : 'none',
    logo: !!assets.logo,
    images: Object.keys(images),
  });
  console.log('Creating styles from styleFactory...');
  const styles = config.styleFactory(assets);
  console.log('Styles created:', {
    textStyles: Object.keys(styles.textStyles),
    lineStyles: Object.keys(styles.lineStyles),
  });

  console.log('\n=== Rendering PDF Header ===');
  try {
    renderPdfHeader(pdfClient, data, config.header, styles, assets);
    console.log('Header rendered successfully');
  } catch (error) {
    console.error('ERROR rendering header:', error);
    throw error;
  }

  if (config.headerBodySeparator) {
    pdfClient.drawSeparatedLine(styles.lineStyles.separator);
  }

  console.log('\n=== Rendering Body Sections ===');
  console.log(`Number of body sections: ${config.sections.length}`);
  try {
    renderBodySections(pdfClient, data, config.sections, styles, assets);
    console.log('Body sections rendered successfully');
  } catch (error) {
    console.error('ERROR rendering body sections:', error);
    throw error;
  }
  console.log('\n=== Saving PDF ===');
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
  let leftColumnPage = pdfClient.getCurrentPageIndex();
  let rightColumnPage = pdfClient.getCurrentPageIndex();

  for (const section of sections) {
    const sectionData = section.dataSelector(data);

    if (sectionData === undefined) continue;

    if (section.shouldRender && !section.shouldRender(sectionData, data)) {
      continue;
    }
    const title = typeof section.title === 'function' ? section.title(sectionData) : section.title;
    const layout = section.preferredWidth || 'full';

    if (layout === 'full') {
      const maxPage = Math.max(leftColumnPage, rightColumnPage);
      pdfClient.setPageByIndex(maxPage);

      let targetY;
      if (leftColumnPage === rightColumnPage) {
        targetY = Math.max(leftColumnY, rightColumnY);
      } else if (leftColumnPage > rightColumnPage) {
        targetY = leftColumnY;
      } else {
        targetY = rightColumnY;
      }

      pdfClient.setY(targetY);
      pdfClient.setLeftBound(originalLeft);
      pdfClient.setRightBound(originalRight);

      if (title) {
        pdfClient.drawText(title, styles.textStyles.subHeader);
      }
      section.render(pdfClient, sectionData, styles, assets);

      leftColumnY = pdfClient.getY();
      rightColumnY = pdfClient.getY();
      leftColumnPage = pdfClient.getCurrentPageIndex();
      rightColumnPage = pdfClient.getCurrentPageIndex();
      currentColumn = 'left';
    } else if (layout === 'column') {
      if (currentColumn === 'left') {
        pdfClient.setPageByIndex(leftColumnPage);
        pdfClient.setLeftBound(originalLeft);
        pdfClient.setRightBound(originalLeft + columnWidth - 10);
        pdfClient.setY(leftColumnY);

        if (title) {
          pdfClient.drawText(title, styles.textStyles.subHeader);
        }
        section.render(pdfClient, sectionData, styles, assets);

        const newLeftColumnPage = pdfClient.getCurrentPageIndex();
        leftColumnY = pdfClient.getY();

        if (newLeftColumnPage > leftColumnPage) {
          rightColumnPage = newLeftColumnPage;
          pdfClient.setPageByIndex(rightColumnPage);
          rightColumnY = pdfClient.getPageTopY();
        }

        leftColumnPage = newLeftColumnPage;
        currentColumn = 'right';
      } else {
        pdfClient.setPageByIndex(rightColumnPage);
        pdfClient.setLeftBound(originalLeft + columnWidth + 10);
        pdfClient.setRightBound(originalRight);
        pdfClient.setY(rightColumnY);

        if (title) {
          pdfClient.drawText(title, styles.textStyles.subHeader);
        }
        section.render(pdfClient, sectionData, styles, assets);

        const newRightColumnPage = pdfClient.getCurrentPageIndex();
        rightColumnY = pdfClient.getY();

        if (newRightColumnPage > rightColumnPage) {
          leftColumnPage = newRightColumnPage;
          pdfClient.setPageByIndex(leftColumnPage);
          leftColumnY = pdfClient.getPageTopY();
        }

        rightColumnPage = newRightColumnPage;
        currentColumn = 'left';
      }
    }
  }

  pdfClient.setLeftBound(originalLeft);
  pdfClient.setRightBound(originalRight);

  const maxPage = Math.max(leftColumnPage, rightColumnPage);
  pdfClient.setPageByIndex(maxPage);

  let finalY;
  if (leftColumnPage === rightColumnPage) {
    finalY = Math.max(leftColumnY, rightColumnY);
  } else if (leftColumnPage > rightColumnPage) {
    finalY = leftColumnY;
  } else {
    finalY = rightColumnY;
  }

  pdfClient.setY(finalY);
};

const loadPdfAssets = async (pdfClient: PdfClient, paths: AssetPaths): Promise<PdfAssets> => {
  const fonts: PdfAssets['fonts'] = {};
  let icons: PdfAssets['icons'];
  let logo: PdfAssets['logo'];

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

  const logoBuffer = await getPdfLogo();
  if (logoBuffer) {
    logo = await pdfClient.embedImage(logoBuffer);
  }

  return { fonts, icons, logo };
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

export interface PdfSectionConfig {
  configKey: keyof typeof PATIENT_RECORD_CONFIG.FormFields;
  isHidden: boolean;
  hiddenFields: Set<string>;
}

export const createSectionConfig = (configKey: keyof typeof PATIENT_RECORD_CONFIG.FormFields): PdfSectionConfig => {
  const section = PATIENT_RECORD_CONFIG.FormFields[configKey];

  const isHidden = Array.isArray(section.linkId)
    ? PATIENT_RECORD_CONFIG.hiddenFormSections.some((hiddenSection) => section.linkId.includes(hiddenSection))
    : PATIENT_RECORD_CONFIG.hiddenFormSections.includes(section.linkId);

  return {
    configKey,
    isHidden,
    hiddenFields: new Set(section.hiddenFields ?? []),
  };
};

export const fieldFilter = (config: PdfSectionConfig) => {
  return (fieldKey: string): boolean => {
    return !config.hiddenFields.has(fieldKey);
  };
};

export const createConfiguredSection = <TData, TSectionData>(
  configKey: keyof typeof PATIENT_RECORD_CONFIG.FormFields | null,
  sectionFactory: (shouldShow: (fieldKey: string) => boolean) => PdfSection<TData, TSectionData>
): PdfSection<TData, TSectionData> => {
  if (!configKey) {
    return sectionFactory(() => true);
  }

  const config = createSectionConfig(configKey);
  const shouldShow = fieldFilter(config);
  const section = sectionFactory(shouldShow);

  return {
    ...section,
    skip: config.isHidden,
  };
};
