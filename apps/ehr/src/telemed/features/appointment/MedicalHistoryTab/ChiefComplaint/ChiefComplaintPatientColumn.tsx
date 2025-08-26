import { useAuth0 } from '@auth0/auth0-react';
import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import { FC, useEffect, useState } from 'react';
import { AiObservationField, getPresignedURL, ObservationTextFieldDTO } from 'utils';
import AiSuggestion from '../../../../../components/AiSuggestion';
import ImageCarousel, { ImageCarouselObject } from '../../../../../components/ImageCarousel';
import { dataTestIds } from '../../../../../constants/data-test-ids';
import { getSelectors } from '../../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../../state';

export const ChiefComplaintPatientColumn: FC = () => {
  const theme = useTheme();
  const { isAppointmentLoading, patientPhotoUrls, appointment, chartData } = getSelectors(useAppointmentStore, [
    'isAppointmentLoading',
    'patientPhotoUrls',
    'appointment',
    'chartData',
  ]);

  const [signedPhotoUrls, setSignedPhotoUrls] = useState<string[]>([]);
  const [photoUrlsLoading, setPhotoUrlsLoading] = useState<boolean>(false);
  const { getAccessTokenSilently } = useAuth0();
  const photoCarouselObjects: ImageCarouselObject[] = signedPhotoUrls.map((url, ind) => ({
    url: url,
    alt: `Patient condition photo #${ind + 1}`,
  }));
  const [photoZoom, setPhotoZoom] = useState<boolean>(false);
  const [zoomedIdx, setZoomedIdx] = useState<number>(0);

  useEffect(() => {
    async function getPresignedPhotoUrls(): Promise<void> {
      try {
        setPhotoUrlsLoading(true);
        const authToken = await getAccessTokenSilently();
        const requests: Promise<string | undefined>[] = [];
        patientPhotoUrls.forEach((url) => {
          requests.push(getPresignedURL(url, authToken));
        });
        const signedUrls = await Promise.all(requests);
        setSignedPhotoUrls(signedUrls.filter(Boolean) as string[]);
      } catch {
        console.error('Error while trying to get patient photo presigned urls');
      } finally {
        setPhotoUrlsLoading(false);
      }
    }

    if (patientPhotoUrls?.length > 0) {
      void getPresignedPhotoUrls();
    }
  }, [getAccessTokenSilently, patientPhotoUrls]);

  const aiHistoryOfPresentIllness = chartData?.observations?.find(
    (observation) => observation.field === AiObservationField.HistoryOfPresentIllness
  ) as ObservationTextFieldDTO;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <ImageCarousel
        imagesObj={photoCarouselObjects}
        imageIndex={zoomedIdx}
        setImageIndex={setZoomedIdx}
        open={photoZoom}
        setOpen={setPhotoZoom}
      />
      <Box>
        <Typography variant="subtitle2" color={theme.palette.primary.dark}>
          Reason for visit selected by patient
        </Typography>
        {isAppointmentLoading ? (
          <Skeleton width="100%">
            <Typography>.</Typography>
          </Skeleton>
        ) : (
          <Typography data-testid={dataTestIds.telemedEhrFlow.hpiReasonForVisit}>
            {appointment?.description ?? ''}
          </Typography>
        )}
      </Box>
      {(isAppointmentLoading || photoUrlsLoading || photoCarouselObjects?.length > 0) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Typography variant="subtitle2" color={theme.palette.primary.dark}>
              Photo of patient’s condition
            </Typography>
            <Typography variant="subtitle2" color={theme.palette.text.secondary}>
              Click to zoom
            </Typography>
          </Box>
          {isAppointmentLoading ? (
            <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}>
              {[1, 2].map((item) => (
                <Box key={item} sx={{ aspectRatio: '1/1' }}>
                  <Skeleton variant="rounded" height="100%" />
                </Box>
              ))}
            </Box>
          ) : (
            <Box
              sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}
              data-testid={dataTestIds.telemedEhrFlow.hpiPatientConditionPhotos}
            >
              {photoCarouselObjects.map((photoObj, ind) => (
                <Box key={photoObj.url} display="inline-block" sx={{ cursor: 'pointer' }}>
                  <img
                    onClick={() => {
                      setPhotoZoom(true);
                      setZoomedIdx(ind);
                    }}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                    src={photoObj.url}
                    alt={photoObj.alt}
                    loading="lazy"
                  />
                </Box>
              ))}
            </Box>
          )}
        </Box>
      )}
      {aiHistoryOfPresentIllness ? (
        <>
          <hr style={{ border: '0.5px solid #DFE5E9', margin: '0 -16px 0 -16px' }} />
          <AiSuggestion title={'History of Present Illness (HPI)'} content={aiHistoryOfPresentIllness.value} />
        </>
      ) : undefined}
    </Box>
  );
};
