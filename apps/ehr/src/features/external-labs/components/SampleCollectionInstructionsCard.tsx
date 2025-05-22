import React, { useCallback, useState } from 'react';
import { DateTime } from 'luxon';
import { Box, Grid, Paper, TextField, Stack, Typography, useTheme } from '@mui/material';
import {
  APIError,
  SpecimenDateChangedParameters,
  sampleDTO,
  EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE,
  LabelPdf,
} from 'utils';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import { BoldedTitleText } from './BoldedTitleText';
import { useDebounce } from 'src/telemed/hooks/useDebounce';
import { enqueueSnackbar } from 'notistack';
import { useApiClients } from 'src/hooks/useAppClients';
import { getLabelPdf } from '../../../api/api';
import { openPdf } from './OrderCollection';
import { LoadingButton } from '@mui/lab';

interface SampleCollectionInstructionsCardProps {
  sample: sampleDTO;
  serviceRequestId: string;
  timezone?: string;
  saveSpecimenDate: (parameters: SpecimenDateChangedParameters) => Promise<void>;
  updateSpecimenLoadingState?: (specimenId: string, state: 'saving' | 'saved') => void;
  printLabelVisible: boolean;
}

export const SampleCollectionInstructionsCard: React.FC<SampleCollectionInstructionsCardProps> = ({
  sample,
  serviceRequestId,
  timezone,
  saveSpecimenDate,
  updateSpecimenLoadingState,
  printLabelVisible,
}) => {
  const { specimen, definition } = sample;
  const [collapsed, setCollapsed] = useState(false);
  const { debounce } = useDebounce(1000);
  const [labelLoading, setLabelLoading] = useState(false);
  const [error, setError] = useState<string[] | undefined>(undefined);
  const { oystehrZambda: oystehr } = useApiClients();
  const theme = useTheme();

  const initialDateTime = specimen.collectionDate
    ? DateTime.fromISO(specimen.collectionDate, { zone: timezone })
    : DateTime.now().setZone(timezone);

  const [date, setDate] = useState(initialDateTime);
  const dateValue = date.toFormat('yyyy-MM-dd');
  const timeValue = date.toFormat('HH:mm');

  const saveDateHandler = ({ field, value }: { field: 'collectionDate' | 'collectionTime'; value: string }): void => {
    setDate((prevDate) => {
      let newDate: DateTime = prevDate;

      if (field === 'collectionDate') {
        const [year, month, day] = value.split('-').map((v) => parseInt(v, 10));
        newDate = newDate.set({ year, month, day });
      } else if (field === 'collectionTime') {
        const [hour, minute] = value.split(':').map((v) => parseInt(v, 10));
        newDate = newDate.set({ hour, minute });
      }

      if (!newDate.isValid) {
        console.error('Invalid new date');
        return prevDate;
      }

      if (newDate.toISO() === prevDate.toISO()) {
        return prevDate;
      }

      updateSpecimenLoadingState?.(specimen.id, 'saving');

      debounce(async () => {
        try {
          const dateISOToSave = newDate.toISO();

          if (!dateISOToSave) {
            throw Error('Invalid date to save');
          }

          await saveSpecimenDate({
            specimenId: specimen.id,
            serviceRequestId,
            date: dateISOToSave,
          });
        } catch (error) {
          setDate(prevDate);
          enqueueSnackbar('Date was not saved. Please try again.', {
            variant: 'error',
          });
          console.error('Error updating specimen date', error);
        } finally {
          updateSpecimenLoadingState?.(specimen.id, 'saved');
        }
      });

      return newDate;
    });
  };

  const printLabelHandler = useCallback(async () => {
    setLabelLoading(true);
    if (!oystehr) {
      setError(['Oystehr client is undefined']);
      return;
    }

    let labelPdfs: LabelPdf[] | undefined = undefined;
    try {
      labelPdfs = await getLabelPdf(oystehr, {
        contextRelatedReference: { reference: `ServiceRequest/${serviceRequestId}` },
        searchParams: [
          { name: 'status', value: 'current' },
          { name: 'type', value: EXTERNAL_LAB_LABEL_DOC_REF_DOCTYPE.code },
        ],
      });
    } catch (error) {
      const apiError = error as APIError;
      console.error(JSON.stringify(apiError));
      setError([`Unable to load label pdf. Error: ${apiError.message}`]);
      return;
    }

    if (labelPdfs?.length !== 1) {
      setError(['Received unexpected number of label pdfs']);
      return;
    }

    await openPdf(labelPdfs[0].presignedURL);

    setLabelLoading(false);
  }, [oystehr, setLabelLoading, setError, serviceRequestId]);

  return (
    <AccordionCard
      label={'Sample Collection Instructions'}
      collapsed={collapsed}
      withBorder={false}
      onSwitch={() => {
        setCollapsed((prevState) => !prevState);
      }}
    >
      <Paper sx={{ p: 3 }}>
        <Stack spacing={1}>
          <BoldedTitleText title={'Container'} description={definition.container} />
          <BoldedTitleText title={'Volume'} description={definition.volume} />
          <BoldedTitleText title={'Minimum Volume'} description={definition.minimumVolume} />
          <BoldedTitleText title={'Storage Requirements'} description={definition.storageRequirements} />
          <BoldedTitleText title={'Collection Instructions'} description={definition.collectionInstructions} />
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
              value={dateValue}
              onChange={(e) => saveDateHandler({ field: 'collectionDate', value: e.target.value })}
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
              value={timeValue}
              onChange={(e) => saveDateHandler({ field: 'collectionTime', value: e.target.value })}
            />
          </Grid>
        </Grid>
        {printLabelVisible && (
          <LoadingButton
            variant="outlined"
            type="button"
            sx={{ width: 170, borderRadius: '50px', textTransform: 'none', mt: 3 }}
            onClick={async () => {
              await printLabelHandler();
            }}
            loading={labelLoading}
          >
            Print label
          </LoadingButton>
        )}
        {error && error.length > 0 && (
          <Box sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            {error.map((msg, idx) => (
              <Box sx={{ textAlign: 'left', paddingTop: 1 }} key={idx}>
                <Typography sx={{ color: theme.palette.error.main }} key={`errormsg-${idx}`}>
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
