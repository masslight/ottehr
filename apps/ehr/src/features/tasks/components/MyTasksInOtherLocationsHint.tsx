import AssignmentIndOutlinedIcon from '@mui/icons-material/AssignmentIndOutlined';
import { Link, Stack, Typography } from '@mui/material';
import { FC, Fragment } from 'react';
import { TaskLocationCount } from 'src/features/visits/in-person/hooks/useTasks';

interface MyTasksInOtherLocationsHintProps {
  locations: TaskLocationCount[];
  onSelect: (locationId: string) => void;
}

export const MyTasksInOtherLocationsHint: FC<MyTasksInOtherLocationsHintProps> = ({ locations, onSelect }) => (
  <Stack direction="row" alignItems="center" spacing={1}>
    <AssignmentIndOutlinedIcon color="warning" fontSize="small" />
    <Typography variant="body2">
      You have tasks in locations:{' '}
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
