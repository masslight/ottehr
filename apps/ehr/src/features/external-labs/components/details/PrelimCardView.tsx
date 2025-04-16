import { Box, Typography, Button, Paper } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { FC } from 'react';

interface PrelimCardViewProps {
  date: string;
  status: 'received' | 'reviewed';
  onView: () => void;
}

export const PrelimCardView: FC<PrelimCardViewProps> = ({ date, status, onView }) => {
  return (
    <Paper
      elevation={0}
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        p: 2,
        borderRadius: 1,
        border: '1px solid #e0e0e0',
        backgroundColor: '#fff',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <InfoOutlinedIcon color="primary" fontSize="small" />
        <Typography variant="body1" color="text.primary">
          Preliminary results ({status} {date})
        </Typography>
      </Box>

      <Button
        variant="text"
        color="primary"
        endIcon={<VisibilityOutlinedIcon />}
        onClick={onView}
        sx={{ fontWeight: 500 }}
      >
        View
      </Button>
    </Paper>
  );
};
