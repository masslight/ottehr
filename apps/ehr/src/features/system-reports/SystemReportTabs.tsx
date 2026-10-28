// The tab bar a screen puts around its page to show system reports beside it: the page's tab first, then one
// per report the screen names. The screen decides which reports to list, and for whom; each is loaded by its
// published name (get-system-report) and run when its tab is first opened, with what the screen knows. The
// tab bar and the page are there from the first render, so the page is mounted once and nothing moves.
import { Alert, AppBar, Box, CircularProgress, Tab, Tabs } from '@mui/material';
import { captureException } from '@sentry/react';
import React, { useState } from 'react';
import type { SystemReport as SystemReportDefinition } from 'utils/lib/types/adhoc/system/system-report';
import { getSystemReport } from '../../api/api';
import { useApiClients } from '../../hooks/useAppClients';
import { SystemReport } from './SystemReport';

export interface SystemReportTab {
  /** The report's published name (its `name` in the Report Studio file). */
  name: string;
  /** The tab's label. */
  label: string;
}

/** A tab built into the EHR, shown after the reports' tabs. */
export interface NativeTab {
  label: string;
  /** Mounted when the tab is first opened, then kept, like a report. */
  content: React.ReactNode;
}

interface SystemReportTabsProps {
  /** The screen's own tab (the page as it is today). */
  pageTab: string;
  /** The reports to show; with none, the page renders alone, without a tab bar. */
  reports: SystemReportTab[];
  nativeTabs?: NativeTab[];
  inputs: Record<string, unknown>;
  children: React.ReactNode;
}

type Loaded = { report: SystemReportDefinition } | { error: string };

const errorMessage = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function SystemReportTabs({
  pageTab,
  reports,
  nativeTabs = [],
  inputs,
  children,
}: SystemReportTabsProps): React.ReactElement {
  const { oystehrZambda } = useApiClients();
  const [tab, setTab] = useState(0);
  const [loaded, setLoaded] = useState<Record<string, Loaded | 'loading'>>({});
  const [openedNative, setOpenedNative] = useState<number[]>([]);

  if (reports.length === 0 && nativeTabs.length === 0) return <>{children}</>;

  const open = (name: string): void => {
    if (!oystehrZambda || loaded[name]) return;
    setLoaded((prev) => ({ ...prev, [name]: 'loading' }));
    getSystemReport(oystehrZambda, { name })
      .then(({ report }) => setLoaded((prev) => ({ ...prev, [name]: { report } })))
      .catch((e) => {
        captureException(e);
        setLoaded((prev) => ({ ...prev, [name]: { error: errorMessage(e) } }));
      });
  };

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
              if (value > 0 && value <= reports.length) open(reports[value - 1].name);
              if (value > reports.length && !openedNative.includes(value)) setOpenedNative([...openedNative, value]);
            }}
            aria-label="page and report tabs"
          >
            <Tab label={pageTab} />
            {reports.map(({ name, label }) => (
              <Tab key={name} label={label} />
            ))}
            {nativeTabs.map(({ label }) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </Box>
      </AppBar>
      <Box sx={{ display: tab === 0 ? 'block' : 'none' }}>{children}</Box>
      {reports.map(({ name }, i) => {
        const state = loaded[name];
        if (!state) return null;
        return (
          <Box key={name} sx={{ display: tab === i + 1 ? 'block' : 'none', pt: 2 }}>
            {state === 'loading' && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress size={28} />
              </Box>
            )}
            {state !== 'loading' && 'error' in state && (
              <Alert severity="error">The report could not be loaded: {state.error}</Alert>
            )}
            {state !== 'loading' && 'report' in state && <SystemReport report={state.report} inputs={inputs} />}
          </Box>
        );
      })}
      {nativeTabs.map(({ label, content }, i) => {
        const index = reports.length + 1 + i;
        if (!openedNative.includes(index)) return null;
        return (
          <Box key={label} sx={{ display: tab === index ? 'block' : 'none', pt: 2 }}>
            {content}
          </Box>
        );
      })}
    </Box>
  );
}
