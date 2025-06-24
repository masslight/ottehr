import AddIcon from '@mui/icons-material/Add';
import { Box, Chip, Paper, Stack, Typography } from '@mui/material';
import { DataGridPro, GridColDef, GridRowParams } from '@mui/x-data-grid-pro';
import { Oystehr } from '@oystehr/sdk/dist/cjs/resources/classes';
import { Encounter, Patient } from 'fhir/r4b';
import { FC, ReactElement, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { FOLLOWUP_SYSTEMS } from 'utils';
import { formatISOStringToDateAndTime } from '../../helpers/formatDateTime';
import { useApiClients } from '../../hooks/useAppClients';
import { RoundedButton } from '../RoundedButton';

type PatientEncountersGridProps = {
  patient?: Patient;
  loading: boolean;
};

interface ColorScheme {
  bg: string;
  text: string;
}

type StatusType = 'OPEN' | 'RESOLVED';

const statusColors: Record<StatusType, ColorScheme> = {
  OPEN: { bg: '#b3e5fc', text: '#01579B' },
  RESOLVED: { bg: '#c8e6c9', text: '#1b5e20' },
};

const StatusChip = styled(Chip)(() => ({
  borderRadius: '8px',
  padding: '0 9px',
  margin: 0,
  height: '24px',
  '& .MuiChip-label': {
    padding: 0,
    fontWeight: 'bold',
    fontSize: '0.7rem',
  },
  '& .MuiChip-icon': {
    marginLeft: 'auto',
    marginRight: '-4px',
    order: 1,
  },
}));

export const getFollowupStatusChip = (status: 'OPEN' | 'RESOLVED'): ReactElement => {
  const statusVal =
    status === 'OPEN'
      ? { statusText: 'OPEN', statusColors: statusColors.OPEN }
      : { statusText: 'RESOLVED', statusColors: statusColors.RESOLVED };
  return (
    <StatusChip
      label={statusVal.statusText}
      sx={{
        backgroundColor: statusVal.statusColors.bg,
        color: statusVal.statusColors.text,
        '& .MuiSvgIcon-root': {
          color: 'inherit',
          fontSize: '1.2rem',
          margin: '0 -4px 0 2px',
        },
      }}
    />
  );
};

const columns: GridColDef<Encounter>[] = [
  {
    sortable: false,
    field: 'dateTime',
    headerName: 'Date & Time',
    flex: 1,
    valueGetter: ({ row: { period } }) => period?.start || null,
    renderCell: ({ value }) => {
      if (!value) return '-';
      return formatISOStringToDateAndTime(value);
    },
  },
  {
    sortable: false,
    field: 'type',
    headerName: 'Type',
    flex: 1,
    renderCell: ({ row: { type } }) => {
      const typeCoding = type?.find(
        (t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.type.url && c.code === FOLLOWUP_SYSTEMS.type.code)
      );
      let typeText = '-';
      if (typeCoding?.text) {
        typeText = typeCoding?.text;
      }
      return <Typography variant="body2">{typeText}</Typography>;
    },
  },
  {
    sortable: false,
    field: 'reason',
    headerName: 'Reason',
    flex: 1,
    renderCell: ({ row: { reasonCode } }) => {
      if (!reasonCode) {
        return;
      }
      // const reasonDisplay = encounter.reasonCode ? encounter.reasonCode[0].text : '-';
      return <Typography variant="body2">{reasonCode[0].text}</Typography>;
    },
  },
  {
    sortable: false,
    field: 'answered',
    headerName: 'Answered',
    flex: 1,
    renderCell: ({ row: { participant } }) => {
      const answered = participant?.find(
        (p) => p.type?.find((t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.answeredUrl))
      )?.type?.[0].coding?.[0].display;
      const answeredText = answered ? answered : '-';
      return <Typography variant="body2">{answeredText}</Typography>;
    },
  },
  {
    sortable: false,
    field: 'caller',
    headerName: 'Caller',
    flex: 1,
    renderCell: ({ row: { participant } }) => {
      const caller = participant?.find(
        (p) => p.type?.find((t) => t.coding?.find((c) => c.system === FOLLOWUP_SYSTEMS.callerUrl))
      )?.type?.[0].coding?.[0].display;
      const callerText = caller ? caller : '-';
      return <Typography variant="body2">{callerText}</Typography>;
    },
  },
  {
    sortable: false,
    field: 'status',
    headerName: 'Status',
    flex: 0.5,
    renderCell: ({ row: { status } }) => {
      if (!status) {
        return;
      }
      const statusVal = status === 'in-progress' ? 'OPEN' : 'RESOLVED';
      return getFollowupStatusChip(statusVal);
    },
  },
];

export const PatientFollowupEncountersGrid: FC<PatientEncountersGridProps> = (props) => {
  const { patient, loading } = props;
  const { oystehr } = useApiClients();
  const [followupEncounters, setFollowupEncounters] = useState<Encounter[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    async function getPatientFollowup(oystehr: Oystehr): Promise<void> {
      try {
        const fhirEncounters = (
          await oystehr.fhir.search<Encounter>({
            resourceType: 'Encounter',
            params: [
              {
                name: '_sort',
                value: '-date',
              },
              {
                name: 'subject',
                value: `Patient/${patient?.id}`,
              },
              {
                name: 'type',
                value: FOLLOWUP_SYSTEMS.type.code,
              },
            ],
          })
        ).unbundle();
        setFollowupEncounters(fhirEncounters);
      } catch (e) {
        console.error('error loading encounters', e);
      }
    }

    if (oystehr) {
      void getPatientFollowup(oystehr);
    }
  }, [oystehr, patient]);

  const handleRowClick = (params: GridRowParams): void => {
    navigate(`followup/${params.id}`);
  };

  return (
    <Paper sx={{ padding: 3 }} component={Stack} spacing={2}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h4" color="primary.dark" sx={{ flexGrow: 1 }}>
          Patient Follow-up
        </Typography>
        <RoundedButton
          onClick={() => navigate('followup/add')}
          variant="contained"
          startIcon={<AddIcon fontSize="small" />}
        >
          New Follow-up
        </RoundedButton>
      </Box>

      <DataGridPro
        rows={followupEncounters}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 5,
            },
          },
          sorting: {
            sortModel: [{ field: 'dateTime', sort: 'desc' }],
          },
        }}
        autoHeight
        loading={loading}
        pagination
        disableColumnMenu
        pageSizeOptions={[5]}
        disableRowSelectionOnClick
        sx={{
          border: 0,
          '.MuiDataGrid-columnHeaderTitle': {
            fontWeight: 500,
          },
          cursor: 'pointer',
        }}
        onRowClick={handleRowClick}
      />
    </Paper>
  );
};
