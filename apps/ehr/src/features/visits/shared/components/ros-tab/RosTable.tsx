import { alpha, Grid, Paper, Table, TableBody, TableCell, TableHead, TableRow, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { RosCard, RosItemConfig } from 'utils';
import { RosTableRow } from './RosTableRow';

interface RosTableProps {
  config: RosItemConfig;
}

const ROS_FINDING_CELL_STYLE = {
  fontWeight: 600,
  fontSize: 11,
  width: 32,
  py: 0.5,
  px: 0,
  borderBottom: '2px solid #e0e0e0',
};

export const RosTable: FC<RosTableProps> = ({ config }) => {
  const theme = useTheme();

  const renderSystem = ([systemKey, system]: [string, RosCard]): React.ReactNode => (
    <Paper key={systemKey} variant="outlined" sx={{ height: '100%' }}>
      <Table size="small" sx={{ tableLayout: 'fixed' }} data-testid={dataTestIds.reviewOfSystemsPage.rosTable}>
        <TableHead>
          <TableRow
            sx={{
              backgroundColor: alpha(theme.palette.primary.main, 0.05),
            }}
          >
            <TableCell
              sx={{
                fontWeight: 500,
                fontSize: 13,
                py: 0.5,
                borderBottom: '2px solid #e0e0e0',
                color: theme.palette.primary.dark,
              }}
            >
              {system.label}
            </TableCell>
            <TableCell
              align="center"
              sx={{
                ...ROS_FINDING_CELL_STYLE,
                color: 'success.main',
              }}
            >
              D
            </TableCell>
            <TableCell
              align="center"
              sx={{
                ...ROS_FINDING_CELL_STYLE,
                color: 'error.main',
              }}
            >
              R
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.entries(system.items).map(([baseKey, item]) => (
            <RosTableRow key={baseKey} baseKey={baseKey} item={item} />
          ))}
        </TableBody>
      </Table>
    </Paper>
  );

  const systems = Object.entries(config);

  return (
    <Grid container spacing={1} data-testid={dataTestIds.reviewOfSystemsPage.rosTableContainer}>
      {systems.map((system) => (
        <Grid item xs={4} key={system[0]}>
          {renderSystem(system)}
        </Grid>
      ))}
    </Grid>
  );
};
