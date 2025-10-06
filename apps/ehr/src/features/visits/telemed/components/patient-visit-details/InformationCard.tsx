import { Box, Divider, Paper, Typography, useTheme } from '@mui/material';
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
};

export const InformationCard: FC<InformationCardProps> = ({ title, fields }) => {
  const theme = useTheme();

  return (
    <Paper
      sx={{
        marginTop: 2,
        padding: 3,
      }}
    >
      {title && (
        <Typography variant="h4" color={theme.palette.primary.dark} sx={{ mb: 2 }}>
          {title}
        </Typography>
      )}
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          gap: 1,
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '5px', flex: '0 1 50%' }}>
                <Typography sx={{ color: theme.palette.primary.dark }}>{field.label || ''}</Typography>
                {field.icon}
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Typography>{field.value || '-'}</Typography>
                {field.button}
              </Box>
            </Box>
            {fields && index < fields.length - 1 && <Divider orientation="horizontal" flexItem />}
          </Fragment>
        ))}
      </Box>
    </Paper>
  );
};
