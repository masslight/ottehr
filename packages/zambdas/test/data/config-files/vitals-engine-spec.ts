const VitalsConfig = {
  'vital-temperature': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'celsius', value: 35, criticality: 'critical' },
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 38 },
          { type: 'max', units: 'celsius', value: 39, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 24 },
      },
    ],
  },
  'vital-heartbeat': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'bpm', value: 107, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 113 },
          { type: 'max', units: 'bpm', value: 171 },
          { type: 'max', units: 'bpm', value: 181, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 43, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 57 },
          { type: 'max', units: 'bpm', value: 100 },
          { type: 'max', units: 'bpm', value: 115, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 15 },
        maxAge: { unit: 'years', value: 18 },
      },
    ],
  },
  'vital-respiration-rate': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: '', value: 25, criticality: 'critical' },
          { type: 'min', units: '', value: 30 },
          { type: 'max', units: '', value: 60 },
          { type: 'max', units: '', value: 66, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 24, criticality: 'critical' },
          { type: 'min', units: '', value: 28 },
          { type: 'max', units: '', value: 52 },
          { type: 'max', units: '', value: 64, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 23, criticality: 'critical' },
          { type: 'min', units: '', value: 26 },
          { type: 'max', units: '', value: 49 },
          { type: 'max', units: '', value: 61, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 9 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 8, criticality: 'critical' },
          { type: 'min', units: '', value: 11 },
          { type: 'max', units: '', value: 21 },
          { type: 'max', units: '', value: 25, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 18 },
      },
    ],
  },
  'vital-blood-pressure': {
    components: {
      'systolic-pressure': {
        alertThresholds: [
          {
            rules: [
              { type: 'min', units: '', value: 55, criticality: 'critical' },
              { type: 'min', units: '', value: 60 },
              { type: 'max', units: '', value: 105 },
              { type: 'max', units: '', value: 115, criticality: 'critical' },
            ],
            minAge: { unit: 'months', value: 0 },
            maxAge: { unit: 'months', value: 3 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 76, criticality: 'critical' },
              { type: 'min', units: '', value: 81 },
              { type: 'max', units: '', value: 126 },
              { type: 'max', units: '', value: 140, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 3 },
            maxAge: { unit: 'years', value: 4 },
          },
        ],
      },
    },
  },
  'vital-weight': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'kg', value: 39, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 45 },
          { type: 'max', units: 'kg', value: 93 },
          { type: 'max', units: 'kg', value: 108, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 18 },
      },
    ],
  },
};

export default VitalsConfig;
