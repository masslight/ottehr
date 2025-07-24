import { LoadingButton } from '@mui/lab';
import { Box, Grid, Paper, Stack, TextField, Typography, useTheme } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useCallback, useEffect, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { APIError, EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE, sampleDTO } from 'utils';
import { getLabelPdf } from '../../../api/api';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import { openPdf } from './OrderCollection';

interface SampleCollectionInstructionsCardProps {
  sample: sampleDTO;
  serviceRequestId: string;
  timezone?: string;
  setSpecimenData: (specimenId: string, date: string) => void;
  printLabelVisible: boolean;
  isDateEditable: boolean;
}

export const SampleCollectionInstructionsCard: React.FC<SampleCollectionInstructionsCardProps> = ({
  sample,
  serviceRequestId,
  timezone,
  setSpecimenData,
  printLabelVisible,
  isDateEditable,
}) => {
  const { specimen, definition } = sample;
  const [collapsed, setCollapsed] = useState(false);
  const [labelLoading, setLabelLoading] = useState(false);
  const [error, setError] = useState<string[]>();
  const { oystehrZambda: oystehr } = useApiClients();
  const theme = useTheme();

  const [date, setDate] = useState(() =>
    specimen.collectionDate
      ? DateTime.fromISO(specimen.collectionDate, { zone: timezone })
      : DateTime.now().setZone(timezone)
  );

  useEffect(() => {
    if (date.isValid) {
      setSpecimenData(specimen.id, date.toISO());
    }
  }, [date, setSpecimenData, specimen.id]);

  const handleDateChange = (field: 'collectionDate' | 'collectionTime', value: string): void => {
    setDate((prev) => {
      const parts = value.split(field === 'collectionDate' ? '-' : ':').map(Number);
      const updated =
        field === 'collectionDate'
          ? prev.set({ year: parts[0] || prev.year, month: parts[1] || prev.month, day: parts[2] || prev.day })
          : prev.set({ hour: parts[0] || prev.hour, minute: parts[1] || prev.minute });

      return updated.isValid ? updated : prev;
    });
  };

  const printLabel = useCallback(async () => {
    if (!oystehr) return setError(['Oystehr client is undefined']);

    setLabelLoading(true);
    try {
      const labelPdfs = await getLabelPdf(oystehr, {
        contextRelatedReference: { reference: `ServiceRequest/${serviceRequestId}` },
        searchParams: [
          { name: 'status', value: 'current' },
          { name: 'type', value: EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code },
        ],
      });

      if (labelPdfs?.length !== 1) throw new Error('Unexpected number of label pdfs');

      await openPdf(labelPdfs[0].presignedURL);
    } catch (error) {
      const apiError = error as APIError;
      setError([`Unable to load label pdf. Error: ${apiError.message}`]);
    } finally {
      setLabelLoading(false);
    }
  }, [oystehr, serviceRequestId]);

  return (
    <AccordionCard
      label="Sample Collection Instructions"
      collapsed={collapsed}
      withBorder={false}
      onSwitch={() => setCollapsed((prev) => !prev)}
    >
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <BoldedTitleText title="Container" description={definition.container} />
          <BoldedTitleText title="Volume" description={definition.volume} />
          <BoldedTitleText title="Minimum Volume" description={definition.minimumVolume} />
          <BoldedTitleText title="Storage Requirements" description={definition.storageRequirements} />
          <BoldedTitleText title="Collection Instructions" description={definition.collectionInstructions} />
        </Stack>

        <Grid container spacing={2} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Collection date
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              type="date"
              value={date.toFormat('yyyy-MM-dd')}
              onChange={(e) => handleDateChange('collectionDate', e.target.value)}
              disabled={!isDateEditable}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Collection time
            </Typography>
            <TextField
              fullWidth
              variant="outlined"
              type="time"
              value={date.toFormat('HH:mm')}
              onChange={(e) => handleDateChange('collectionTime', e.target.value)}
              disabled={!isDateEditable}
            />
          </Grid>
        </Grid>

        {printLabelVisible && (
          <LoadingButton
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none', mt: 3 }}
            onClick={printLabel}
            loading={labelLoading}
          >
            Print label
          </LoadingButton>
        )}
        {error && error.length > 0 && (
          <Box sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            {error.map((msg, idx) => (
              <Box sx={{ textAlign: 'left', paddingTop: 1 }} key={idx}>
                <Typography sx={{ color: theme.palette.error.main }} key={`errorMsg-${idx}`}>
                  {typeof msg === 'string' ? msg : JSON.stringify(msg, null, 2)}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Paper>
    </AccordionCard>
  );
};
