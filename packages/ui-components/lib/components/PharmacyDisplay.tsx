import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { PlacesResult } from 'utils';

export interface PharmacyDisplayProps {
  selectedPlace: PlacesResult;
  clearPharmacyData: () => void;
  dataTestIds: { text: string; button: string };
}

export const PharmacyDisplay: FC<PharmacyDisplayProps> = (props: PharmacyDisplayProps) => {
  const { selectedPlace, clearPharmacyData, dataTestIds } = props;

  const handleResetPharmacySelection = (): void => {
    clearPharmacyData();
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Box data-testid={dataTestIds.text}>
        <Typography>{selectedPlace.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedPlace.address}
        </Typography>
      </Box>
      <Box>
        <Button
          data-testid={dataTestIds.button}
          onClick={handleResetPharmacySelection}
          sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
          }}
        >
          <DeleteIcon sx={{ color: '#B22020' }} />
        </Button>
      </Box>
    </Box>
  );
};
