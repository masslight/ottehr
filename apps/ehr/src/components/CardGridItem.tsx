import { otherColors } from '@ehrTheme/colors';
import { Box, Grid } from '@mui/material';
import { ReactElement } from 'react';
import { DocumentInfo } from '../types/types';
import DownloadImagesButton from './DownloadImagesButton';

interface CardGridItemProps {
  card: DocumentInfo;
  index: number;
  appointmentID: string | undefined;
  cards: DocumentInfo[];
  fullCardPdf: DocumentInfo | undefined;
  setZoomedIdx: (value: React.SetStateAction<number>) => void;
  setPhotoZoom: (value: React.SetStateAction<boolean>) => void;
  title: string;
  offset?: number;
}

export default function CardGridItem({
  card,
  index,
  appointmentID,
  cards,
  fullCardPdf,
  setZoomedIdx,
  setPhotoZoom,
  title,
  offset = 0,
}: CardGridItemProps): ReactElement {
  return (
    <Grid key={card.type} item xs={12} sm={6} boxSizing="border-box">
      <Box border={`1px solid ${otherColors.dottedLine}`} height="170px" width="100%" my={1} borderRadius={2}>
        <Box
          onClick={() => {
            setZoomedIdx(index + offset);
            setPhotoZoom(true);
          }}
          sx={{ cursor: 'pointer' }}
          display="flex"
          justifyContent="center"
          alignItems="center"
          height="100%"
        >
          <img src={card.presignedUrl} alt={card.type} style={{ maxWidth: '100%', maxHeight: '100%' }} />
        </Box>
      </Box>
      {appointmentID && index === 0 && (
        <Box mt={2}>
          <DownloadImagesButton cards={cards} fullCardPdf={fullCardPdf} appointmentId={appointmentID} title={title} />
        </Box>
      )}
    </Grid>
  );
}
