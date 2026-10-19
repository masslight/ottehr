import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  SxProps,
  TextField,
  Theme,
  Typography,
} from '@mui/material';
import { ReactElement, ReactNode, useEffect, useState } from 'react';
import { Controller, get, useFormContext, useFormState } from 'react-hook-form';
import { EmailInput } from '../input/EmailInput';
import { PhoneInput } from '../input/PhoneInput';
import { NioAddressFields } from './NioAddressFields';

// Accordion that expands itself when a field under `errorPath` fails validation, so a submit
// blocked by a collapsed section still shows the user what to fix.
function SubmissionAccordion({
  title,
  errorPath,
  detailsSx,
  children,
}: {
  title: string;
  errorPath: string;
  detailsSx?: SxProps<Theme>;
  children: ReactNode;
}): ReactElement {
  const { errors } = useFormState({ name: errorPath });
  const hasError = !!get(errors, errorPath);
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (hasError) setExpanded(true);
  }, [hasError]);
  return (
    <Accordion
      disableGutters
      variant="outlined"
      expanded={expanded}
      onChange={(_, isExpanded) => setExpanded(isExpanded)}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>{title}</AccordionSummary>
      <AccordionDetails sx={detailsSx}>{children}</AccordionDetails>
    </Accordion>
  );
}

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
      <SubmissionAccordion
        title="Mail"
        errorPath={`${prefix}.mailAddress`}
        detailsSx={{ display: 'flex', flexDirection: 'column', gap: 2 }}
      >
        {hideMailAddress ? (
          <Typography variant="body2" color="text.secondary">
            Uses the organization address.
          </Typography>
        ) : (
          <NioAddressFields prefix={`${prefix}.mailAddress`} />
        )}
      </SubmissionAccordion>
      <SubmissionAccordion title="Fax" errorPath={`${prefix}.fax`}>
        <PhoneInput name={`${prefix}.fax`} label="Fax Number" fieldLabel="Fax number" />
      </SubmissionAccordion>
      <SubmissionAccordion title="Online Portal" errorPath={`${prefix}.portalNotes`}>
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
      </SubmissionAccordion>
      <SubmissionAccordion title="Email" errorPath={`${prefix}.email`}>
        <EmailInput name={`${prefix}.email`} label="Email Address" />
      </SubmissionAccordion>
    </>
  );
}
