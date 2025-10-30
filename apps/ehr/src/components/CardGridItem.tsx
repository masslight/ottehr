import { otherColors } from '@ehrTheme/colors';
import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { DocumentInfo } from 'utils';

interface CardGridItemProps {
  card: DocumentInfo;
  index: number;
  appointmentID: string | undefined;
  fullCardPdf: DocumentInfo | undefined;
  aspectRatio: number;
  setZoomedIdx: (value: React.SetStateAction<number>) => void;
  setPhotoZoom: (value: React.SetStateAction<boolean>) => void;
  offset?: number;
}

export default function CardGridItem({
  card,
  index,
  aspectRatio,
  setZoomedIdx,
  setPhotoZoom,
  offset = 0,
}: CardGridItemProps): ReactElement {
  return (
    <Box
      onClick={() => {
        setZoomedIdx(index + offset);
        setPhotoZoom(true);
      }}
      sx={{ cursor: 'pointer', aspectRatio, overflow: 'hidden' }}
      display="flex"
      justifyContent="center"
      alignItems="center"
      maxHeight="156px"
      border={`1px solid ${otherColors.dottedLine}`}
      borderRadius={2}
    >
      <img
        src={card.presignedUrl}
        alt={card.type}
        style={{ maxWidth: '100%', height: 'auto', objectFit: 'contain', aspectRatio }}
      />
    </Box>
  );
}
