import {
  AccountBalance as AccountBalanceIcon,
  Add as AddIcon,
  Business as BusinessIcon,
  ChevronRight as ChevronRightIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Drawer,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  useTheme,
} from '@mui/material';
import { enqueueSnackbar } from 'notistack';
import { cloneElement, ReactElement, useState } from 'react';
import { CreateWorkQueueDialog, QueueContext, WorkQueueForm } from '../components/CreateWorkQueueDialog';
import { NonInsuranceQueue } from '../components/NonInsuranceQueue';
import { PatientInvoicingQueue } from '../components/PatientInvoicingQueue';
import { AGING_BUCKET_DEFS } from '../constants/agingBuckets';
import { otherColors } from '../themes/ottehr/colors';
import ClaimsList from './ClaimsList';

const formatUsd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format;

type ArTab = 'insurance' | 'non-insurance' | 'patient';

// Fake amounts until AR is backed by real data.
const FAKE_AMOUNTS = {
  insuranceBilled: 482_350.75,
  insuranceExpected: 311_204.4,
  nonInsuranceOutstanding: 64_910.25,
  patientOutstanding: 28_477.9,
};

interface ArTile {
  key: ArTab;
  title: string;
  icon: ReactElement;
  metrics: { label: string; value: number }[];
}

const TILES: ArTile[] = [
  {
    key: 'insurance',
    title: 'Insurance',
    icon: <AccountBalanceIcon />,
    metrics: [
      { label: 'Charged', value: FAKE_AMOUNTS.insuranceBilled },
      { label: 'Expected', value: FAKE_AMOUNTS.insuranceExpected },
    ],
  },
  {
    key: 'non-insurance',
    title: 'Non-Insurance',
    icon: <BusinessIcon />,
    metrics: [{ label: 'Outstanding', value: FAKE_AMOUNTS.nonInsuranceOutstanding }],
  },
  {
    key: 'patient',
    title: 'Patient',
    icon: <PersonIcon />,
    metrics: [{ label: 'Outstanding', value: FAKE_AMOUNTS.patientOutstanding }],
  },
];

interface WorkQueueRow {
  id: string;
  name: string;
  description: string;
  preSubmission: boolean;
  count: number;
  charged: number;
  expected: number;
  owner: string;
}

// Status filter options per AR context; "pre" applies before submission/invoicing, "post" after.
const STATUS_FILTER_OPTIONS: Record<QueueContext, { pre: { code: string; label: string }[]; post: { code: string; label: string }[] }> = {
  insurance: {
    pre: [
      { code: 'none', label: 'None' },
      { code: 'created', label: 'Created' },
    ],
    post: [
      { code: 'submitted', label: 'Submitted' },
      { code: 'adjudicated', label: 'Adjudicated' },
      { code: 'finalized', label: 'Finalized' },
    ],
  },
  patient: {
    pre: [
      { code: 'none', label: 'None' },
      { code: 'not-invoiced', label: 'Not Invoiced' },
      { code: 'ready-to-invoice', label: 'Ready to Invoice' },
    ],
    post: [
      { code: 'invoiced', label: 'Invoiced' },
      { code: 'paid', label: 'Paid' },
    ],
  },
  'non-insurance': {
    pre: [
      { code: 'none', label: 'None' },
      { code: 'not-invoiced', label: 'Not Invoiced' },
      { code: 'ready-to-invoice', label: 'Ready to Invoice' },
    ],
    post: [
      { code: 'invoiced', label: 'Invoiced' },
      { code: 'paid', label: 'Paid' },
    ],
  },
};

const QUEUE_CONTEXT_LABELS: Record<QueueContext, string> = {
  insurance: 'Insurance',
  patient: 'Patient',
  'non-insurance': 'Non-Insurance',
};

// Pre/post wording differs: insurance queues submit claims, the others invoice.
const stageLabel = (context: QueueContext, pre: boolean): string =>
  context === 'insurance' ? (pre ? 'Pre-Submission' : 'Post-Submission') : pre ? 'Pre-Invoice' : 'Post-Invoice';

// Whole-dollar format for the aging bucket buttons.
const formatUsdWhole = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
}).format;

