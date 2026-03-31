import { otherColors } from '@ehrTheme/colors';
import { Box, CircularProgress, useTheme } from '@mui/material';
import { ReactElement } from 'react';
import { DocumentInfo } from 'utils';

interface CardGridItemProps {
  card: DocumentInfo;
  appointmentID: string | undefined;
  fullCardPdf: DocumentInfo | undefined;
  aspectRatio: number;
  handleClick: () => void;
  isLoading: boolean;
}

export default function CardGridItem({ card, aspectRatio, handleClick, isLoading }: CardGridItemProps): ReactElement {
  const theme = useTheme();
  return (
    <Box
      role="button"
      tabIndex={0}
      aria-label={`View ${card.type} image`}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      sx={{
        cursor: 'pointer',
        aspectRatio,
        overflow: 'hidden',
        position: 'relative',
        '&:focus-visible': { outline: `2px dashed ${theme.palette.primary.main}`, outlineOffset: '2px' },
      }}
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
      {isLoading && (
        <Box
          sx={{
            position: 'absolute',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: otherColors.cardBackground,
            height: '100%',
            width: '100%',
          }}
        >
          <CircularProgress size={24} />
        </Box>
      )}
    </Box>
  );
}
