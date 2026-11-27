import { Box, Stack, Tab, Tabs, Typography } from '@mui/material';
import { ReactElement, useMemo, useState } from 'react';
import { Loader } from 'src/features/visits/shared/components/Loader';
import { useGetFlowsheet } from 'src/hooks/useGetFlowsheet';
import { FlowsheetId, FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { VitalsHeaderUnitSystem } from 'utils/lib/types/api/progress-note-config/progress-note-config.types';
import { toColumns } from '../format';
import { FlowsheetDefinition, FLOWSHEETS } from '../registry';
import { FlowsheetHighlight, FlowsheetTable } from './FlowsheetTable';
import { FlowsheetTrendCharts } from './FlowsheetTrendCharts';
import { FlowsheetVisitsCard } from './FlowsheetVisitsCard';

interface FlowsheetsProps {
  patientId: string;
  currentEncounterId?: string;
  unitSystem: VitalsHeaderUnitSystem;
}

interface FlowsheetBodyProps {
  definition: FlowsheetDefinition;
  visits: FlowsheetVisit[];
  currentEncounterId?: string;
  unitSystem: VitalsHeaderUnitSystem;
}

const FlowsheetBody = ({ definition, visits, currentEncounterId, unitSystem }: FlowsheetBodyProps): ReactElement => {
  const columns = useMemo(() => toColumns(visits, currentEncounterId), [visits, currentEncounterId]);
  const [highlight, setHighlight] = useState<FlowsheetHighlight | null>(null);
  return (
    <>
      <FlowsheetTable rows={definition.rows} columns={columns} unitSystem={unitSystem} highlight={highlight} />
      <FlowsheetTrendCharts
        charts={definition.charts}
        visits={visits}
        unitSystem={unitSystem}
        onHoverPoint={setHighlight}
      />
      <FlowsheetVisitsCard columns={columns} />
    </>
  );
};

export const Flowsheets = ({ patientId, currentEncounterId, unitSystem }: FlowsheetsProps): ReactElement => {
  const [selectedId, setSelectedId] = useState<FlowsheetId>(FLOWSHEETS[0].id);
  const selected = FLOWSHEETS.find((flowsheet) => flowsheet.id === selectedId) ?? FLOWSHEETS[0];
  const { data, isPending, error } = useGetFlowsheet({ patientId, flowsheetId: selected.id, currentEncounterId });

  return (
    <Stack spacing={2}>
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs
          value={selected.id}
          onChange={(_, id: FlowsheetId) => setSelectedId(id)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {FLOWSHEETS.map((flowsheet) => (
            <Tab
              key={flowsheet.id}
              value={flowsheet.id}
              label={
                <Typography sx={{ textTransform: 'none', fontWeight: 500, fontSize: '14px' }}>
                  {flowsheet.title}
                </Typography>
              }
            />
          ))}
        </Tabs>
      </Box>
      {isPending ? (
        <Loader height="300px" />
      ) : error || !data ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body1">Could not load the flowsheet. Please try again.</Typography>
        </Box>
      ) : (
        <FlowsheetBody
          definition={selected}
          visits={data.visits}
          currentEncounterId={currentEncounterId}
          unitSystem={unitSystem}
        />
      )}
    </Stack>
  );
};
