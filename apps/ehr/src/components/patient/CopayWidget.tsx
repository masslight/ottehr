import { Box, Grid, Typography, useTheme } from '@mui/material';
import { FC, useMemo } from 'react';
import { PatientPaymentBenefit } from 'utils';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import PersonRemoveIcon from '@mui/icons-material/PersonRemove';

interface CopayWidgetProps {
  copay: PatientPaymentBenefit[];
}

// This set contains the service codes that are supported by the CopayWidget.
// Currently, it only includes 'UC' (Urgent Care), but can be overwritten to include any from
// the enumeration defined as BenefitCoverageCodes in packages/utils/lib/types/data/telemed/eligibility.types.ts
const supportedServiceCodes = new Set(['UC']);

export const CopayWidget: FC<CopayWidgetProps> = ({ copay }) => {
  const { inNetworkList, outOfNetworkList } = useMemo(() => {
    const filteredByService = copay.filter((b) => supportedServiceCodes.has(b.code));
    const inNetworkList = filteredByService.filter((b) => b.inNetwork);
    const outOfNetworkList = filteredByService.filter((b) => !b.inNetwork);
    return { inNetworkList, outOfNetworkList };
  }, [copay]);
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
              borderTop: '1px solid  rgba(0, 0, 0, 0.12)',
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
                {amountStringForBenefit(benefit)}
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

const amountStringForBenefit = (benefit: PatientPaymentBenefit): string => {
  const amountInUSD = benefit.amountInUSD;
  const percentage = benefit.percentage;

  if (benefit.coverageCode === 'A') {
    if (percentage > 0) {
      return `${percentage}%`;
    } else if (amountInUSD > 0) {
      return `$${amountInUSD}`;
    } else {
      return '0%';
    }
  } else {
    if (amountInUSD > 0) {
      return `$${amountInUSD}`;
    } else if (percentage > 0) {
      return `${percentage}%`;
    } else {
      return '$0';
    }
  }
};
