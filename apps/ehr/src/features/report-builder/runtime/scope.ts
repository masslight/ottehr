// The real components behind the two namespaces passed into the generated function:
//   Report — the purpose-built report components (documented to the model in the generation prompt)
//   MUI    — a curated subset of @mui/material for custom UI when no Report component fits
// WHICH names exist is decided by the runtime-scope catalog (the same source the prompt is rendered
// from); the `satisfies` clauses below make a missing or extra binding a COMPILE error, so the frame
// and the prompt can never drift. Type-only import ⇒ no catalog code enters the iframe bundle.
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import type { MuiComponentName, ReportComponentName } from 'utils/lib/types/adhoc/generation/runtime-scope.catalog';
import { EChart } from './components/EChart';
import { Kpi } from './components/Kpi';
import { Link } from './components/Link';
import { Note } from './components/Note';
import { Section } from './components/Section';
import { Table } from './components/Table';
import { VegaChart } from './components/VegaChart';

export const Report = {
  Section,
  Table,
  EChart,
  VegaChart,
  Kpi,
  Note,
  Link,
} as const satisfies Record<ReportComponentName, unknown>;

export const MUI = {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Slider,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} as const satisfies Record<MuiComponentName, unknown>;
