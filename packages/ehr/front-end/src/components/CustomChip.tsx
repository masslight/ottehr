import { ReactElement } from 'react';
import { Box, SxProps, Typography, useTheme } from '@mui/material';
import DoneOutlinedIcon from '@mui/icons-material/DoneOutlined';

interface CustomChipProps {
  type: 'status bullet' | 'document';
  fill: string;
  label?: string;
  additionalSx?: SxProps;
  completed?: boolean;
}

export default function CustomChip({ label, type, additionalSx, completed, fill }: CustomChipProps): ReactElement {
  const theme = useTheme();

  return (
    <>
      {(() => {
        switch (type) {
          case 'status bullet':
            return (
              <Box sx={{ display: 'flex', alignItems: 'center', mr: '8px' }}>
                <Box sx={{ borderRadius: '100px', height: '10px', width: '10px', backgroundColor: fill }}></Box>
              </Box>
            );
          case 'document':
            return (
              <Typography
                variant="body2"
                sx={{
                  backgroundColor: completed ? fill : '#E6E8EE',
                  px: '8px',
                  color: completed ? theme.palette.primary.contrastText : theme.palette.text.disabled,
                  borderRadius: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  ...additionalSx,
                }}
              >
                <DoneOutlinedIcon sx={{ width: '12px', height: '12px' }}></DoneOutlinedIcon>
                &nbsp;{label}
              </Typography>
            );
        }
      })()}
    </>
  );
}
