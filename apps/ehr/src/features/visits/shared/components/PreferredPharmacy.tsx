import { otherColors } from '@ehrTheme/colors';
import StarIcon from '@mui/icons-material/Star';
import { Box, Typography, useTheme } from '@mui/material';
import React from 'react';
import { PharmacyDTO } from 'utils';

interface PreferredPharmacyProps {
  data: PharmacyDTO[];
}

export const PreferredPharmacy: React.FC<PreferredPharmacyProps> = ({ data: pharmacies }) => {
  const theme = useTheme();

  if (!pharmacies || pharmacies.length === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1,
        p: 2,
        border: '1px #DFE5E9 solid',
        borderRadius: '4px',
      }}
    >
      <Typography
        sx={{
          color: theme.palette.primary.dark,
          fontWeight: 'bold',
        }}
      >
        Preferred pharmacy
      </Typography>
      {pharmacies.map((pharmacy, index) => {
        const details = [pharmacy.name, pharmacy.address, pharmacy.phone].filter(Boolean).join(' / ');
        return (
          <Box
            key={index}
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
              gap: 1,
              flexWrap: 'wrap',
            }}
          >
            <Typography variant="body2">{details}</Typography>

            {pharmacy.primary && (
              <Box sx={{ display: 'flex', alignItems: 'center', color: otherColors.orange800, gap: 1 }}>
                <StarIcon />
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  Primary for this visit
                </Typography>
              </Box>
            )}
          </Box>
        );
      })}
    </Box>
  );
};
