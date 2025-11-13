import { DocumentReference } from 'fhir/r4b';
import { DataComposer } from '../pdf-common';
import { PDF_CLIENT_STYLES } from '../pdf-consts';
import { Documents, PdfSection } from '../types';

export const composeDocumentsData: DataComposer<DocumentReference[], Documents> = (documents) => {
  const photoIdFrontDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'photo-id-front')
  );

  const photoIdFront = {
    url: photoIdFrontDocumentReference?.content[0].attachment.url,
    title: photoIdFrontDocumentReference?.content[0].attachment.title,
    creation: photoIdFrontDocumentReference?.date,
    contentType: photoIdFrontDocumentReference?.content[0].attachment.contentType,
  };

  const photoIdBackDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'photo-id-back')
  );

  const photoIdBack = {
    url: photoIdBackDocumentReference?.content[0].attachment.url,
    title: photoIdBackDocumentReference?.content[0].attachment.title,
    creation: photoIdBackDocumentReference?.date,
    contentType: photoIdBackDocumentReference?.content[0].attachment.contentType,
  };

  const insuranceCardFrontDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-front')
  );

  const insuranceCardFront = {
    url: insuranceCardFrontDocumentReference?.content[0].attachment.url,
    title: insuranceCardFrontDocumentReference?.content[0].attachment.title,
    creation: insuranceCardFrontDocumentReference?.date,
    contentType: insuranceCardFrontDocumentReference?.content[0].attachment.contentType,
  };

  const insuranceCardBackDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-back')
  );

  const insuranceCardBack = {
    url: insuranceCardBackDocumentReference?.content[0].attachment.url,
    title: insuranceCardBackDocumentReference?.content[0].attachment.title,
    creation: insuranceCardBackDocumentReference?.date,
    contentType: insuranceCardBackDocumentReference?.content[0].attachment.contentType,
  };

  const secondaryInsuranceCardFrontDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-front-2')
  );

  const secondaryInsuranceCardFront = {
    url: secondaryInsuranceCardFrontDocumentReference?.content[0].attachment.url,
    title: secondaryInsuranceCardFrontDocumentReference?.content[0].attachment.title,
    creation: secondaryInsuranceCardFrontDocumentReference?.date,
    contentType: secondaryInsuranceCardFrontDocumentReference?.content[0].attachment.contentType,
  };

  const secondaryInsuranceCardBackDocumentReference = documents?.find((doc) =>
    doc.content.some((item) => item.attachment.title === 'insurance-card-back-2')
  );

  const secondaryInsuranceCardBack = {
    url: secondaryInsuranceCardBackDocumentReference?.content[0].attachment.url,
    title: secondaryInsuranceCardBackDocumentReference?.content[0].attachment.title,
    creation: secondaryInsuranceCardBackDocumentReference?.date,
    contentType: secondaryInsuranceCardBackDocumentReference?.content[0].attachment.contentType,
  };

  return {
    photoIdFront,
    photoIdBack,
    insuranceCardFront,
    insuranceCardBack,
    secondaryInsuranceCardFront,
    secondaryInsuranceCardBack,
  };
};

export const extractAttachmentUrls = (documentsData: Documents): string[] => {
  return Object.values(documentsData)
    .map((doc) => doc.url)
    .filter((url): url is string => Boolean(url));
};

export const createDocumentsSection = <TData extends { documents?: Documents }>(): PdfSection<TData, Documents> => ({
  dataSelector: (data) => data.documents,
  extractImages: (documents) => {
    return Object.entries(documents)
      .filter(([_, value]) => !!value.url)
      .map(([_, value]) => ({
        url: value.url as string,
        key: value.title,
      }));
  },
  render: async (client, documents, styles, assets) => {
    if (!assets?.images) return;
    const { images } = assets;

    const drawSection = (title: string, frontKey: keyof typeof documents, backKey: keyof typeof documents): void => {
      const frontDoc = documents[frontKey];
      const backDoc = documents[backKey];

      const hasFront = frontDoc?.title && images[frontDoc.title];
      const hasBack = backDoc?.title && images[backDoc.title];
      if (!hasFront && !hasBack) return;

      client.drawText(title, styles.textStyles.regular);
      client.newLine(130);

      const imageWidth = (client.getRightBound() - client.getLeftBound()) / 2 - 10;
      const imageHeight = Math.round(imageWidth / 2);

      if (hasFront) {
        client.drawImage(images[frontDoc.title], {
          width: imageWidth,
          height: imageHeight,
          center: false,
          margin: { top: 0, left: 0, right: 10, bottom: 0 },
        });
      }

      if (hasBack) {
        client.drawImage(images[backDoc.title], {
          width: imageWidth,
          height: imageHeight,
          center: false,
          margin: { top: 0, left: 10, right: 0, bottom: 0 },
        });
      }

      client.newLine(40);
    };

    client.addNewPage(PDF_CLIENT_STYLES.initialPage);

    drawSection('Primary Insurance Card', 'insuranceCardFront', 'insuranceCardBack');
    drawSection('Secondary Insurance Card', 'secondaryInsuranceCardFront', 'secondaryInsuranceCardBack');
    drawSection('Photo ID', 'photoIdFront', 'photoIdBack');
  },
});
