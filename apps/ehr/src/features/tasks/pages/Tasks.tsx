import { otherColors } from '@ehrTheme/colors';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonAddIcon from '@mui/icons-material/PersonAddOutlined';
import PriorityHighOutlinedIcon from '@mui/icons-material/PriorityHighOutlined';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import {
  Box,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Popover,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Stack } from '@mui/system';
import { DateTime } from 'luxon';
import React, { ReactElement, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { GenericToolTip } from 'src/components/GenericToolTip';
import LocationSelect from 'src/components/LocationSelect';
import { RoundedButton } from 'src/components/RoundedButton';
import { StatusChip } from 'src/components/StatusChip';
import { Task, useGetTasks } from 'src/features/visits/in-person/hooks/useTasks';
import useEvolveUser from 'src/hooks/useEvolveUser';
import PageContainer from 'src/layout/PageContainer';
import { LocationWithWalkinSchedule } from 'src/pages/AddPatient';

const UNKNOWN = 'Unknown';
const COMPLETED = 'completed';
const TASK_CATEGORY_LABEL: Record<string, string> = {
  'external-labs': 'External Labs',
  'in-house-labs': 'In-house Labs',
};
const TASK_STATUS_LABEL: Record<string, string> = {
  requested: 'pending',
  'in-progress': 'in progress',
  completed: 'completed',
};

export const Tasks: React.FC = () => {
  const [locationSelected, setLocationSelected] = useState<LocationWithWalkinSchedule | undefined>(undefined);
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);
  const { data: tasks } = useGetTasks();
  const currentUser = useEvolveUser();
  const currentUserProviderId = currentUser?.profile?.split('/')[1];
  const renderActionButton = (task: Task): ReactElement | null => {
    if (task.status === COMPLETED) {
      return null;
    }
    if (!task.assignee) {
      return (
        <RoundedButton variant="outlined" onClick={() => console.log('Assign Me')}>
          Assign Me
        </RoundedButton>
      );
    }
    if (task.action) {
      return (
        <RoundedButton
          variant="contained"
          onClick={() => navigate(task.action?.link ?? '#')}
          disabled={currentUserProviderId !== task.assignee?.id}
        >
          {task.action.name}
        </RoundedButton>
      );
    }
    return null;
  };
  const renderMoreButton = (task: Task): ReactElement | null => {
    if (task.status === COMPLETED) {
      return null;
    }
    return (
      <IconButton color="primary" onClick={(e) => setMoreActionsPopoverData({ element: e.currentTarget, task })}>
        <MoreVertIcon fontSize="medium" />
      </IconButton>
    );
  };
  const [moreActionsPopoverData, setMoreActionsPopoverData] = useState<{
    element: HTMLButtonElement;
    task: Task;
  } | null>(null);
  const closeMoreActionsPopover = (): void => {
    setMoreActionsPopoverData(null);
  };
  return (
    <PageContainer>
      <Stack>
        <Stack direction="row">
          <LocationSelect
            queryParams={queryParams}
            //handleSubmit={handleSubmit}
            location={locationSelected}
            updateURL={true}
            storeLocationInLocalStorage={true}
            setLocation={setLocationSelected}
          />
        </Stack>
        <Table sx={{ width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell style={{ width: '150px' }}>
                <Typography>Category and Date</Typography>
              </TableCell>
              <TableCell>
                <Typography>Task</Typography>
              </TableCell>
              <TableCell style={{ width: '200px' }}>
                <Typography>Assigned To</Typography>
              </TableCell>
              <TableCell style={{ width: '200px' }}>
                <Typography>Status</Typography>
              </TableCell>
              <TableCell style={{ width: '200px' }}>
                <Typography>Action</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {(tasks ?? []).map((task) => {
              return (
                <TableRow>
                  <TableCell>
                    <Box
                      style={{
                        background: '#2169F51F',
                        borderRadius: '16px',
                        height: '24px',
                        padding: '0 12px 0 12px',
                      }}
                      display="inline-flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Typography variant="body2" display="inline" style={{ color: '#2169F5', fontSize: '13px' }}>
                        {TASK_CATEGORY_LABEL[task.category] ?? UNKNOWN}
                      </Typography>
                    </Box>
                    <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
                      {formatDate(task.createdDate)}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Typography
                        variant="body1"
                        display="inline"
                        style={{
                          color: '#000000DE',
                          fontWeight: 500,
                          textDecoration: task.status === COMPLETED ? 'line-through' : 'none',
                        }}
                      >
                        {task.title}
                      </Typography>
                      {task.alert ? (
                        <GenericToolTip title={task.alert} placement="top">
                          <PriorityHighOutlinedIcon
                            style={{
                              width: '15px',
                              height: '15px',
                              color: '#FFF',
                              background: otherColors.priorityHighIcon,
                              borderRadius: '4px',
                              padding: '1px 2px',
                              marginLeft: '5px',
                            }}
                          />
                        </GenericToolTip>
                      ) : null}
                    </Box>
                    <Typography variant="body2" display="inline" style={{ color: '#00000099' }}>
                      {task.subtitle}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    {task.assignee ? (
                      <>
                        <Typography variant="body2">{task.assignee.name}</Typography>
                        <Typography variant="body2" display="inline" style={{ color: '#00000099', display: 'block' }}>
                          {formatDate(task.assignee.date)}
                        </Typography>
                      </>
                    ) : (
                      'Not Assigned'
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusChip
                      status={TASK_STATUS_LABEL[task.status] ?? UNKNOWN}
                      style={task.status === COMPLETED ? 'green' : task.status === 'in-progress' ? 'orange' : 'purple'}
                    />
                  </TableCell>
                  <TableCell>
                    {task.status !== COMPLETED ? (
                      <Stack direction="row" justifyContent="space-between">
                        {renderActionButton(task)}
                        {renderMoreButton(task)}
                      </Stack>
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        <Popover
          open={Boolean(moreActionsPopoverData)}
          anchorEl={moreActionsPopoverData?.element}
          onClose={closeMoreActionsPopover}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'left',
          }}
        >
          <List>
            {currentUserProviderId === moreActionsPopoverData?.task?.assignee?.id ? (
              <ListItem disablePadding>
                <ListItemButton
                  onClick={() => {
                    console.log('Unassign me');
                    closeMoreActionsPopover();
                  }}
                >
                  <ListItemIcon>
                    <ShortcutIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                  </ListItemIcon>
                  <ListItemText primary="Unassign me" />
                </ListItemButton>
              </ListItem>
            ) : null}
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => {
                  console.log('Assign to someone else');
                  closeMoreActionsPopover();
                }}
              >
                <ListItemIcon>
                  <PersonAddIcon color="primary" style={{ transform: 'scaleX(-1)' }} />
                </ListItemIcon>
                <ListItemText primary="Assign to someone else" />
              </ListItemButton>
            </ListItem>
          </List>
        </Popover>
      </Stack>
    </PageContainer>
  );
};

function formatDate(dateIso: string): string {
  return DateTime.fromISO(dateIso).toFormat('MM/dd/yyyy h:mm a');
}
