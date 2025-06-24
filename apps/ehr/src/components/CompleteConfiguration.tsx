import { otherColors } from '@ehrTheme/colors';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
interface CompleteConfigurationProps {
  handleSetup: () => void;
}

export const CompleteConfiguration: FC<CompleteConfigurationProps> = ({ handleSetup }) => {
  return (
    <Box
      sx={{
        backgroundColor: otherColors.orange100,
        px: '20px',
        py: '10px',
        borderRadius: '4px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
      }}
    >
      <Typography variant="body1">
        <span style={{ fontWeight: 'bold' }}>Complete configuration</span>
        <br />
        Functionality might be limited. Please follow the guide to setup and enable the feature.
      </Typography>
      <Button
        sx={{
          backgroundColor: otherColors.orange800,
          color: '#FFFFFF',
          borderRadius: '100px',
          textTransform: 'none',
          '&:hover': {
            backgroundColor: otherColors.orange700,
          },
        }}
        onClick={() => handleSetup()}
      >
        Setup
      </Button>
    </Box>
  );
};