// Fake per-bucket numbers for the post-submission (aging) queue, colored by the shared bucket palette.
const BUCKET_STATS = [
  { count: 14, expected: 4_120 },
  { count: 12, expected: 3_485 },
  { count: 9, expected: 2_730 },
  { count: 7, expected: 1_960 },
  { count: 6, expected: 1_240 },
  { count: 5, expected: 742 },
];
const AGING_BUCKETS = AGING_BUCKET_DEFS.map((def, i) => ({ ...def, ...BUCKET_STATS[i] }));
const ALL_BUCKET_LABELS = AGING_BUCKETS.map((b) => b.label);

// Sample insurance work queues until they're backed by real data.
const SAMPLE_INSURANCE_QUEUES: WorkQueueRow[] = [
  {
    id: 'q-1',
    name: 'Medicaid Claims',
    description: 'Claims with state Medicaid (MC) primary coverage.',
    preSubmission: true,
    count: 42,
    charged: 38_120.5,
    expected: 21_463.75,
    owner: 'Sarah Chen',
  },
  {
    id: 'q-2',
    name: 'Medicare Claims',
    description: 'Claims with Medicare Part A/B (MA/MB) primary coverage.',
    preSubmission: true,
    count: 67,
    charged: 74_890.25,
    expected: 52_310.6,
    owner: 'Sarah Chen',
  },
  {
    id: 'q-3',
    name: 'Blue Network Claims',
    description: 'Claims routed to Blue Cross / Blue Shield network payers.',
    preSubmission: true,
    count: 138,
    charged: 152_407.8,
    expected: 98_215.4,
    owner: 'Mike Rodriguez',
  },
  {
    id: 'q-4',
    name: 'United, Aetna, Cigna Claims',
    description: 'Commercial claims for UnitedHealthcare, Aetna, and Cigna.',
    preSubmission: true,
    count: 91,
    charged: 103_558.9,
    expected: 71_842.35,
    owner: 'Emily Parker',
  },
  {
    id: 'q-5',
    name: 'Tricare, Humana Claims',
    description: 'Claims for Tricare and Humana plans.',
    preSubmission: true,
    count: 24,
    charged: 26_733.4,
    expected: 18_105.2,
    owner: 'Emily Parker',
  },
  {
    id: 'q-6',
    name: 'Workers Comp Claims',
    description: 'Claims tied to workers compensation coverage.',
    preSubmission: true,
    count: 18,
    charged: 31_902.15,
    expected: 24_876.8,
    owner: 'James Wu',
  },
  {
    id: 'q-7',
    name: 'Auto Accident Claims',
    description: 'Claims with auto liability coverage.',
    preSubmission: true,
    count: 9,
    charged: 14_255.6,
    expected: 10_112.45,
    owner: 'James Wu',
  },
  {
    id: 'q-8',
    name: 'Aging Claims',
    description: 'Submitted claims aging past 30 days without payer response.',
    preSubmission: false,
    count: 53,
    charged: 40_482.05,
    expected: 14_277.85,
    owner: 'Priya Natarajan',
  },
];

// Sample patient work queues; "pre" here means pre-invoice.
const SAMPLE_PATIENT_QUEUES: WorkQueueRow[] = [
  {
    id: 'pq-1',
    name: 'Government Claims',
    description: 'Patient balances for government coverage (Medicaid, Medicare, Veteran Affairs).',
    preSubmission: true,
    count: 36,
    charged: 12_480.4,
    expected: 9_310.15,
    owner: 'Emily Parker',
  },
  {
    id: 'pq-2',
    name: 'Commercial Claims',
    description: 'Patient balances for commercially insured visits.',
    preSubmission: true,
    count: 58,
    charged: 21_904.7,
    expected: 17_246.3,
    owner: 'Mike Rodriguez',
  },
  {
    id: 'pq-3',
    name: 'Aging Claims',
    description: 'Invoiced patient balances aging without payment.',
    preSubmission: false,
    count: 27,
    charged: 9_842.6,
    expected: 6_120.45,
    owner: 'Priya Natarajan',
  },
];

