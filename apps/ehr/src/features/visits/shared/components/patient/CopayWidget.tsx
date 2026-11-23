import { otherColors } from '@ehrTheme/colors';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';
import { Box, Grid, Typography, useTheme } from '@mui/material';
import { FC, useMemo } from 'react';
import { formatPatientPaymentBenefitAmount, getPatientPaymentBenefitsByNetwork } from 'utils/lib/fhir/billing';
import { PatientPaymentBenefit } from 'utils/lib/types/data/telemed/eligibility.types';

interface CopayWidgetProps {
  copay: PatientPaymentBenefit[];
}

export const CopayWidget: FC<CopayWidgetProps> = ({ copay }) => {
  const { inNetwork: inNetworkList, outOfNetwork: outOfNetworkList } = useMemo(
    () => getPatientPaymentBenefitsByNetwork(copay),
    [copay]
  );
  const theme = useTheme();

  return (
    <Grid
      sx={{
        backgroundColor: otherColors.apptHover,
        padding: 1,
      }}
      container
      spacing={2}
    >
      <Grid item>
        <Typography variant="h5" color={theme.palette.primary.dark} fontWeight={theme.typography.fontWeightBold}>
          Patient payment
        </Typography>
      </Grid>
      <BenefitSection
        title={'Patient is In-Network'}
        titleIcon={<HowToRegIcon sx={{ color: theme.palette.success.main, fontSize: 20 }} />}
        emptyMessage={'No in-network benefits available.'}
        benefits={inNetworkList}
      />
      <BenefitSection
        title={'Patient is Out-of-Network'}
        titleIcon={<PersonRemoveIcon sx={{ color: theme.palette.error.main, fontSize: 20 }} />}
        emptyMessage={'No out-of-network benefits available.'}
        benefits={outOfNetworkList}
      />
    </Grid>
  );
};

interface BenefitSectionProps {
  title: string;
  titleIcon?: React.ReactNode;
  emptyMessage: string;
  benefits: PatientPaymentBenefit[];
}

const BenefitSection: FC<BenefitSectionProps> = ({ title, titleIcon, emptyMessage, benefits }) => {
  const theme = useTheme();
  return (
    <Grid container item direction="column" spacing={1}>
      <Grid item>
        <Box sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
          {titleIcon ?? <></>}
          <Typography variant="h6" color={theme.palette.primary.dark}>
            {title}
          </Typography>
        </Box>
      </Grid>
      {benefits.length > 0 ? (
        benefits.map((benefit) => (
          <Grid
            container
            sx={{
              borderTop: `1px solid ${otherColors.lightDivider}`,
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
                {benefit.coverageCode === 'A' ? 'Co-Insurance' : 'Co-Pay'}
              </Typography>
            </Grid>
            <Grid item xs={2}>
              <Typography
                variant="body1"
                fontWeight={theme.typography.fontWeightMedium}
                color={theme.palette.text.primary}
                textAlign="right"
              >
                {formatPatientPaymentBenefitAmount(benefit)} / {benefit.periodDescription}
              </Typography>
            </Grid>
          </Grid>
        ))
      ) : (
        <p>{emptyMessage}</p>
      )}
    </Grid>
  );
};
