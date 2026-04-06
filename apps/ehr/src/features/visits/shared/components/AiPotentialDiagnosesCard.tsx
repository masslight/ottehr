import { otherColors } from '@ehrTheme/colors';
import CloseIcon from '@mui/icons-material/Close';
import { Box, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { BillingSuggestionsResult } from '../hooks/useBillingSuggestions';
import { AiSectionHeader } from './AiSection';

interface AiPotentialDiagnosesCardProps {
  suggestions: BillingSuggestionsResult;
}

export const AiPotentialDiagnosesCard: FC<AiPotentialDiagnosesCardProps> = ({ suggestions }) => {
  const theme = useTheme();
  const [visible, setVisible] = useState<boolean>(true);

  const { codingSuggestions, isLoading } = suggestions;

  const handleClose = (): void => {
    setVisible(false);
  };

  if (!visible) {
    return <></>;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1px',
        backgroundColor: theme.palette.background.paper,
        border: `1px solid ${otherColors.solidLine}`,
        borderRadius: 1,
        marginBottom: '16px',
        padding: '16px',
      }}
    >
      <Box
        style={{
          display: 'flex',
          borderRadius: '8px',
          marginBottom: '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <AiSectionHeader isLoading={isLoading} />
        <IconButton onClick={handleClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      <Box
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '8px',
          minHeight: '80px',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, marginBottom: '8px' }}>
          <Typography variant="body1" style={{ fontWeight: 700 }}>
            Audit Finding
          </Typography>
          {isLoading && <CircularProgress size={14} />}
        </Box>
        {codingSuggestions ? (
          <Typography variant="body1">{codingSuggestions}</Typography>
        ) : (
          !isLoading && <Typography color="secondary.light">No suggestions</Typography>
        )}
      </Box>
    </Box>
  );
};
