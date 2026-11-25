import LibraryAddCheckOutlinedIcon from '@mui/icons-material/LibraryAddCheckOutlined';
import { Box, Link, Stack, Typography } from '@mui/material';
import { FC, Fragment } from 'react';
import { TaskLocationCount } from 'src/features/visits/in-person/hooks/useTasks';

interface MyTasksInOtherLocationsHintProps {
  locations: TaskLocationCount[];
  onSelect: (locationId: string) => void;
}

export const MyTasksInOtherLocationsHint: FC<MyTasksInOtherLocationsHintProps> = ({ locations, onSelect }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <Box sx={{ position: 'relative', display: 'inline-flex' }}>
      <LibraryAddCheckOutlinedIcon color="warning" fontSize="small" />
      <Box
        sx={{
          position: 'absolute',
          top: -3,
          right: -3,
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: 'warning.main',
          border: '1px solid',
          borderColor: 'background.paper',
        }}
      />
    </Box>
    <Typography variant="body2">
      <Box component="span" sx={{ fontWeight: 500 }}>
        You have tasks in locations:
      </Box>{' '}
      {locations.map((location, index) => (
        <Fragment key={location.id}>
          {index > 0 && '; '}
          <Link
            component="button"
            variant="body2"
            color="inherit"
            underline="always"
            sx={{ verticalAlign: 'baseline' }}
            onClick={() => onSelect(location.id)}
          >
            {`${location.name} - ${location.count}`}
          </Link>
        </Fragment>
      ))}
    </Typography>
  </Stack>
);
