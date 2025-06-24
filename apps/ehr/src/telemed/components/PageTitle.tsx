import { Grid } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/system';
import React, { ReactElement, useState } from 'react';
import { IntakeNote } from '../../features/css-module/components/IntakeNotes';

interface PageTitleProps {
  label: string;
  dataTestId?: string;
  showIntakeNotesButton?: boolean;
}

export const CSSPageTitle = styled(Typography)(({ theme }) => ({
  ...(theme?.typography as TypographyOptions).h4,
  textAlign: 'left',
  color: theme.palette.primary.dark,
}));

export const PageTitle = ({ label, dataTestId, showIntakeNotesButton = true }: PageTitleProps): ReactElement => {
  const [open] = useState(true);

  return (
    <Grid container sx={{ alignItems: 'center' }} columns={{ xs: 10 }}>
      <Grid item xs>
        <CSSPageTitle data-testid={dataTestId}>{label}</CSSPageTitle>
      </Grid>
      {showIntakeNotesButton && (
        <Grid item>
          <IntakeNote open={open} />
        </Grid>
      )}
    </Grid>
  );
};
