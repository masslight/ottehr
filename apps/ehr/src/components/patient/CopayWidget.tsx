import { Grid, Typography, useTheme } from '@mui/material';
import { FC } from 'react';
import { CopayBenefit } from 'utils';

interface CopayWidgetProps {
  copay: CopayBenefit[];
  benefitFilter?: (benefit: CopayBenefit) => boolean;
}

export const CopayWidget: FC<CopayWidgetProps> = ({ copay, benefitFilter }) => {
  const filteredList = benefitFilter ? copay.filter(benefitFilter) : copay;
  const theme = useTheme();

  return (
    <Grid
      sx={{
        backgroundColor: 'rgba(244, 246, 248, 1)',
        padding: 1,
      }}
      container
      spacing={2}
    >
      <Grid item>
        <Typography variant="h5" color={theme.palette.primary.dark} fontWeight={theme.typography.fontWeightBold}>
          Co-pay
        </Typography>
      </Grid>
      {filteredList.length > 0 ? (
        filteredList.map((benefit) => (
          <Grid
            container
            sx={{
              borderTop: '1px solid  rgba(0, 0, 0, 0.12)',
              // justifyContent: 'center',
              // alignItems: 'center',
            }}
            item
            key={`${JSON.stringify(benefit)}`}
            direction="row"
          >
            <Grid item xs={5}>
              <Typography variant="body1" color={theme.palette.primary.dark}>
                {benefit.description}
              </Typography>
            </Grid>
            <Grid item xs={5}>
              <Typography variant="body1" color={theme.palette.primary.dark}>
                {benefit.inplanNetwork ? 'In network' : 'Out of network'}
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography
                variant="body1"
                fontWeight={theme.typography.fontWeightMedium}
                color={theme.palette.text.primary}
                textAlign="right"
              >
                {`$${benefit.amountInUSD}`}
              </Typography>
            </Grid>
          </Grid>
        ))
      ) : (
        <p>No copay benefits available.</p>
      )}
    </Grid>
  );
};
