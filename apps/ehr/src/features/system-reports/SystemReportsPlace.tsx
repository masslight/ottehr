// A spot in the EHR that shows the system reports declaring it in `places` and applying to the patient, as
// tabs after the spot's own page: the page's tab first, then one per report (run when first opened, with what
// the host screen knows). The tab bar and the page are there from the first render, so the page is mounted
// once and nothing moves when the report list arrives.
import { AppBar, Box, Tab, Tabs } from '@mui/material';
import { captureException } from '@sentry/react';
import React, { useEffect, useState } from 'react';
import {
  SystemReport as SystemReportDefinition,
  systemReportAppliesTo,
  SystemReportPlace,
} from 'utils/lib/types/adhoc/system/system-report';
import { listSystemReports } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { SystemReport } from './SystemReport';

interface SystemReportsPlaceProps {
  place: SystemReportPlace;
  /** The spot's own tab (the page as it is today). */
  pageTab: string;
  inputs: Record<string, unknown>;
  patient: { birthDate?: string };
  children: React.ReactNode;
}

export function SystemReportsPlace({
  place,
  pageTab,
  inputs,
  patient,
  children,
}: SystemReportsPlaceProps): React.ReactElement {
  const { oystehrZambda } = useApiClients();
  const [reports, setReports] = useState<SystemReportDefinition[]>([]);
  const [tab, setTab] = useState(0);
  const [opened, setOpened] = useState<string[]>([]);

  useEffect(() => {
    if (!oystehrZambda) return;
    let cancelled = false;
    listSystemReports(oystehrZambda)
      .then(({ reports: listed }) => {
        if (!cancelled) setReports(listed.filter((report) => report.places?.includes(place)));
      })
      .catch((e) => {
        if (cancelled) return;
        console.error('Failed to load system reports', e);
        captureException(e);
      });
    return () => {
      cancelled = true;
    };
  }, [oystehrZambda, place]);

  const applicable = reports.filter((report) => systemReportAppliesTo(report, patient));

  return (
    <Box>
      <AppBar position="static" color="default" elevation={0} sx={{ mb: 2 }}>
        <Box
          sx={{ marginLeft: '-20px', padding: '0 24px', width: 'calc(100% + 40px)', borderBottom: '1px solid #DFE5E9' }}
        >
          <Tabs
            value={tab}
            onChange={(_, value: number) => {
              setTab(value);
              const report = applicable[value - 1];
              if (report && !opened.includes(report.id)) setOpened([...opened, report.id]);
            }}
            aria-label="page and report tabs"
          >
            <Tab label={pageTab} />
            {applicable.map((report) => (
              <Tab key={report.id} label={report.title ?? report.name} />
            ))}
          </Tabs>
        </Box>
      </AppBar>
      <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>{children}</Box>
      {applicable.map(
        (report, i) =>
          opened.includes(report.id) && (
            <Box key={report.id} sx={{ display: tab === i + 1 ? 'block' : 'none', pt: 2 }}>
              <SystemReport report={report} inputs={inputs} inPlace />
            </Box>
          )
      )}
    </Box>
  );
}
