"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var VitalsConfig = {
    'vital-heartbeat': {
        alertThresholds: [
            {
                rules: [
                    // types are invalid, should be 'min' and 'max'
                    { type: 'man', units: 'bpm', value: 100, criticality: 'abnormal' },
                    { type: 'mix', units: 'bpm', value: 200, criticality: 'abnormal' },
                ],
                minAge: { unit: 'months', value: 0 },
                maxAge: { unit: 'months', value: 2 },
            },
        ],
    },
};
exports.default = VitalsConfig;
