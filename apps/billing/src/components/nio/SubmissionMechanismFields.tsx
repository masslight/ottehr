import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { NioAddressFields } from './NioAddressFields';

// Manual bill/invoice submission block shared by workers-comp (direct billing), occupational
// medicine, and other coverage: a preferred-mechanism radio plus one accordion of details per
// mechanism.
export function SubmissionMechanismFields({
  prefix,
  hideMailAddress,
}: {
  // Form path of the NioSubmissionForm this block edits, e.g. 'covers.workers-comp.submission'.
  prefix: string;
  // When the coverage reuses the organization address, the mail accordion shows a note instead of
  // address fields.
  hideMailAddress?: boolean;
}): ReactElement {
  const { control } = useFormContext();
  return (
    <>
      <FormLabel sx={{ fontSize: 14 }}>Preferred Submission Mechanism</FormLabel>
      <Controller
        name={`${prefix}.preferredMechanism`}
        control={control}
        render={({ field }) => (
          <RadioGroup row value={field.value} onChange={(e) => field.onChange(e.target.value)}>
            <FormControlLabel value="email" control={<Radio size="small" />} label="Email" />
            <FormControlLabel value="portal" control={<Radio size="small" />} label="Portal" />
            <FormControlLabel value="fax" control={<Radio size="small" />} label="Fax" />
            <FormControlLabel value="mail" control={<Radio size="small" />} label="Mail" />
          </RadioGroup>
        )}
      />
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Mail</AccordionSummary>
        <AccordionDetails sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {hideMailAddress ? (
            <Typography variant="body2" color="text.secondary">
              Uses the organization address.
            </Typography>
          ) : (
            <NioAddressFields prefix={`${prefix}.mailAddress`} />
          )}
        </AccordionDetails>
      </Accordion>
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Fax</AccordionSummary>
        <AccordionDetails>
          <Controller
            name={`${prefix}.fax`}
            control={control}
            render={({ field }) => (
              <TextField
                label="Fax Number"
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </AccordionDetails>
      </Accordion>
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Online Portal</AccordionSummary>
        <AccordionDetails>
          <Controller
            name={`${prefix}.portalNotes`}
            control={control}
            render={({ field }) => (
              <TextField
                label="Portal Notes"
                size="small"
                fullWidth
                multiline
                minRows={2}
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
              />
            )}
          />
        </AccordionDetails>
      </Accordion>
      <Accordion disableGutters variant="outlined">
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>Email</AccordionSummary>
        <AccordionDetails>
          <Controller
            name={`${prefix}.email`}
            control={control}
            rules={{
              validate: (value: string) =>
                !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) || 'Invalid email address',
            }}
            render={({ field, fieldState: { error } }) => (
              <TextField
                label="Email Address"
                size="small"
                fullWidth
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                error={!!error}
                helperText={error?.message}
              />
            )}
          />
        </AccordionDetails>
      </Accordion>
    </>
  );
}
