import { otherColors } from '@ehrTheme/colors';
import { aiIcon } from '@ehrTheme/icons';
import { InfoOutlined } from '@mui/icons-material';
import CloseIcon from '@mui/icons-material/Close';
import { Box, CircularProgress, IconButton, Tooltip, Typography, useTheme } from '@mui/material';
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
        <Box
          style={{
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <img src={aiIcon} alt="" aria-hidden style={{ width: '30px', marginRight: '8px' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            OYSTEHR AI
          </Typography>
          <Tooltip title="AI generated outputs, recommendations, and suggestions are provided for informational purposes only and are not intended to replace professional medical judgment or clinical expertise. AI technology may produce inaccurate, incomplete, or misleading results, and you must independently verify, validate, and confirm all AI-generated information before making any clinical decisions or taking any actions based on these outputs.">
            <IconButton size="small" aria-label="AI disclaimer">
              <InfoOutlined sx={{ fontSize: '17px' }} />
            </IconButton>
          </Tooltip>
          {isLoading && <CircularProgress size={17} sx={{ marginLeft: '8px' }} />}
        </Box>
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
