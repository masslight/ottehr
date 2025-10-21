import { BarChart as BarChartIcon, TableView as TableViewIcon } from '@mui/icons-material';
import { LoadingButton } from '@mui/lab';
import {
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { DataGridPro, GridColDef, GridRenderCellParams } from '@mui/x-data-grid-pro';
import { DatePicker } from '@mui/x-date-pickers';
import { AdapterLuxon } from '@mui/x-date-pickers/AdapterLuxon';
import { LocalizationProvider } from '@mui/x-date-pickers-pro';
import { BarElement, CategoryScale, Chart as ChartJS, Colors, Legend, LinearScale, Title, Tooltip } from 'chart.js';
import { Task } from 'fhir/r4b';
import { DateTime } from 'luxon';
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { getAllFhirSearchPages, getAllTaskTypes, TaskTypeOption } from 'utils';
import { useApiClients } from '../hooks/useAppClients';
import PageContainer from '../layout/PageContainer';

interface TaskCountByStatus {
  date: DateTime;
  statusCounts: {
    requested: number;
    received: number;
    accepted: number;
    rejected: number;
    ready: number;
    cancelled: number;
    'in-progress': number;
    'on-hold': number;
    failed: number;
    completed: number;
    'entered-in-error': number;
  };
  total: number;
}

interface TaskDetailRow {
  id: string;
  status: string;
  code: string;
  system: string;
  lastUpdated: string;
  authoredOn?: string;
  statusReason?: string;
  focus?: string;
}

enum ViewType {
  Chart = 'chart',
  Table = 'table',
}

enum TimeRange {
  Today = 'Today',
  Yesterday = 'Yesterday',
  ThisWeek = 'This Week',
  ThisMonth = 'This Month',
  LastWeek = 'Last Week',
  LastMonth = 'Last Month',
  PastSeven = 'Past Seven Days',
  PastThirty = 'Past Thirty Days',
  Custom = 'Custom',
}

// Get all available task types dynamically from the system
const taskTypeOptions: TaskTypeOption[] = getAllTaskTypes();

// DataGrid column definitions
const columns: GridColDef[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: 120,
    sortable: true,
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 120,
    sortable: true,
    renderCell: (params: GridRenderCellParams) => (
      <Chip
        label={params.value}
        color={
          params.value === 'completed'
            ? 'success'
            : params.value === 'failed'
            ? 'error'
            : params.value === 'in-progress'
            ? 'info'
            : params.value === 'cancelled'
            ? 'warning'
            : 'default'
        }
        size="small"
      />
    ),
  },
  {
    field: 'code',
    headerName: 'Code',
    width: 150,
    sortable: true,
  },
  {
    field: 'system',
    headerName: 'System',
    width: 200,
    sortable: true,
    renderCell: (params: GridRenderCellParams) => (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.value}</div>
    ),
  },
  {
    field: 'lastUpdated',
    headerName: 'Last Updated',
    width: 160,
    sortable: true,
  },
  {
    field: 'authoredOn',
    headerName: 'Authored On',
    width: 160,
    sortable: true,
    renderCell: (params: GridRenderCellParams) => params.value || 'N/A',
  },
  {
    field: 'statusReason',
    headerName: 'Status Reason',
    width: 150,
    sortable: true,
    renderCell: (params: GridRenderCellParams) => params.value || 'N/A',
  },
  {
    field: 'focus',
    headerName: 'Focus',
    width: 200,
    sortable: true,
    renderCell: (params: GridRenderCellParams) => (
      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{params.value || 'N/A'}</div>
    ),
  },
];