// Sample non-insurance work queues: a pre-invoice and post-invoice pair per employer.
const SAMPLE_NON_INSURANCE_QUEUES: WorkQueueRow[] = [
  {
    id: 'nq-1',
    name: 'Acme Manufacturing — Pre-Invoice',
    description: 'Acme Manufacturing claims not yet invoiced.',
    preSubmission: true,
    count: 21,
    charged: 18_340.25,
    expected: 16_921.7,
    owner: 'James Wu',
  },
  {
    id: 'nq-2',
    name: 'Acme Manufacturing — Post-Invoice',
    description: 'Invoiced Acme Manufacturing claims awaiting payment.',
    preSubmission: false,
    count: 12,
    charged: 9_882.4,
    expected: 9_104.55,
    owner: 'James Wu',
  },
  {
    id: 'nq-3',
    name: 'City Transit Authority — Pre-Invoice',
    description: 'City Transit Authority claims not yet invoiced.',
    preSubmission: true,
    count: 17,
    charged: 14_207.9,
    expected: 13_386.2,
    owner: 'Sarah Chen',
  },
  {
    id: 'nq-4',
    name: 'City Transit Authority — Post-Invoice',
    description: 'Invoiced City Transit Authority claims awaiting payment.',
    preSubmission: false,
    count: 8,
    charged: 6_450.75,
    expected: 6_120.4,
    owner: 'Sarah Chen',
  },
  {
    id: 'nq-5',
    name: 'Harbor Logistics Group — Pre-Invoice',
    description: 'Harbor Logistics Group claims not yet invoiced.',
    preSubmission: true,
    count: 11,
    charged: 8_764.3,
    expected: 8_212.85,
    owner: 'Emily Parker',
  },
  {
    id: 'nq-6',
    name: 'Harbor Logistics Group — Post-Invoice',
    description: 'Invoiced Harbor Logistics Group claims awaiting payment.',
    preSubmission: false,
    count: 5,
    charged: 4_310.6,
    expected: 4_020.15,
    owner: 'Emily Parker',
  },
  {
    id: 'nq-7',
    name: 'Summit Construction Co. — Pre-Invoice',
    description: 'Summit Construction Co. claims not yet invoiced.',
    preSubmission: true,
    count: 14,
    charged: 11_925.5,
    expected: 11_237.9,
    owner: 'Priya Natarajan',
  },
  {
    id: 'nq-8',
    name: 'Summit Construction Co. — Post-Invoice',
    description: 'Invoiced Summit Construction Co. claims awaiting payment.',
    preSubmission: false,
    count: 6,
    charged: 5_108.2,
    expected: 4_876.35,
    owner: 'Priya Natarajan',
  },
];

// Fallback description assembled from the queue's filters.
const generateQueueDescription = (data: WorkQueueForm, context: QueueContext): string => {
  const stage = stageLabel(context, data.preSubmission);
  const parts: string[] = [`${stage.charAt(0)}${stage.slice(1).toLowerCase()} claims`];
  if (data.organization) parts.push(`for ${data.organization}`);
  if (data.statuses.length) parts.push(`in status ${data.statuses.join(', ')}`);
  if (data.insuranceTypes.length) parts.push(`with plan type ${data.insuranceTypes.join(', ')}`);
  if (data.payers.length) parts.push(`for ${data.payers.join(', ')}`);
  if (data.renderingProviders.length) parts.push(`rendered by ${data.renderingProviders.join(', ')}`);
  if (data.cptCodes.length) parts.push(`with CPT ${data.cptCodes.join(', ')}`);
  return parts.join(' ') + '.';
};

