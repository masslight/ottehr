import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, Typography } from '@mui/material';
import { FC } from 'react';
import { otherColors } from 'src/IntakeThemeProvider';
import { PlacesResult } from 'utils';
import { clearPharmacyCollectionAnswerSet } from './helpers';

export interface PharmacyDisplayProps {
  selectedPlace: PlacesResult;
  setSelectedPlace: (place: PlacesResult | null) => void;
  onChange: (e: any) => void;
}

export const PharmacyDisplay: FC<PharmacyDisplayProps> = (props: PharmacyDisplayProps) => {
  const { selectedPlace, setSelectedPlace, onChange } = props;

  const handleResetPharmacySelection = (): void => {
    const answerSet = clearPharmacyCollectionAnswerSet();
    onChange(answerSet);
    setSelectedPlace(null);
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center">
      <Box>
        <Typography>{selectedPlace.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedPlace.address}
        </Typography>
      </Box>
      <Box>
        <Button
          onClick={handleResetPharmacySelection}
          sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
          }}
        >
          <DeleteIcon sx={{ color: otherColors.cancel }} />
        </Button>
      </Box>
    </Box>
  );
};
