import { Box, Divider, FormControlLabel, Radio, RadioGroup, Typography } from '@mui/material';
import { FC } from 'react';
import { PATIENT_EDUCATION_LANGUAGE_LABELS, PATIENT_EDUCATION_LANGUAGES, PatientEducationLanguage } from 'utils';

type PatientEducationLanguageSelectorProps = {
  value: PatientEducationLanguage;
  onChange: (language: PatientEducationLanguage) => void;
  disabled?: boolean;
  showPreferredSpanishHint?: boolean;
};

export const PatientEducationLanguageSelector: FC<PatientEducationLanguageSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  showPreferredSpanishHint = false,
}) => (
  <Box>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
      Language
      {showPreferredSpanishHint && (
        <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
          (patient's preferred language is Spanish)
        </Typography>
      )}
    </Typography>
    <RadioGroup row value={value} onChange={(event) => onChange(event.target.value as PatientEducationLanguage)}>
      {PATIENT_EDUCATION_LANGUAGES.map((language) => (
        <FormControlLabel
          key={language}
          value={language}
          control={<Radio size="small" disabled={disabled} />}
          label={PATIENT_EDUCATION_LANGUAGE_LABELS[language]}
        />
      ))}
    </RadioGroup>
    <Divider sx={{ mt: 1 }} />
  </Box>
);
