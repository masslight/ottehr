export const chartData = {
  vitals: {
    temperature: {
      alertThresholds: [
        {
          min: { units: 'celsius', value: 36.5 },
          max: { units: 'celsius', value: 37.9 },
          minAge: { unit: 'months', value: 0 },
          maxAge: { unit: 'months', value: 2 },
        },
        {
          min: { units: 'celsius', value: 36 },
          max: { units: 'celsius', value: 38.4 },
          minAge: { unit: 'months', value: 2 },
          maxAge: { unit: 'months', value: 144 },
        },
      ],
    },
    heartRate: {
      alertThresholds: [
        {
          min: { units: 'bpm', value: 100 },
          max: { units: 'bpm', value: 200 },
          minAge: { unit: 'months', value: 0 },
          maxAge: { unit: 'months', value: 2 },
        },
        {
          min: { units: 'bpm', value: 80 },
          max: { units: 'bpm', value: 160 },
          minAge: { unit: 'months', value: 2 },
          maxAge: { unit: 'months', value: 12 },
        },
        {
          min: { units: 'bpm', value: 70 },
          max: { units: 'bpm', value: 150 },
          minAge: { unit: 'months', value: 12 },
          maxAge: { unit: 'months', value: 36 },
        },
        {
          min: { units: 'bpm', value: 60 },
          max: { units: 'bpm', value: 150 },
          minAge: { unit: 'months', value: 36 },
          maxAge: { unit: 'months', value: 72 },
        },
        {
          min: { units: 'bpm', value: 60 },
          max: { units: 'bpm', value: 140 },
          minAge: { unit: 'months', value: 72 },
          maxAge: { unit: 'months', value: 108 },
        },
        {
          min: { units: 'bpm', value: 60 },
          max: { units: 'bpm', value: 130 },
          minAge: { unit: 'months', value: 108 },
          maxAge: { unit: 'months', value: 144 },
        },
        {
          min: { units: 'bpm', value: 144 },
          max: { units: 'bpm', value: 130 },
          minAge: { unit: 'months', value: 144 },
        },
      ],
    },
    respiratoryRate: {
      alertThresholds: [
        {
          min: { units: '', value: 30 },
          max: { units: '', value: 60 },
          minAge: { unit: 'months', value: 0 },
          maxAge: { unit: 'months', value: 2 },
        },
        {
          min: { units: '', value: 30 },
          max: { units: '', value: 60 },
          minAge: { unit: 'months', value: 2 },
          maxAge: { unit: 'months', value: 12 },
        },
        {
          min: { units: '', value: 20 },
          max: { units: '', value: 50 },
          minAge: { unit: 'months', value: 12 },
          maxAge: { unit: 'months', value: 36 },
        },
        {
          min: { units: '', value: 20 },
          max: { units: '', value: 40 },
          minAge: { unit: 'months', value: 36 },
          maxAge: { unit: 'months', value: 72 },
        },
        {
          min: { units: '', value: 15 },
          max: { units: '', value: 40 },
          minAge: { unit: 'months', value: 72 },
          maxAge: { unit: 'months', value: 108 },
        },
        {
          min: { units: '', value: 15 },
          max: { units: '', value: 30 },
          minAge: { unit: 'months', value: 108 },
          maxAge: { unit: 'months', value: 144 },
        },
        {
          min: { units: '', value: 10 },
          max: { units: '', value: 30 },
          minAge: { unit: 'months', value: 144 },
        },
      ],
    },
    sp02: {
      alertThresholds: [
        {
          min: { units: '', value: 95 },
          minAge: { unit: 'months', value: 0 },
        },
      ],
    },
    systolicBloodPressure: {
      alertThresholds: [
        {
          min: { units: '', value: 70 },
          minAge: { unit: 'months', value: 0 },
          maxAge: { unit: 'months', value: 2 },
        },
        {
          min: { units: '', function: (ageInYears: number) => 70 + ageInYears * 2 },
          minAge: { unit: 'months', value: 2 },
          maxAge: { unit: 'months', value: 108 },
        },
      ],
    },
  },
};
/*[

  {
    minAge: { unit: 'months', value: 12 }, // 1 year
    maxAge: 36, // 3 years
    temperature: { min: 36, max: 38.4 },
    heartRate: { min: 70, max: 150 },
    respiratoryRate: { min: 20, max: 50 },
    sp02: { min: 95 },
    systolicBloodPressure: { min: (ageInYears: number) => 70 + ageInYears * 2 },
  },
  {
    minAge: { unit: 'months', value: 36 }, // 3 years
    maxAge: { unit: 'months', value: 72 }, // 6 years
    temperature: { min: 36, max: 38.4 },
    heartRate: { min: 60, max: 150 },
    respiratoryRate: { min: 20, max: 40 },
    sp02: { min: 95 },
    systolicBloodPressure: { min: (ageInYears: number) => 70 + ageInYears * 2 },
  },
  {
    minAge: { unit: 'months', value: 72 }, // 6 years
    maxAge: { unit: 'months', value: 108 }, // 9 years
    temperature: { min: 36, max: 38.4 },
    heartRate: { min: 60, max: 140 },
    respiratoryRate: { min: 15, max: 40 },
    sp02: { min: 95 },
    systolicBloodPressure: { min: (ageInYears: number) => 70 + ageInYears * 2 },
  },
  {
    minAge: { unit: 'months', value: 108 }, // 9 years
    maxAge: { unit: 'months', value: 144 }, // 12 years
    temperature: { min: 36, max: 38.4 },
    heartRate: { min: 60, max: 130 },
    respiratoryRate: { min: 15, max: 30 },
    sp02: { min: 95 },
    systolicBloodPressure: { min: 90 },
  },
  {
    minAge: { unit: 'months', value: 144 }, // 12 years
    maxAge: { unit: 'months', value: Infinity },
    temperature: { min: 36, max: 38.4 },
    heartRate: { min: 60, max: 120 },
    respiratoryRate: { min: 10, max: 30 },
    sp02: { min: 95 },
    systolicBloodPressure: { min: 90 },
  },
];
*/