export default function TaskAdmin(): React.ReactElement {
  const [taskCountByDate, setTaskCountByDate] = React.useState<TaskCountByStatus[] | undefined>(undefined);
  const [taskDetails, setTaskDetails] = React.useState<TaskDetailRow[]>([]);
  const [totalTasks, setTotalTasks] = React.useState<number | undefined>(undefined);
  const [selectedTaskType, setSelectedTaskType] = React.useState<string>('sendClaim');
  const [viewType, setViewType] = React.useState<ViewType>(ViewType.Chart);
  const [timeRange, setTimeRange] = React.useState<TimeRange>(TimeRange.Today);
  const [filterStartDate, setStartFilterDate] = React.useState<DateTime | null>(DateTime.now());
  const [filterEndDate, setEndFilterDate] = React.useState<DateTime | null>(DateTime.now());
  const [customFilterStartDate, setCustomStartFilterDate] = React.useState<DateTime | null>(null);
  const [customFilterEndDate, setCustomEndFilterDate] = React.useState<DateTime | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string | null>(null);
  const { oystehr } = useApiClients();

  ChartJS.register(CategoryScale, LinearScale, BarElement, Legend, Title, Tooltip, Colors);

  React.useEffect(() => {
    async function updateTasks(): Promise<void> {
      setLoading(true);
      setError(null);

      if (filterStartDate && filterEndDate && filterEndDate.startOf('day') >= filterStartDate.startOf('day')) {
        if (!oystehr) return;

        try {
          let totalTasks = 0;
          const taskCountByDay: Record<string, TaskCountByStatus['statusCounts']> = {};
          const daysDiff = Math.floor(filterEndDate.startOf('day').diff(filterStartDate.startOf('day')).as('days'));
          let temp = filterStartDate;
          for (let i = 0; i <= daysDiff; i++) {
            const formattedDay = temp.toFormat('y-MM-dd');
            if (formattedDay) {
              taskCountByDay[formattedDay] = {
                requested: 0,
                received: 0,
                accepted: 0,
                rejected: 0,
                ready: 0,
                cancelled: 0,
                'in-progress': 0,
                'on-hold': 0,
                failed: 0,
                completed: 0,
                'entered-in-error': 0,
              };
            }
            temp = temp.plus({ day: 1 });
          }

          // Build search parameters based on selected task type
          const selectedOption = taskTypeOptions.find((option) => option.value === selectedTaskType);
          const searchParams = [
            { name: '_lastUpdated', value: `ge${filterStartDate.startOf('day').toISO()}` },
            { name: '_lastUpdated', value: `le${filterEndDate.endOf('day').toISO()}` },
          ];

          // Add code filter if not 'all'
          if (selectedTaskType !== 'all' && selectedOption) {
            if (selectedOption.system && selectedOption.code) {
              // Specific task with both system and code
              searchParams.push({ name: 'code', value: `${selectedOption.system}|${selectedOption.code}` });
            } else if (selectedOption.system) {
              // System-wide tasks (all tasks for a particular system)
              searchParams.push({ name: 'code', value: `${selectedOption.system}|` });
            } else {
              console.log('Unexpectedly found no system or code on selected option');
            }
          }

          // Fetch all tasks with pagination using the utility function
          const allTasks = await getAllFhirSearchPages<Task>(
            {
              resourceType: 'Task',
              params: searchParams,
            },
            oystehr
          );

          console.log(`Total tasks fetched: ${allTasks.length}`);

          const taskDetailsArray: TaskDetailRow[] = [];

          allTasks.forEach((task) => {
            if (task.meta?.lastUpdated && task.status) {
              const taskDate = DateTime.fromISO(task.meta.lastUpdated).toFormat('y-MM-dd');
              if (taskDate && taskCountByDay[taskDate]) {
                totalTasks++;
                const status = task.status as keyof TaskCountByStatus['statusCounts'];
                if (taskCountByDay[taskDate][status] !== undefined) {
                  taskCountByDay[taskDate][status]++;
                }
              }

              // Create task detail row
              const taskDetail: TaskDetailRow = {
                id: task.id || 'Unknown',
                status: task.status,
                code: task.code?.coding?.[0]?.code || 'Unknown',
                system: task.code?.coding?.[0]?.system || 'Unknown',
                lastUpdated: DateTime.fromISO(task.meta.lastUpdated).toLocaleString(DateTime.DATETIME_SHORT),
                authoredOn: task.authoredOn
                  ? DateTime.fromISO(task.authoredOn).toLocaleString(DateTime.DATETIME_SHORT)
                  : undefined,
                statusReason: task.statusReason?.text || task.statusReason?.coding?.[0]?.display,
                focus: task.focus?.reference,
              };
              taskDetailsArray.push(taskDetail);
            }
          });

          setTaskDetails(taskDetailsArray);

          const taskCountByDateTemp = Object.keys(taskCountByDay).map((day) => {
            const statusCounts = taskCountByDay[day];
            const total = Object.values(statusCounts).reduce((sum, count) => sum + count, 0);
            return {
              date: DateTime.fromISO(day),
              statusCounts,
              total,
            };
          });

          setTotalTasks(totalTasks);
          setTaskCountByDate(taskCountByDateTemp);
          setLoading(false);

          if (allTasks.length === 0) {
            const taskTypeLabel = taskTypeOptions.find((option) => option.value === selectedTaskType)?.label || 'tasks';
            setError(`No ${taskTypeLabel.toLowerCase()} found for this time range`);
          }
        } catch (error) {
          console.error('Error fetching tasks:', error);
          setError('Error fetching task data');
          setLoading(false);
        }
      } else {
        setLoading(false);
        if (filterStartDate && filterEndDate && filterStartDate.startOf('day') > filterEndDate.startOf('day')) {
          setError('Please make sure start date is before end date');
        } else {
          setError('Please make sure there is a start and end date for the filter');
        }
      }
    }

    updateTasks().catch((error) => console.log('error getting task update', error));
  }, [oystehr, filterStartDate, filterEndDate, selectedTaskType]);

  const handleCustomTimeRange = (): void => {
    if (customFilterEndDate && customFilterStartDate) {
      setStartFilterDate(customFilterStartDate);
      setEndFilterDate(customFilterEndDate);
    }
  };

  const setFilterDates = (range: TimeRange): void => {
    let startDate, endDate;
    const now = DateTime.now();
    switch (range) {
      case TimeRange.Today:
        startDate = now.startOf('day');
        endDate = now.endOf('day');
        break;
      case TimeRange.Yesterday:
        startDate = now.minus({ days: 1 }).startOf('day');
        endDate = now.minus({ days: 1 }).endOf('day');
        break;
      case TimeRange.ThisWeek:
        startDate = now.startOf('week');
        endDate = now.endOf('week');
        break;
      case TimeRange.LastWeek:
        startDate = now.minus({ weeks: 1 }).startOf('week');
        endDate = now.minus({ weeks: 1 }).endOf('week');
        break;
      case TimeRange.ThisMonth:
        startDate = now.startOf('month');
        endDate = now.endOf('month');
        break;
      case TimeRange.LastMonth:
        startDate = now.minus({ months: 1 }).startOf('month');
        endDate = now.minus({ months: 1 }).endOf('month');
        break;
      case TimeRange.PastSeven:
        startDate = now.minus({ days: 6 }).startOf('day');
        endDate = now.endOf('day');
        break;
      case TimeRange.PastThirty:
        startDate = now.minus({ days: 29 }).startOf('day');
        endDate = now.endOf('day');
        break;
      default:
        return;
    }
    setStartFilterDate(startDate);
    setEndFilterDate(endDate);
  };

  React.useEffect(() => {
    if (timeRange !== TimeRange.Custom) {
      setFilterDates(timeRange);
    }
  }, [timeRange]);

  return (
    <PageContainer>
      <Grid container spacing={6}>
        <Grid item xs={12}>
          <Typography variant="h4" gutterBottom>
            Task Observability Dashboard
          </Typography>
          <Typography variant="subtitle1" color="textSecondary" gutterBottom>
            Monitor FHIR Task resources by type and status
          </Typography>
        </Grid>

        {/* Controls */}
        <Grid item xs={12}>
          <Grid container spacing={2} alignItems="center">
            <Grid item md={3} xs={12}>
              <FormControl fullWidth>
                <InputLabel>Task Type</InputLabel>
                <Select
                  value={selectedTaskType}
                  onChange={(event) => setSelectedTaskType(event.target.value as string)}
                  label="Task Type"
                >
                  {taskTypeOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item md={3} xs={12}>
              <FormControl fullWidth>
                <InputLabel>Time Range</InputLabel>
                <Select
                  value={timeRange}
                  onChange={(event) => setTimeRange(event.target.value as TimeRange)}
                  label="Time Range"
                >
                  {Object.values(TimeRange).map((range) => (
                    <MenuItem key={range} value={range}>
                      {range}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            {timeRange === TimeRange.Custom && (
              <>
                <Grid item md={2.5} xs={6}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="Start Date"
                      value={customFilterStartDate}
                      onChange={(newValue) => setCustomStartFilterDate(newValue)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item md={2.5} xs={6}>
                  <LocalizationProvider dateAdapter={AdapterLuxon}>
                    <DatePicker
                      label="End Date"
                      value={customFilterEndDate}
                      onChange={(newValue) => setCustomEndFilterDate(newValue)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </LocalizationProvider>
                </Grid>
                <Grid item md={1.5} xs={12}>
                  <LoadingButton
                    sx={{
                      borderRadius: 100,
                      textTransform: 'none',
                      fontWeight: 600,
                      width: '100%',
                    }}
                    color="primary"
                    variant="contained"
                    loading={loading}
                    onClick={handleCustomTimeRange}
                  >
                    Apply Range
                  </LoadingButton>
                </Grid>
              </>
            )}
          </Grid>
        </Grid>

        {/* Summary Statistics */}
        {totalTasks !== undefined && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Summary
              </Typography>
              <Typography variant="body1">
                Total {taskTypeOptions.find((option) => option.value === selectedTaskType)?.label || 'Tasks'}:{' '}
                <strong>{totalTasks}</strong>
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Time Range: {filterStartDate?.toLocaleString(DateTime.DATE_SHORT)} -{' '}
                {filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}
              </Typography>
            </Paper>
          </Grid>
        )}

        {/* View Toggle */}
        {!loading && !error && (
          <Grid item xs={12} sx={{ textAlign: 'center' }}>
            <ToggleButtonGroup
              value={viewType}
              exclusive
              onChange={(_, newView) => newView && setViewType(newView)}
              aria-label="view type"
            >
              <ToggleButton value={ViewType.Chart} aria-label="chart view">
                <BarChartIcon sx={{ mr: 1 }} />
                Chart View
              </ToggleButton>
              <ToggleButton value={ViewType.Table} aria-label="table view">
                <TableViewIcon sx={{ mr: 1 }} />
                Table View
              </ToggleButton>
            </ToggleButtonGroup>
          </Grid>
        )}

        {/* Loading State */}
        {loading && (
          <Grid item xs={12} sx={{ textAlign: 'center' }}>
            <CircularProgress />
          </Grid>
        )}

        {/* Error State */}
        {error && (
          <Grid item xs={12} sx={{ textAlign: 'center' }}>
            <Typography color="error" variant="h6">
              {error}
            </Typography>
          </Grid>
        )}

        {/* Chart */}
        {!loading && !error && taskCountByDate && viewType === ViewType.Chart && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, maxHeight: 600 }}>
              <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                💡 Tip: Single-click legend items to toggle, double-click to show only that status
              </Typography>
              <Bar
                aria-label={`Send-Messages Tasks by Date ${filterStartDate?.toLocaleString(
                  DateTime.DATE_SHORT
                )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)}`}
                role="img"
                data={{
                  labels: taskCountByDate.map((taskCount) => taskCount.date.toLocaleString(DateTime.DATE_SHORT)),
                  datasets: [
                    {
                      label: 'Requested',
                      data: taskCountByDate.map((taskCount) => taskCount.statusCounts.requested),
                      backgroundColor: 'rgba(255, 206, 86, 0.8)',
                      borderColor: 'rgba(255, 206, 86, 1)',
                      borderWidth: 1,
                    },
                    {
                      label: 'In Progress',
                      data: taskCountByDate.map((taskCount) => taskCount.statusCounts['in-progress']),
                      backgroundColor: 'rgba(54, 162, 235, 0.8)',
                      borderColor: 'rgba(54, 162, 235, 1)',
                      borderWidth: 1,
                    },
                    {
                      label: 'Completed',
                      data: taskCountByDate.map((taskCount) => taskCount.statusCounts.completed),
                      backgroundColor: 'rgba(75, 192, 192, 0.8)',
                      borderColor: 'rgba(75, 192, 192, 1)',
                      borderWidth: 1,
                    },
                    {
                      label: 'Failed',
                      data: taskCountByDate.map((taskCount) => taskCount.statusCounts.failed),
                      backgroundColor: 'rgba(255, 99, 132, 0.8)',
                      borderColor: 'rgba(255, 99, 132, 1)',
                      borderWidth: 1,
                    },
                    {
                      label: 'Cancelled',
                      data: taskCountByDate.map((taskCount) => taskCount.statusCounts.cancelled),
                      backgroundColor: 'rgba(153, 102, 255, 0.8)',
                      borderColor: 'rgba(153, 102, 255, 1)',
                      borderWidth: 1,
                    },
                    {
                      label: 'Ready',
                      data: taskCountByDate.map((taskCount) => taskCount.statusCounts.ready),
                      backgroundColor: 'rgba(255, 159, 64, 0.8)',
                      borderColor: 'rgba(255, 159, 64, 1)',
                      borderWidth: 1,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  plugins: {
                    title: {
                      display: true,
                      text: `${
                        taskTypeOptions.find((option) => option.value === selectedTaskType)?.label || 'Tasks'
                      } by Status and Date (${filterStartDate?.toLocaleString(
                        DateTime.DATE_SHORT
                      )} - ${filterEndDate?.toLocaleString(DateTime.DATE_SHORT)})`,
                      font: {
                        size: 16,
                      },
                    },
                    legend: {
                      display: true,
                      position: 'top' as const,
                      onClick: (event, legendItem, legend) => {
                        const chart = legend.chart;
                        const datasetIndex = legendItem.datasetIndex!;
                        const meta = chart.getDatasetMeta(datasetIndex);

                        // Check if this is a double-click by tracking timing
                        const now = Date.now();
                        const lastClickTime = (chart as any).lastLegendClickTime || 0;
                        const isDoubleClick = now - lastClickTime < 300;
                        (chart as any).lastLegendClickTime = now;

                        if (isDoubleClick) {
                          // Double-click: Show only this dataset or show all if already isolated
                          const allMeta = chart.data.datasets.map((_, i) => chart.getDatasetMeta(i));
                          const visibleCount = allMeta.filter((m) => !m.hidden).length;

                          if (visibleCount === 1 && !meta.hidden) {
                            // Currently showing only this dataset, show all
                            allMeta.forEach((m) => {
                              m.hidden = false;
                            });
                          } else {
                            // Hide all others, show only this one
                            allMeta.forEach((m, i) => {
                              m.hidden = i !== datasetIndex;
                            });
                          }
                        } else {
                          // Single-click: Toggle this dataset (default behavior)
                          meta.hidden = meta.hidden ? false : !meta.hidden;
                        }

                        chart.update();
                      },
                    },
                    tooltip: {
                      mode: 'index' as const,
                      intersect: false,
                    },
                  },
                  scales: {
                    x: {
                      stacked: true,
                      title: {
                        display: true,
                        text: 'Date',
                      },
                    },
                    y: {
                      stacked: true,
                      beginAtZero: true,
                      ticks: {
                        stepSize: 1,
                      },
                      title: {
                        display: true,
                        text: 'Number of Tasks',
                      },
                    },
                  },
                  interaction: {
                    mode: 'index' as const,
                    intersect: false,
                  },
                }}
              />
            </Paper>
          </Grid>
        )}

        {/* DataGrid Table */}
        {!loading && !error && taskDetails.length > 0 && viewType === ViewType.Table && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, height: 600 }}>
              <Typography variant="h6" gutterBottom>
                Task Details
              </Typography>
              <DataGridPro
                rows={taskDetails}
                columns={columns}
                getRowId={(row) => row.id}
                initialState={{
                  pagination: {
                    paginationModel: { pageSize: 25 },
                  },
                  sorting: {
                    sortModel: [{ field: 'lastUpdated', sort: 'desc' }],
                  },
                }}
                pageSizeOptions={[10, 25, 50, 100]}
                disableRowSelectionOnClick
                sx={{
                  '& .MuiDataGrid-cell': {
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  },
                }}
              />
            </Paper>
          </Grid>
        )}
      </Grid>
    </PageContainer>
  );
}
