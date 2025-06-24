import { useAuth0 } from '@auth0/auth0-react';
import { otherColors } from '@ehrTheme/colors';
import ContentPasteOffIcon from '@mui/icons-material/ContentPasteOff';
import { Box, CircularProgress, Grid, Paper, Typography } from '@mui/material';
import { Bundle, BundleEntry, DocumentReference } from 'fhir/r4b';
import { FC, useMemo, useState } from 'react';
import { getQuestionnaireResponseByLinkId, INSURANCE_CARD_CODE, PHOTO_ID_CARD_CODE } from 'utils';
import DownloadImagesButton from '../../../../components/DownloadImagesButton';
import ImageCarousel, { ImageCarouselObject } from '../../../../components/ImageCarousel';
import { getPresignedFileUrl } from '../../../../helpers/files.helper';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { DocumentInfo, DocumentType } from '../../../../types/types';
import { useAppointmentStore, useGetDocumentReferences } from '../../../state';
function compareCards(
  cardBackType: DocumentType.PhotoIdBack | DocumentType.InsuranceBack | DocumentType.InsuranceBackSecondary
) {
  return (a: DocumentInfo, b: DocumentInfo) => {
    if (a && b) {
      return a.type === cardBackType ? 1 : -1;
    }
    return 0;
  };
}

export const InsuranceCardAndPhotoContainer: FC = () => {
  const { getAccessTokenSilently } = useAuth0();
  const { patient, appointment, questionnaireResponse } = getSelectors(useAppointmentStore, [
    'patient',
    'appointment',
    'questionnaireResponse',
  ]);

  const appointmentId = appointment?.id;
  const paymentOption = getQuestionnaireResponseByLinkId('payment-option', questionnaireResponse)?.answer?.[0]
    ?.valueString;
  const selfPay = paymentOption === 'I will pay without insurance';
  const [photoZoom, setPhotoZoom] = useState<boolean>(false);
  const [zoomedIdx, setZoomedIdx] = useState<number>(0);

  const [sections, setSections] = useState<{ title: string; cards: DocumentInfo[]; downloadLabel: string }[]>([]);
  const [fetchCompleted, setFetchCompleted] = useState<boolean>(false);

  useGetDocumentReferences({ appointmentId: appointment?.id, patientId: patient?.id }, async (data) => {
    const authToken = await getAccessTokenSilently();

    const documentReferenceResources: DocumentReference[] = [];

    const bundleEntries = data.entry;
    bundleEntries?.forEach((bundleEntry: BundleEntry) => {
      const bundleResource = bundleEntry.resource as Bundle;
      bundleResource.entry?.forEach((entry) => {
        const docRefResource = entry.resource as DocumentReference;
        docRefResource && documentReferenceResources.push(docRefResource);
      });
    });

    const allCards: DocumentInfo[] = [];
    for (const docRef of documentReferenceResources) {
      const docRefCode = docRef.type?.coding?.[0].code;

      if (docRefCode && [PHOTO_ID_CARD_CODE, INSURANCE_CARD_CODE].includes(docRefCode)) {
        for (const content of docRef.content) {
          const title = content.attachment.title;
          const z3Url = content.attachment.url;

          if (
            z3Url &&
            title &&
            Object.values<string>(DocumentType).includes(title) &&
            (docRefCode === PHOTO_ID_CARD_CODE || (docRefCode === INSURANCE_CARD_CODE && !selfPay))
          ) {
            const presignedUrl = await getPresignedFileUrl(z3Url, authToken);
            presignedUrl &&
              allCards.push({
                z3Url: z3Url,
                presignedUrl: presignedUrl,
                type: title as DocumentType,
              });
          }
        }
      }
    }

    if (allCards.length) {
      const photoIdCards: DocumentInfo[] = allCards
        .filter((card) => [DocumentType.PhotoIdFront, DocumentType.PhotoIdBack].includes(card.type))
        .sort(compareCards(DocumentType.PhotoIdBack));
      const primaryInsuranceCards: DocumentInfo[] = allCards
        .filter((card) => [DocumentType.InsuranceFront, DocumentType.InsuranceBack].includes(card.type))
        .sort(compareCards(DocumentType.InsuranceBack));
      const secondaryInsuranceCards: DocumentInfo[] = allCards
        .filter((card) =>
          [DocumentType.InsuranceFrontSecondary, DocumentType.InsuranceBackSecondary].includes(card.type)
        )
        .sort(compareCards(DocumentType.InsuranceBackSecondary));

      const sectionsData = [
        {
          title: 'Primary Insurance Card',
          cards: primaryInsuranceCards,
          downloadLabel: 'Download Insurance Card',
        },
        {
          title: 'Secondary Insurance Card',
          cards: secondaryInsuranceCards,
          downloadLabel: 'Download Insurance Card',
        },
        {
          title: 'Photo ID',
          cards: photoIdCards,
          downloadLabel: 'Download Photo IDs',
        },
      ];

      setSections(sectionsData);
    }

    setFetchCompleted(true);
  });

  const imageCarouselObjs = useMemo(
    () =>
      sections.flatMap((section) =>
        section.cards.map<ImageCarouselObject>((card) => ({
          alt: card.type,
          url: card.presignedUrl || '',
          key: card.type,
        }))
      ),
    [sections]
  );

  return (
    <>
      <ImageCarousel
        imagesObj={imageCarouselObjs}
        imageIndex={zoomedIdx}
        setImageIndex={setZoomedIdx}
        open={photoZoom}
        setOpen={setPhotoZoom}
      />
      <Paper sx={{ width: '100%', display: 'flex', flexWrap: 'wrap', p: 3, gap: 2 }}>
        {(!fetchCompleted && (
          <Box sx={{ display: 'flex', justifyContent: 'center', width: '100%' }}>
            <CircularProgress sx={{ justifySelf: 'center' }} />
          </Box>
        )) ||
          sections.map((section, sectionIndex) => (
            <Box key={sectionIndex} sx={{ flex: '0 1 475px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Typography color="primary.dark">{section.title}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                {section.cards.map((card, cardIndex) => {
                  const offset = sections
                    .slice(0, sectionIndex)
                    .reduce((total, currentSection) => total + currentSection.cards.length, 0);

                  return (
                    <Box
                      key={cardIndex}
                      sx={{
                        flex: '1 0 48%',
                        height: '140px',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        cursor: 'pointer',
                        borderRadius: 2,
                        border: `1px solid ${otherColors.dottedLine}`,
                      }}
                      onClick={() => {
                        setZoomedIdx(cardIndex + offset);
                        setPhotoZoom(true);
                      }}
                    >
                      <img src={card.presignedUrl} alt={card.type} style={{ maxHeight: '100%', maxWidth: '100%' }} />
                    </Box>
                  );
                })}
              </Box>
              {appointmentId && (
                <Box>
                  <DownloadImagesButton
                    cards={section.cards}
                    appointmentId={appointmentId}
                    title={section.downloadLabel}
                  />
                </Box>
              )}
            </Box>
          ))}
        {!sections.some((section) => section.cards.length > 0) && fetchCompleted && (
          <Grid item xs={12} display="flex" alignItems="center" justifyContent="center">
            <Typography variant="h3" color="primary.dark">
              No images have been uploaded <ContentPasteOffIcon />
            </Typography>
          </Grid>
        )}
      </Paper>
    </>
  );
};
