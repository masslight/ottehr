const VitalsConfig = {
  'vital-heartbeat': {
    alertThresholds: [
      {
        rules: [
          // should be invalid, min age is greater than max age
          { type: 'max', units: 'bpm', value: 100, criticality: 'abnormal' },
          { type: 'min', units: 'bpm', value: 200, criticality: 'abnormal' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 2 },
      },
    ],
  },
};

const ChartConfig = {
  components: {
    vitals: {
      components: VitalsConfig,
    },
  },
};

export default ChartConfig;
