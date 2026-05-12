import { useAuth0 } from '@auth0/auth0-react';
import CloseIcon from '@mui/icons-material/Close';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import { Box, Button, IconButton, Paper, Skeleton, Stack, Typography, useTheme } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { createZ3Object, deletePatientDocument, uploadPatientConditionPhoto } from 'src/api/api';
import ImageCarousel, { ImageCarouselObject } from 'src/components/ImageCarousel';
import { useApiClients } from 'src/hooks/useAppClients';
import { GetPresignedFileURLInput, getPresignedURL } from 'utils';
import { useGetAppointmentAccessibility } from '../hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from '../stores/appointment/appointment.store';

const ALLOWED_FORMATS: GetPresignedFileURLInput['fileFormat'][] = ['jpg', 'jpeg', 'png'];

export const PatientConditionPhotosCard: FC = () => {
  const theme = useTheme();
  const { id: appointmentId } = useParams();
  const { oystehr } = useApiClients();
  const { getAccessTokenSilently } = useAuth0();
  const queryClient = useQueryClient();
  const { isAppointmentLoading, patientConditionPhotos } = useAppointmentData();
  const { isAppointmentReadOnly } = useGetAppointmentAccessibility();

  const [signedPhotos, setSignedPhotos] = useState<Array<{ url: string; documentRefId: string }>>([]);
  const [photoUrlsLoading, setPhotoUrlsLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState(false);
  const [zoomedIdx, setZoomedIdx] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load(): Promise<void> {
      try {
        setPhotoUrlsLoading(true);
        const authToken = await getAccessTokenSilently();
        const signed = await Promise.all(
          patientConditionPhotos.map(async (p) => {
            const url = await getPresignedURL(p.url, authToken);
            return url ? { url, documentRefId: p.documentRefId } : undefined;
          })
        );
        if (!cancelled) {
          setSignedPhotos(signed.filter(Boolean) as Array<{ url: string; documentRefId: string }>);
        }
      } catch {
        console.error('Error while trying to get patient photo presigned urls');
      } finally {
        if (!cancelled) setPhotoUrlsLoading(false);
      }
    }
    if (patientConditionPhotos.length > 0) {
      void load();
    } else {
      setSignedPhotos([]);
    }
    return () => {
      cancelled = true;
    };
  }, [getAccessTokenSilently, patientConditionPhotos]);

  const carouselObjects: ImageCarouselObject[] = signedPhotos.map((p, i) => ({
    url: p.url,
    alt: `Patient condition photo #${i + 1}`,
  }));

  const refreshAppointment = async (): Promise<void> => {
    await queryClient.invalidateQueries({ queryKey: ['telemed-appointment', appointmentId], exact: false });
  };

  const handleFiles = async (files: FileList | null): Promise<void> => {
    if (!files || files.length === 0) return;
    if (!oystehr || !appointmentId) {
      enqueueSnackbar('Cannot upload right now. Try again later.', { variant: 'error' });
      return;
    }

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
        const format = (ext === 'jpeg' ? 'jpg' : ext) as GetPresignedFileURLInput['fileFormat'];
        if (!ALLOWED_FORMATS.includes(format)) {
          enqueueSnackbar(`Unsupported file type: ${file.name}`, { variant: 'error' });
          continue;
        }

        const fileType = `patient-photo-${Date.now()}-${i}` as GetPresignedFileURLInput['fileType'];
        const z3URL = await createZ3Object(
          { appointmentID: appointmentId, fileType, fileFormat: format, file },
          oystehr
        );
        await uploadPatientConditionPhoto(oystehr, {
          appointmentID: appointmentId,
          z3URL,
          title: file.name,
          mimeType: file.type,
        });
      }
      await refreshAppointment();
      enqueueSnackbar('Photo(s) uploaded.', { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar('Error uploading photo.', { variant: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (documentRefId: string): Promise<void> => {
    if (!oystehr) return;
    setDeletingId(documentRefId);
    try {
      await deletePatientDocument(oystehr, { documentRefId });
      await refreshAppointment();
    } catch (e) {
      console.error(e);
      enqueueSnackbar('Error deleting photo.', { variant: 'error' });
    } finally {
      setDeletingId(null);
    }
  };

  const showSection = isAppointmentLoading || photoUrlsLoading || carouselObjects.length > 0 || !isAppointmentReadOnly;
  if (!showSection) return null;

  return (
    <Paper elevation={3} sx={{ boxShadow: '0px 2px 4px -1px rgba(0,0,0,0.1)', p: 3 }}>
      <ImageCarousel
        imagesObj={carouselObjects}
        imageIndex={zoomedIdx}
        setImageIndex={setZoomedIdx}
        open={photoZoom}
        setOpen={setPhotoZoom}
      />

      <Stack spacing={2}>
        <Typography variant="h6" sx={{ color: theme.palette.primary.dark, fontWeight: 600 }}>
          Patient Condition Photos
        </Typography>

        {!isAppointmentReadOnly && (
          <Box>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png"
              multiple
              hidden
              onChange={(e) => void handleFiles(e.target.files)}
            />
            <Button
              variant="outlined"
              startIcon={<PhotoLibraryOutlinedIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              sx={{ borderRadius: 100, textTransform: 'none' }}
            >
              {uploading ? 'Uploading...' : 'Upload from gallery'}
            </Button>
          </Box>
        )}

        {isAppointmentLoading || photoUrlsLoading ? (
          <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}>
            {[1, 2, 3].map((item) => (
              <Box key={item} sx={{ aspectRatio: '1/1' }}>
                <Skeleton variant="rounded" height="100%" />
              </Box>
            ))}
          </Box>
        ) : carouselObjects.length > 0 ? (
          <Box sx={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridGap: 16 }}>
            {signedPhotos.map((photo, ind) => (
              <Box key={photo.documentRefId} sx={{ position: 'relative', aspectRatio: '1/1' }}>
                <Box
                  onClick={() => {
                    setPhotoZoom(true);
                    setZoomedIdx(ind);
                  }}
                  sx={{ width: '100%', height: '100%', cursor: 'pointer' }}
                >
                  <img
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }}
                    src={photo.url}
                    alt={`Patient condition photo #${ind + 1}`}
                    loading="lazy"
                  />
                </Box>
                {!isAppointmentReadOnly && (
                  <IconButton
                    size="small"
                    onClick={() => void handleDelete(photo.documentRefId)}
                    disabled={deletingId === photo.documentRefId}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      backgroundColor: theme.palette.error.main,
                      color: '#fff',
                      width: 24,
                      height: 24,
                      '&:hover': { backgroundColor: theme.palette.error.dark },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                )}
              </Box>
            ))}
          </Box>
        ) : null}
      </Stack>
    </Paper>
  );
};
