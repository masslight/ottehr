// Stable fixture for tests that assert behavior of the bracket-lookup logic.
// Pinning to a fixed config keeps these tests independent of the per-instance
// vitals config that CI overlays via copy-config.
const VitalsConfig = {
  'vital-heartbeat': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'bpm', value: 57, criticality: 'abnormal' },
          { type: 'max', units: 'bpm', value: 100, criticality: 'abnormal' },
        ],
        minAge: { unit: 'years', value: 15 },
      },
    ],
  },
  'vital-respiration-rate': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: '', value: 25, criticality: 'abnormal' },
          { type: 'max', units: '', value: 60, criticality: 'abnormal' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 28, criticality: 'abnormal' },
          { type: 'max', units: '', value: 52, criticality: 'abnormal' },
        ],
        minAge: { unit: 'months', value: 2 },
        maxAge: { unit: 'months', value: 5 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 26, criticality: 'abnormal' },
          { type: 'max', units: '', value: 49, criticality: 'abnormal' },
        ],
        minAge: { unit: 'months', value: 5 },
        maxAge: { unit: 'months', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 11, criticality: 'abnormal' },
          { type: 'max', units: '', value: 21, criticality: 'abnormal' },
        ],
        minAge: { unit: 'months', value: 215 },
      },
    ],
  },
};

export default VitalsConfig;
