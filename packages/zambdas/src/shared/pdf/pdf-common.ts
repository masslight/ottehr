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
  PdfResult,
  PdfSection,
  PdfStyles,
  UploadMetadata,
} from './types';

export type DataComposer<TInput, TOutput extends PdfData> = (input: TInput) => TOutput;

export type StyleFactory = (assets: PdfAssets) => PdfStyles;

export interface PdfRenderConfig<TData extends PdfData> {
  title: string;
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

const renderPdf = async <TData extends PdfData>(
  data: TData,
  config: PdfRenderConfig<TData>,
  token: string
): Promise<Uint8Array> => {
  const pdfClient = await createPdfClient(PDF_CLIENT_STYLES);

  const baseAssets = await loadPdfAssets(pdfClient, config.assetPaths);

  const imageRefs = collectImageReferences(data, config.sections);

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

  pdfClient.drawText(config.title, styles.textStyles.header);
  pdfClient.drawSeparatedLine(styles.lineStyles.separator);

  for (const section of config.sections) {
    const sectionData = section.dataSelector(data);

    if (sectionData === undefined) continue;

    if (section.shouldRender && !section.shouldRender(sectionData)) {
      continue;
    }

    if (section.title) pdfClient.drawText(section.title, styles.textStyles.subHeader);
    section.render(pdfClient, sectionData, styles, assets, token);
  }

  return await pdfClient.save();
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
