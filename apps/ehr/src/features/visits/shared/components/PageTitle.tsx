import { Grid } from '@mui/material';
import { TypographyOptions } from '@mui/material/styles/createTypography';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/system';
import { ReactElement, ReactNode, useState } from 'react';
import { IntakeNote } from 'src/features/visits/in-person/components/IntakeNotes';

interface PageTitleProps {
  label: string;
  dataTestId?: string;
  showIntakeNotesButton?: boolean;
  /** Rendered right-aligned on the same line as the title, e.g. a "Clear Exam" action. */
  actions?: ReactNode;
}

export const PageTitleStyled = styled(Typography)(({ theme }) => ({
  ...(theme?.typography as TypographyOptions).h4,
  textAlign: 'left',
  color: theme.palette.primary.dark,
}));

export const PageTitle = ({
  label,
  dataTestId,
  showIntakeNotesButton = true,
  actions,
}: PageTitleProps): ReactElement => {
  const [open] = useState(true);

  return (
    <Grid container sx={{ alignItems: 'center' }} columns={{ xs: 10 }}>
      <Grid item xs>
        <PageTitleStyled data-testid={dataTestId}>{label}</PageTitleStyled>
      </Grid>
      {actions && <Grid item>{actions}</Grid>}
      {showIntakeNotesButton && (
        <Grid item>
          <IntakeNote open={open} />
        </Grid>
      )}
    </Grid>
  );
};
