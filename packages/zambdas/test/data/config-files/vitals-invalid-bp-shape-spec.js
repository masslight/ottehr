"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var VitalsConfig = {
    'vital-blood-pressure': {
        components: {
            'systolic-pressure': {
                alertThresholds: [
                    {
                        rules: [{ type: 'min', units: '', value: 70, criticality: 'abnormal' }],
                        minAge: { unit: 'months', value: 0 },
                        maxAge: { unit: 'months', value: 2 },
                    },
                ],
            },
            'diastolic-pressure': {
                alertThresholds: [
                    {
                        rules: [{ type: 'min', units: '', value: 70, criticality: 'abnormal' }],
                        minAge: { unit: 'months', value: 0 },
                        maxAge: { unit: 'months', value: 2 },
                    },
                ],
            },
        },
        // this needs to be embedded in the components as either systolic or diastolic, so it is invalid
        alertThresholds: [
            {
                rules: [{ type: 'min', units: '', value: 70 }],
                minAge: { unit: 'months', value: 0 },
                maxAge: { unit: 'months', value: 2 },
            },
            {
                rules: [{ type: 'min', units: '', ageFunction: function (ageInYears) { return 70 + ageInYears * 2; } }],
                minAge: { unit: 'months', value: 2 },
                maxAge: { unit: 'months', value: 108 },
            },
            {
                rules: [{ type: 'min', units: '', value: 90 }],
                minAge: { unit: 'months', value: 108 },
            },
        ],
    },
};
exports.default = VitalsConfig;
