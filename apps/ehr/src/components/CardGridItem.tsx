import { otherColors } from '@ehrTheme/colors';
import { Box } from '@mui/material';
import { ReactElement } from 'react';
import { DocumentInfo } from 'utils';

interface CardGridItemProps {
  card: DocumentInfo;
  appointmentID: string | undefined;
  fullCardPdf: DocumentInfo | undefined;
  aspectRatio: number;
  handleClick: () => void;
}

export default function CardGridItem({ card, aspectRatio, handleClick }: CardGridItemProps): ReactElement {
  return (
    <Box
      onClick={() => {
        handleClick();
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
