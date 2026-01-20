"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var VitalsConfig = {
    'vital-heartbeat': {
        alertThresholds: [
            {
                rules: [
                    // types are invalid, should be 'min' and 'max'
                    { type: 'min', units: 'bpm', value: 100, criticality: 'abnormal' },
                    { type: 'max', units: 'bpm', value: 200, criticality: 'abnormal' },
                ],
                minAge: { unit: 'decades', value: 1 },
            },
        ],
    },
};
exports.default = VitalsConfig;
