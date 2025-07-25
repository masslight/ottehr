const VitalsConfig = {
  'vital-temperature': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36.5 },
          { type: 'max', units: 'celsius', value: 37.9 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 38.4 },
        ],
        minAge: { unit: 'months', value: 2 },
      },
    ],
  },
  'vital-heartbeat': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'bpm', value: 100 },
          { type: 'max', units: 'bpm', value: 200 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 80 },
          { type: 'max', units: 'bpm', value: 160 },
        ],
        minAge: { unit: 'months', value: 2 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 70 },
          { type: 'max', units: 'bpm', value: 150 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 36 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 150 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 72 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 140 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 108 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 130 },
        ],
        minAge: { unit: 'months', value: 108 },
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 60 },
          { type: 'max', units: 'bpm', value: 120 },
        ],
        minAge: { unit: 'months', value: 144 },
      },
    ],
  },
  'vital-respiration-rate': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: '', value: 30 },
          { type: 'max', units: '', value: 60 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 30 },
          { type: 'max', units: '', value: 60 },
        ],
        minAge: { unit: 'months', value: 2 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 50 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 36 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 40 },
        ],
        minAge: { unit: 'months', value: 36 },
        maxAge: { unit: 'months', value: 72 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 40 },
        ],
        minAge: { unit: 'months', value: 72 },
        maxAge: { unit: 'months', value: 108 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 30 },
        ],
        minAge: { unit: 'months', value: 108 },
        maxAge: { unit: 'months', value: 144 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 10 },
          { type: 'max', units: '', value: 30 },
        ],
        minAge: { unit: 'months', value: 144 },
      },
    ],
  },
  'vital-oxygen-sat': {
    alertThresholds: [
      {
        rules: [{ type: 'min', units: '', value: 95 }],
        minAge: { unit: 'months', value: 0 },
      },
    ],
  },
  'vital-blood-pressure': {
    components: {
      'systolic-pressure': {
        alertThresholds: [
          {
            rules: [{ type: 'min', units: '', value: 70 }],
            minAge: { unit: 'months', value: 0 },
            maxAge: { unit: 'months', value: 2 },
          },
          {
            rules: [{ type: 'min', units: '', ageFunction: (ageInYears: number) => 70 + ageInYears * 2 }],
            minAge: { unit: 'months', value: 2 },
            maxAge: { unit: 'months', value: 108 },
          },
        ],
      },
    },
  },
};

const ChartConfig = {
  components: {
    vitals: {
      components: VitalsConfig,
      // fields that control things like conditionally rendering components
    },
  },
  // meta fields that control things like conditionally rendering components
};

export default ChartConfig;
