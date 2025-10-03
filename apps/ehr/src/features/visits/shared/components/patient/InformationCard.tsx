import { Box, Paper, Typography, useTheme } from '@mui/material';
import { FC, Fragment, ReactElement } from 'react';

type Field = {
  label?: string;
  value?: string;
  icon?: ReactElement;
  button?: ReactElement;
};

type InformationCardProps = {
  title?: string;
  fields?: Field[];
  inPaperElement?: ReactElement;
};

export const InformationCard: FC<InformationCardProps> = ({ title, fields, inPaperElement }) => {
  const theme = useTheme();

  return (
    <Paper sx={{ display: 'flex', flexDirection: 'column', p: 3, gap: 2.5, alignItems: 'flex-start' }}>
      {title && (
        <Typography variant="h4" color={theme.palette.primary.dark}>
          {title}
        </Typography>
      )}
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {(fields || []).map((field, index) => (
          <Fragment key={index}>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: '5px',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', flex: '0 1 30%' }}>
                <Typography sx={{ color: theme.palette.primary.dark }}>{field.label || ''}</Typography>
                {field.icon}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 70%' }}>
                <Typography>{field.value || '-'}</Typography>
                {field.button}
              </Box>
            </Box>
          </Fragment>
        ))}
      </Box>
      {inPaperElement}
    </Paper>
  );
};
