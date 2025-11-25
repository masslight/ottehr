import CloseIcon from '@mui/icons-material/Close';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { DialogTitle, Paper, Stack } from '@mui/material';
import { Dialog, DialogContent, IconButton, Typography } from '@mui/material';
import { Box } from '@mui/system';
import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { ReactElement, useCallback, useState } from 'react';
import { useQuery } from 'react-query';
import { useParams } from 'react-router-dom';
import { getSummary } from 'src/api/api';
import { useApiClients } from 'src/hooks/useAppClients';
import { SummaryColumns } from 'utils';

export const PatientSummaryTable = (): ReactElement => {
  const [summaries, setSummaries] = useState<SummaryColumns[]>([]);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 5 });
  const [totalCount, setTotalCount] = useState(0);
  const { oystehrZambda } = useApiClients();
  const { id: patientId } = useParams<{ id: string }>();
  const [openNotes, setOpenNotes] = useState(false);
  const [noteText, setNoteText] = useState('');

  dayjs.extend(duration);

  const formatDateTime = (dateStr: string): string => {
    return dateStr ? dayjs(dateStr).format('DD MMM YYYY, hh:mm A') : '-';
  };

  const formatDuration = (start: string, end: string): any => {
    if (!start || !end) return '00:00:00';
    const diff = dayjs(end).diff(dayjs(start), 'second');
    const dur = dayjs.duration(diff, 'seconds');
    return [dur.hours(), dur.minutes(), dur.seconds()].map((v) => String(v).padStart(2, '0')).join(':');
  };

  const payload = {
    offset: paginationModel.page * paginationModel.pageSize,
    count: paginationModel.pageSize,
    patientId: patientId ? `Patient/${patientId}` : undefined,
  };

  const { isFetching } = useQuery(
    ['get-summary', paginationModel, { oystehrZambda }],
    () => (oystehrZambda ? getSummary(payload, oystehrZambda) : null),
    {
      onSuccess: (response: any) => {
        if (response?.summaries) {
          const summaries = response?.summaries.map((summmary: any) => {
            const start = summmary?.participant?.[0]?.period.start;
            const end = summmary?.participant?.[0]?.period.end;

            const notes = summmary?.identifier?.find((i: any) => i.system === 'notes')?.value || '-';
            const serviceType = summmary?.identifier?.find((i: any) => i.system === 'service-type')?.value || '-';
            const name = summmary?.practitionerName || '-';
            const rawInteractive = summmary?.identifier?.find((i: any) => i.system === 'interactive-communication')
              ?.value;

            const interactive =
              rawInteractive === 'true' || rawInteractive === true
                ? 'Yes'
                : rawInteractive === 'false' || rawInteractive === false
                ? 'No'
                : '-';

            return {
              id: summmary.id,
              practitonerName: name,
              startTime: formatDateTime(start),
              endTime: formatDateTime(end),
              totalTime: formatDuration(start, end),
              interactiveCommunication: interactive,
              serviceType,
              notes,
            };
          });
          setSummaries(summaries);
          setTotalCount(response?.total || 0);
        }
      },
      enabled: !!oystehrZambda && !!patientId,
    }
  );

  const handlePaginationModelChange = useCallback((newPaginationModel: GridPaginationModel) => {
    setPaginationModel(newPaginationModel);
  }, []);

  const columns: GridColDef<SummaryColumns>[] = [
    {
      field: 'practitonerName',
      headerName: 'Practitioner Name',
      width: 300,
      sortable: false,
    },
    {
      field: 'startTime',
      headerName: 'Start Time',
      width: 250,
      sortable: false,
    },
    {
      field: 'endTime',
      headerName: 'End Time',
      width: 200,
      sortable: false,
    },
    {
      field: 'totalTime',
      headerName: 'Total Time',
      width: 200,
      sortable: false,
    },
    {
      field: 'interactiveCommunication',
      headerName: 'Interactive Communication',
      width: 150,
      sortable: false,
    },
    {
      field: 'serviceType',
      headerName: 'Service Type',
      width: 200,
      sortable: false,
    },
    {
      field: 'notes',
      headerName: 'Notes',
      width: 70,
      sortable: false,
      renderCell: (params) => (
        <IconButton
          onClick={() => {
            setNoteText(params.row.notes);
            setOpenNotes(true);
          }}
        >
          <VisibilityIcon fontSize="small" sx={{ color: 'primary.main' }} />
        </IconButton>
      ),
    },
  ];

  return (
    <>
      <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
        <DataGrid
          rows={summaries}
          columns={columns}
          paginationModel={paginationModel}
          onPaginationModelChange={handlePaginationModelChange}
          rowCount={totalCount}
          paginationMode="server"
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 5,
              },
            },
          }}
          autoHeight
          loading={isFetching}
          pagination
          disableColumnMenu
          pageSizeOptions={[5]}
          disableRowSelectionOnClick
          sx={{
            width: '100%',
            border: 0,
            overflowX: 'auto',
            '.MuiDataGrid-columnHeaderTitle': {
              fontWeight: 500,
              whiteSpace: 'normal',
              lineHeight: 1.2,
            },
            '.MuiDataGrid-cell': {
              whiteSpace: 'normal',
              lineHeight: 1.4,
            },
          }}
        />
      </Paper>
      <Dialog open={openNotes} onClose={() => setOpenNotes(false)} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderColor: 'divider',
            pb: 2,
            '& .MuiDialog-paper': {
              borderRadius: 4,
            },
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
              Notes
            </Typography>
          </Box>
          <IconButton onClick={() => setOpenNotes(false)} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{noteText || 'No notes available.'}</Typography>
        </DialogContent>
      </Dialog>
    </>
  );
};