export default function AccountsReceivable(): ReactElement {
  const theme = useTheme();
  const [selectedTab, setSelectedTab] = useState<ArTab>('insurance');
  const [insuranceQueues, setInsuranceQueues] = useState<WorkQueueRow[]>(SAMPLE_INSURANCE_QUEUES);
  const [patientQueues, setPatientQueues] = useState<WorkQueueRow[]>(SAMPLE_PATIENT_QUEUES);
  const [nonInsuranceQueues, setNonInsuranceQueues] = useState<WorkQueueRow[]>(SAMPLE_NON_INSURANCE_QUEUES);
  const [createQueueOpen, setCreateQueueOpen] = useState(false);
  const [openQueue, setOpenQueue] = useState<{ queue: WorkQueueRow; context: QueueContext } | null>(null);
  const [enabledBuckets, setEnabledBuckets] = useState<string[]>(ALL_BUCKET_LABELS);

  const queueContext: QueueContext = selectedTab;
  const activeQueues =
    selectedTab === 'patient' ? patientQueues : selectedTab === 'non-insurance' ? nonInsuranceQueues : insuranceQueues;

  const handleOpenQueue = (queue: WorkQueueRow): void => {
    setEnabledBuckets(ALL_BUCKET_LABELS);
    setOpenQueue({ queue, context: queueContext });
  };

  const toggleBucket = (label: string): void =>
    setEnabledBuckets((prev) => (prev.includes(label) ? prev.filter((b) => b !== label) : [...prev, label]));

  // UI-only: adds the queue to the local list without persisting it.
  const handleCreateQueue = (data: WorkQueueForm): void => {
    const newQueue: WorkQueueRow = {
      id: `local-${Date.now()}`,
      name: data.organization ? `${data.organization} — ${data.name}` : data.name,
      description: data.description.trim() || generateQueueDescription(data, queueContext),
      preSubmission: data.preSubmission,
      count: 0,
      charged: 0,
      expected: 0,
      owner: data.owner || 'Unassigned',
    };
    if (queueContext === 'patient') {
      setPatientQueues((prev) => [...prev, newQueue]);
    } else if (queueContext === 'non-insurance') {
      setNonInsuranceQueues((prev) => [...prev, newQueue]);
    } else {
      setInsuranceQueues((prev) => [...prev, newQueue]);
    }
    enqueueSnackbar(`${data.name} created (not yet saved to the server)`, { variant: 'success' });
  };

  return (
    <Box>
      <Typography variant="h4" color="primary.dark" fontWeight={600}>
        Accounts Receivable
      </Typography>

      <Box sx={{ display: 'flex', gap: 2.5, mt: 3 }}>
        {TILES.map((tile) => {
          const selected = tile.key === selectedTab;
          return (
            <Card
              key={tile.key}
              sx={{
                flex: 1,
                transition: 'all 0.2s ease-in-out',
                border: 2,
                borderColor: selected ? 'primary.main' : 'transparent',
                bgcolor: selected ? otherColors.apptHover : 'background.paper',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: theme.shadows[6] },
                cursor: 'pointer',
              }}
            >
              <CardActionArea onClick={() => setSelectedTab(tile.key)} sx={{ height: '100%' }}>
                <CardContent
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    py: 1.25,
                    px: 2,
                    '&:last-child': { pb: 1.25 },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: selected ? theme.palette.primary.main : theme.palette.action.disabledBackground,
                        color: selected ? 'white' : theme.palette.text.secondary,
                      }}
                    >
                      {cloneElement(tile.icon, { sx: { fontSize: 18 } })}
                    </Box>
                    <Typography
                      variant="subtitle1"
                      fontWeight={600}
                      color={selected ? 'primary.dark' : 'text.primary'}
                      sx={{ whiteSpace: 'nowrap' }}
                    >
                      {tile.title}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                    {tile.metrics.map((metric) => (
                      <Box
                        key={metric.label}
                        sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'flex-end', gap: 1 }}
                      >
                        <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
                          {metric.label}
                        </Typography>
                        <Typography variant="body2" fontWeight={600} color="primary.dark">
                          {formatUsd(metric.value)}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </CardContent>
              </CardActionArea>
            </Card>
          );
        })}
      </Box>

      <Paper sx={{ p: 3, mt: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box>
            <Typography variant="h5" color="primary.dark" fontWeight={600}>
              Work Queues
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {queueContext === 'patient'
                ? 'Patient balances organized into work queues.'
                : queueContext === 'non-insurance'
                  ? 'Non-insurance organization claims organized into work queues per employer.'
                  : 'Insurance claims organized into work queues.'}
            </Typography>
          </Box>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateQueueOpen(true)}>
            Create Work Queue
          </Button>
        </Box>
        <Table sx={{ mt: 2 }} aria-label="workQueuesTable">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 'bold', width: '40%' }}>Queue</TableCell>
                <TableCell sx={{ fontWeight: 'bold', width: '10%' }} align="right">
                  Claims
                </TableCell>
                {queueContext === 'insurance' ? (
                  <>
                    <TableCell sx={{ fontWeight: 'bold', width: '15%' }} align="right">
                      Charged
                    </TableCell>
                    <TableCell sx={{ fontWeight: 'bold', width: '15%' }} align="right">
                      Expected
                    </TableCell>
                  </>
                ) : (
                  <TableCell sx={{ fontWeight: 'bold', width: '30%' }} align="right">
                    Balance
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 'bold', width: '20%' }}>Owner</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {activeQueues.map((queue) => (
                <TableRow key={queue.id} hover onClick={() => handleOpenQueue(queue)} sx={{ cursor: 'pointer' }}>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {queue.name}
                      </Typography>
                      <Chip
                        label={stageLabel(queueContext, queue.preSubmission)}
                        size="small"
                        variant="outlined"
                        color={queue.preSubmission ? 'default' : 'primary'}
                        sx={{ borderRadius: '4px', fontSize: 11, height: 20 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {queue.description}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">{queue.count}</TableCell>
                  {queueContext === 'insurance' ? (
                    <>
                      <TableCell align="right">{formatUsd(queue.charged)}</TableCell>
                      <TableCell align="right">{formatUsd(queue.expected)}</TableCell>
                    </>
                  ) : (
                    <TableCell align="right">{formatUsd(queue.charged)}</TableCell>
                  )}
                  <TableCell>{queue.owner}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
      </Paper>

      <CreateWorkQueueDialog
        open={createQueueOpen}
        context={queueContext}
        onClose={() => setCreateQueueOpen(false)}
        onCreate={handleCreateQueue}
      />

      {/* Queue drawer: near-fullscreen, leaves the left nav visible. */}
      <Drawer
        anchor="right"
        open={!!openQueue}
        onClose={() => setOpenQueue(null)}
        PaperProps={{ sx: { width: 'calc(100vw - 240px)', maxWidth: '100%' } }}
      >
        {openQueue && (
          <Box sx={{ p: 3, overflow: 'auto' }}>
            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 2 }}>
              <IconButton onClick={() => setOpenQueue(null)} aria-label="Close queue" sx={{ mt: 0.25 }}>
                <ChevronRightIcon />
              </IconButton>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  {stageLabel(openQueue.context, openQueue.queue.preSubmission)}{' '}
                  {QUEUE_CONTEXT_LABELS[openQueue.context]} Work Queue · Owner: {openQueue.queue.owner} ·{' '}
                  {openQueue.queue.count} claims
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {openQueue.queue.description}
                </Typography>
              </Box>
            </Box>

            {/* Aging buckets act as additional claim filters on post-submission/post-invoice queues. */}
            {!openQueue.queue.preSubmission && (
              <Box sx={{ display: 'flex', gap: 1.5, mb: 2.5, flexWrap: 'wrap' }}>
                {AGING_BUCKETS.map((bucket) => {
                  const enabled = enabledBuckets.includes(bucket.label);
                  return (
                    <Card
                      key={bucket.label}
                      sx={{
                        flex: 1,
                        minWidth: 130,
                        border: 2,
                        borderColor: enabled ? bucket.color : 'transparent',
                        bgcolor: enabled ? otherColors.apptHover : 'background.paper',
                        opacity: enabled ? 1 : 0.55,
                        transition: 'all 0.15s ease-in-out',
                      }}
                    >
                      <CardActionArea onClick={() => toggleBucket(bucket.label)}>
                        <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                          <Typography
                            variant="subtitle2"
                            fontWeight={600}
                            sx={{ whiteSpace: 'nowrap', color: enabled ? bucket.color : 'text.secondary' }}
                          >
                            {bucket.label} days
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            {bucket.count} claims
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            sx={{ color: enabled ? bucket.color : 'text.secondary' }}
                          >
                            {formatUsdWhole(bucket.expected)}
                          </Typography>
                        </CardContent>
                      </CardActionArea>
                    </Card>
                  );
                })}
              </Box>
            )}

            {openQueue.context === 'patient' ? (
              <>
                <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 2 }}>
                  {openQueue.queue.name}
                </Typography>
                <PatientInvoicingQueue queueName={openQueue.queue.name} preInvoice={openQueue.queue.preSubmission} />
              </>
            ) : openQueue.context === 'non-insurance' ? (
              <>
                <Typography variant="h4" color="primary.dark" fontWeight={600} sx={{ mb: 2 }}>
                  {openQueue.queue.name}
                </Typography>
                <NonInsuranceQueue
                  organization={openQueue.queue.name.split(' — ')[0]}
                  preInvoice={openQueue.queue.preSubmission}
                />
              </>
            ) : (
              <ClaimsList
                title={openQueue.queue.name}
                hideArStageFilter
                statusOptionsOverride={
                  STATUS_FILTER_OPTIONS[openQueue.context][openQueue.queue.preSubmission ? 'pre' : 'post']
                }
              />
            )}
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
