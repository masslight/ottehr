export const VALUE_SET_OVERRIDES = {
  reasonForVisitOptions: [
    { label: 'Allergies or Allergic reaction', value: 'Allergies or Allergic reaction' },
    { label: 'Asthma flare up or Shortness of Breath', value: 'Asthma flare up or Shortness of Breath' },
    { label: 'Auto accident', value: 'Auto accident' },
    { label: 'Back Pain', value: 'Back Pain' },
    { label: 'COVID or Flu-like Symptoms', value: 'COVID or Flu-like Symptoms' },
    { label: 'Ear pain', value: 'Ear pain' },
    { label: 'Eye issue', value: 'Eye issue' },
    { label: 'Fever', value: 'Fever' },
    { label: 'GI issues or Abdominal Pain', value: 'GI issues or Abdominal Pain' },
    { label: 'Headache', value: 'Headache' },
    { label: 'Immigration Screening', value: 'Immigration Screening' },
    { label: 'Injury', value: 'Injury' },
    { label: 'Pain', value: 'Pain' },
    { label: 'Rash', value: 'Rash' },
    { label: 'Sore Throat', value: 'Sore Throat' },
    { label: 'UTI', value: 'UTI' },
    { label: 'Other', value: 'Other' },
  ],
  // will be automatically added to the encounter if external labs are ordered
  externalLabAdditionalCptCodesToAdd: [
    {
      label: 'Handling and/or conveyance of specimen for transfer to a laboratory',
      value: '99001',
    },
  ],
};
