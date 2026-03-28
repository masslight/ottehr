import { otherColors } from '@ehrTheme/colors';
import { aiIcon } from '@ehrTheme/icons';
import CloseIcon from '@mui/icons-material/Close';
import { Box, CircularProgress, IconButton, Typography, useTheme } from '@mui/material';
import { FC, useState } from 'react';
import { BillingSuggestionsResult } from '../hooks/useBillingSuggestions';

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

  const hasSuggestions = !!codingSuggestions;

  if (!visible || (!isLoading && !hasSuggestions)) {
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
          marginBottom: isLoading && !hasSuggestions ? '0px' : '8px',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src={aiIcon} style={{ width: '30px', marginRight: '8px' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </Typography>
          {isLoading && <CircularProgress size={17} sx={{ marginLeft: '8px' }} />}
        </Box>
        <IconButton onClick={handleClose} aria-label="Close">
          <CloseIcon />
        </IconButton>
      </Box>
      {codingSuggestions && (
        <Box
          style={{
            background: '#E1F5FECC',
            borderRadius: '8px',
            padding: '8px',
          }}
        >
          <Typography variant="body1" style={{ fontWeight: 700, marginBottom: '8px' }}>
            Coding Suggestions
          </Typography>
          <Typography variant="body1">{codingSuggestions}</Typography>
        </Box>
      )}
    </Box>
  );
};
