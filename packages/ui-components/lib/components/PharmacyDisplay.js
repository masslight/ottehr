import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { Box, Button, Typography } from '@mui/material';
export const PharmacyDisplay = (props) => {
    const { selectedPlace, clearPharmacyData, dataTestIds } = props;
    const handleResetPharmacySelection = () => {
        clearPharmacyData();
    };
    return (<Box display="flex" justifyContent="space-between" alignItems="center">
      <Box data-testid={dataTestIds.text}>
        <Typography>{selectedPlace.name}</Typography>
        <Typography variant="body2" color="text.secondary">
          {selectedPlace.address}
        </Typography>
      </Box>
      <Box>
        <Button data-testid={dataTestIds.button} onClick={handleResetPharmacySelection} sx={{
            textTransform: 'none',
            borderRadius: 28,
            fontWeight: 'bold',
        }}>
          <DeleteIcon sx={{ color: '#B22020' }}/>
        </Button>
      </Box>
    </Box>);
};
//# sourceMappingURL=PharmacyDisplay.js.map