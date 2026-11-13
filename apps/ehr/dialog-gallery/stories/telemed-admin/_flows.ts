import type { FlowForm, FlowService } from 'utils/lib/types/data/paperwork-flows/paperwork-flows.types';

export const flowForms: FlowForm[] = [
  {
    id: 'q-1',
    url: 'https://ottehr.com/FHIR/Questionnaire/intake-paperwork-inperson',
    label: 'In-person intake paperwork',
  },
  { id: 'q-2', url: 'https://ottehr.com/FHIR/Questionnaire/work-injury-intake', label: 'Work injury intake' },
  { id: 'q-3', url: 'https://ottehr.com/FHIR/Questionnaire/consent-forms', label: 'Consent forms' },
];

export const flowServices: FlowService[] = [
  { id: 'svc-1', label: 'Occupational Medicine', ottehrManagedService: true },
  { id: 'svc-2', label: 'Workers Compensation', ottehrManagedService: true },
  { id: 'svc-3', label: 'Urgent Care', ottehrManagedService: true },
];
