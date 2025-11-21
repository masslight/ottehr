import { AppointmentType, ServiceMode } from 'utils';

export const formatLabelValue = (
  value: string | undefined,
  placeholder = '',
  keepPlaceholderIfValueFulfilled = false,
  emptyValuePlaceholder = 'N/A'
): string => {
  const prefix = !value || (keepPlaceholderIfValueFulfilled && value) ? `${placeholder}: ` : '';
  return prefix + (value || emptyValuePlaceholder);
};

export const getVisitTypeLabelForTypeAndServiceMode = (input: {
  type?: AppointmentType;
  serviceMode?: ServiceMode;
}): string => {
  const { type, serviceMode = 'in-person' } = input;
  switch (type) {
    case 'walk-in':
      if (serviceMode === 'virtual') {
        return 'On-demand Telemed';
      } else {
        return 'Walk-in In Person Visit';
      }
    case 'pre-booked':
      if (serviceMode === 'virtual') {
        return 'Pre-booked Telemed';
      } else {
        return 'Pre-booked In Person Visit';
      }
    case 'post-telemed':
      return 'Post Telemed Lab Only';
    default: {
      return '-';
    }
  }
};
