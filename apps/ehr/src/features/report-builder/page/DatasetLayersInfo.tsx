import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Chip,
  Collapse,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Fragment, ReactElement, useState } from 'react';
import { layerSchemas } from 'utils/lib/types/adhoc/datasets/dataset';
import { llmFieldsFromZodObject } from 'utils/lib/types/adhoc/datasets/llm-schema';
import { AD_HOC_DATASETS, getDataset } from '../datasets/registry';
import { AdHocDataset } from '../datasets/types';

interface FieldRow {
  name: string;
  type: string;
  description: string;
  /** Members of a record column, listed as their own rows so they are findable. */
  fields?: { name: string; type: string; description: string }[];
}

interface LayerRow {
  id: string;
  label: string;
  description: string;
  loaded?: boolean;
  fields: FieldRow[];
}

function layerRowsFor(dataset: AdHocDataset | undefined, loadedIds?: Record<string, boolean>): LayerRow[] {
  const schemas = dataset?.layers ? layerSchemas(dataset.layers) : {};
  return (dataset?.options ?? []).map((layer) => ({
    id: layer.id,
    label: layer.label,
    description: layer.description ?? '',
    ...(loadedIds ? { loaded: !!loadedIds[layer.id] } : {}),
    fields: schemas[layer.id] ? llmFieldsFromZodObject(schemas[layer.id]) : [],
  }));
}

function baseFieldsFor(dataset: AdHocDataset | undefined): FieldRow[] {
  return dataset?.baseSchema ? llmFieldsFromZodObject(dataset.baseSchema, dataset.internalFields ?? []) : [];
}

function FieldsTable({ fields }: { fields: FieldRow[] }): ReactElement {
  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell>Field</TableCell>
          <TableCell>Type</TableCell>
          <TableCell>Description</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {fields.map((field) => (
          <Fragment key={field.name}>
            <TableRow>
              <TableCell sx={{ fontFamily: 'monospace' }}>{field.name}</TableCell>
              <TableCell>{field.type}</TableCell>
              <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{field.description}</TableCell>
            </TableRow>
            {(field.fields ?? []).map((member) => (
              <TableRow key={`${field.name}.${member.name}`}>
                <TableCell sx={{ fontFamily: 'monospace', pl: 4 }}>{`${field.name}[].${member.name}`}</TableCell>
                <TableCell>{member.type}</TableCell>
                <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{member.description}</TableCell>
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  );
}

function LayersTable({ layers, showStatus }: { layers: LayerRow[]; showStatus: boolean }): ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Table size="small">
      <TableHead>
        <TableRow>
          <TableCell sx={{ width: 48 }} />
          <TableCell>Layer</TableCell>
          <TableCell>What it adds</TableCell>
          {showStatus && <TableCell>Status</TableCell>}
        </TableRow>
      </TableHead>
      <TableBody>
        {layers.map((layer) => {
          const isOpen = expanded === layer.id;
          return (
            <Fragment key={layer.id}>
              <TableRow>
                <TableCell>
                  {layer.fields.length > 0 && (
                    <IconButton size="small" onClick={() => setExpanded(isOpen ? null : layer.id)}>
                      {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                    </IconButton>
                  )}
                </TableCell>
                <TableCell>{layer.label}</TableCell>
                <TableCell sx={{ color: 'text.secondary' }}>{layer.description}</TableCell>
                {showStatus && (
                  <TableCell>
                    <Chip
                      size="small"
                      label={layer.loaded ? 'Loaded' : 'Available'}
                      color={layer.loaded ? 'success' : 'default'}
                      variant={layer.loaded ? 'filled' : 'outlined'}
                    />
                  </TableCell>
                )}
              </TableRow>
              <TableRow>
                <TableCell sx={{ py: 0, border: 0 }} colSpan={showStatus ? 4 : 3}>
                  <Collapse in={isOpen} unmountOnExit>
                    <Box sx={{ py: 1, pl: 6 }}>
                      <FieldsTable fields={layer.fields} />
                    </Box>
                  </Collapse>
                </TableCell>
              </TableRow>
            </Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}

export function DatasetLayersInfo({
  datasetId,
  datasetOptions,
}: {
  datasetId: string;
  datasetOptions: Record<string, boolean>;
}): ReactElement | null {
  const layers = layerRowsFor(getDataset(datasetId), datasetOptions);
  if (layers.length === 0) return null;

  const loadedCount = layers.filter((layer) => layer.loaded).length;

  return (
    <Box sx={{ mt: 2, px: 2, pb: 2 }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        Optional data layers — {loadedCount} of {layers.length} loaded
      </Typography>
      <LayersTable layers={layers} showStatus />
    </Box>
  );
}

export function AllDatasetsInfo(): ReactElement {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Box>
      {AD_HOC_DATASETS.map((dataset) => {
        const isOpen = expanded === dataset.id;
        return (
          <Box key={dataset.id} sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <IconButton size="small" onClick={() => setExpanded(isOpen ? null : dataset.id)}>
                {isOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
              </IconButton>
              <Typography variant="subtitle2">{dataset.label}</Typography>
              <Typography variant="body2" color="text.secondary">
                — {dataset.description}
              </Typography>
            </Box>
            <Collapse in={isOpen} unmountOnExit>
              <Box sx={{ pl: 5, py: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Always available
                </Typography>
                <FieldsTable fields={baseFieldsFor(dataset)} />
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2 }}>
                  Optional layers
                </Typography>
                <LayersTable layers={layerRowsFor(dataset)} showStatus={false} />
              </Box>
            </Collapse>
          </Box>
        );
      })}
    </Box>
  );
}
