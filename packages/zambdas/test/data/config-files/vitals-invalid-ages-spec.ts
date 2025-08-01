const VitalsConfig = {
  'vital-blood-pressure': {
    components: {
      'systolic-pressure': {
        alertThresholds: [
          {
            rules: [{ type: 'min', units: '', value: 70, criticality: 'abnormal' }],
            minAge: { unit: 'months', value: 2 }, // this is an invalid configuration, so parsing this should fail
            maxAge: { unit: 'months', value: 0 },
          },
        ],
      },
    },
  },
};

export default VitalsConfig;
