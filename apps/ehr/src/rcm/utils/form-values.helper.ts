import { ControllerProps } from 'react-hook-form';

type FieldsForRules =
  | 'firstName'
  | 'lastName'
  | 'dob'
  | 'sex'
  | 'phone'
  | 'address'
  | 'city'
  | 'state'
  | 'zip'
  | 'relationship'
  | 'planAndPayor'
  | 'insuredID';

export const mapFieldToRules: { [value in FieldsForRules]: ControllerProps['rules'] } = {
  firstName: {
    required: true,
  },
  lastName: {
    required: true,
  },
  dob: {
    required: true,
    validate: (value) => {
      if (!value?.isValid) {
        return 'Provide correct date';
      }
      return;
    },
  },
  sex: {
    required: true,
  },
  phone: {
    required: true,
    validate: (value) => {
      if (!/^\(\d{3}\) \d{3}-\d{4}$/.test(value)) {
        return 'Provide correct phone number';
      }
      return;
    },
  },
  address: {
    required: true,
  },
  city: {
    required: true,
  },
  state: {
    required: true,
  },
  zip: {
    required: true,
    validate: (value) => {
      if (!/^\d{5}$/.test(value)) {
        return 'Provide correct ZIP';
      }
      return;
    },
  },
  relationship: {
    required: true,
  },
  planAndPayor: {
    required: true,
  },
  insuredID: {
    required: true,
  },
};
