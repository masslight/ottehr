import React, { ReactElement, useState } from 'react';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/system';
import { Grid } from '@mui/material';
import { IntakeNote } from '../../features/css-module/components/IntakeNotes';
import { TypographyOptions } from '@mui/material/styles/createTypography';

interface PageTitleProps {
  label: string;
}

export const CSSPageTitle = styled(Typography)(({ theme }) => ({
  ...(theme?.typography as TypographyOptions).h4,
  textAlign: 'left',
  fontWeight: 'bold',
  color: theme.palette.primary.dark,
}));

export const PageTitle = ({ label }: PageTitleProps): ReactElement => {
  const [open] = useState(true);

  return (
    <Grid container sx={{ alignItems: 'center' }} columns={{ xs: 10 }}>
      <Grid item xs>
        <CSSPageTitle>{label}</CSSPageTitle>
      </Grid>
      <Grid item>
        <IntakeNote open={open} />
      </Grid>
    </Grid>
  );
};
