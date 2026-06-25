import * as z from 'zod';
import { VitalAlertCriticality, VitalBloodPressureComponents, VitalVisionComponents } from '../../types/api';

export const VitalsConfigData = {
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
      {
        rules: [
          { type: 'min', units: 'celsius', value: 35, criticality: 'critical' },
          { type: 'min', units: 'celsius', value: 36 },
          { type: 'max', units: 'celsius', value: 38 },
          { type: 'max', units: 'celsius', value: 41, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 24 },
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
          { type: 'min', units: 'bpm', value: 104, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 108 },
          { type: 'max', units: 'bpm', value: 167 },
          { type: 'max', units: 'bpm', value: 175, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 98, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 104 },
          { type: 'max', units: 'bpm', value: 160 },
          { type: 'max', units: 'bpm', value: 168, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 9 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 93, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 101 },
          { type: 'max', units: 'bpm', value: 150 },
          { type: 'max', units: 'bpm', value: 161, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 88, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 97 },
          { type: 'max', units: 'bpm', value: 148 },
          { type: 'max', units: 'bpm', value: 156, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 18 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 82, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 92 },
          { type: 'max', units: 'bpm', value: 142 },
          { type: 'max', units: 'bpm', value: 149, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 24 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 76, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 87 },
          { type: 'max', units: 'bpm', value: 135 },
          { type: 'max', units: 'bpm', value: 142, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 2 },
        maxAge: { unit: 'years', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 70, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 82 },
          { type: 'max', units: 'bpm', value: 130 },
          { type: 'max', units: 'bpm', value: 136, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 3 },
        maxAge: { unit: 'years', value: 4 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 65, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 77 },
          { type: 'max', units: 'bpm', value: 124 },
          { type: 'max', units: 'bpm', value: 131, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 4 },
        maxAge: { unit: 'years', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 59, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 71 },
          { type: 'max', units: 'bpm', value: 117 },
          { type: 'max', units: 'bpm', value: 123, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 6 },
        maxAge: { unit: 'years', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 52, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 66 },
          { type: 'max', units: 'bpm', value: 109 },
          { type: 'max', units: 'bpm', value: 115, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 8 },
        maxAge: { unit: 'years', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'bpm', value: 47, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 61 },
          { type: 'max', units: 'bpm', value: 102 },
          { type: 'max', units: 'bpm', value: 108, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 12 },
        maxAge: { unit: 'years', value: 15 },
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
      {
        rules: [
          { type: 'min', units: 'bpm', value: 40, criticality: 'critical' },
          { type: 'min', units: 'bpm', value: 57 },
          { type: 'max', units: 'bpm', value: 100 },
          { type: 'max', units: 'bpm', value: 115, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 18 },
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
          { type: 'min', units: '', value: 22, criticality: 'critical' },
          { type: 'min', units: '', value: 24 },
          { type: 'max', units: '', value: 46 },
          { type: 'max', units: '', value: 58, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 21, criticality: 'critical' },
          { type: 'min', units: '', value: 23 },
          { type: 'max', units: '', value: 43 },
          { type: 'max', units: '', value: 53, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 18 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 19, criticality: 'critical' },
          { type: 'min', units: '', value: 21 },
          { type: 'max', units: '', value: 40 },
          { type: 'max', units: '', value: 46, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 24 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 18, criticality: 'critical' },
          { type: 'min', units: '', value: 20 },
          { type: 'max', units: '', value: 36 },
          { type: 'max', units: '', value: 38, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 2 },
        maxAge: { unit: 'years', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 17, criticality: 'critical' },
          { type: 'min', units: '', value: 19 },
          { type: 'max', units: '', value: 31 },
          { type: 'max', units: '', value: 33, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 3 },
        maxAge: { unit: 'years', value: 4 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 17, criticality: 'critical' },
          { type: 'min', units: '', value: 18 },
          { type: 'max', units: '', value: 28 },
          { type: 'max', units: '', value: 29, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 4 },
        maxAge: { unit: 'years', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 16, criticality: 'critical' },
          { type: 'min', units: '', value: 17 },
          { type: 'max', units: '', value: 25 },
          { type: 'max', units: '', value: 27, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 6 },
        maxAge: { unit: 'years', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 14, criticality: 'critical' },
          { type: 'min', units: '', value: 16 },
          { type: 'max', units: '', value: 23 },
          { type: 'max', units: '', value: 25, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 8 },
        maxAge: { unit: 'years', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 12, criticality: 'critical' },
          { type: 'min', units: '', value: 15 },
          { type: 'max', units: '', value: 22 },
          { type: 'max', units: '', value: 25, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 12 },
        maxAge: { unit: 'years', value: 15 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 11, criticality: 'critical' },
          { type: 'min', units: '', value: 14 },
          { type: 'max', units: '', value: 21 },
          { type: 'max', units: '', value: 25, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 15 },
        maxAge: { unit: 'years', value: 18 },
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
  'vital-oxygen-sat': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: '', value: 88, criticality: 'critical' },
          { type: 'min', units: '', value: 91 },
          { type: 'max', units: '', value: 101 },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 89, criticality: 'critical' },
          { type: 'min', units: '', value: 92 },
          { type: 'max', units: '', value: 101 },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'years', value: 18 },
      },
      {
        rules: [
          { type: 'min', units: '', value: 90, criticality: 'critical' },
          { type: 'min', units: '', value: 95 },
          { type: 'max', units: '', value: 101 },
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
              { type: 'min', units: '', value: 60, criticality: 'critical' },
              { type: 'min', units: '', value: 65 },
              { type: 'max', units: '', value: 110 },
              { type: 'max', units: '', value: 120, criticality: 'critical' },
            ],
            minAge: { unit: 'months', value: 3 },
            maxAge: { unit: 'months', value: 6 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 65, criticality: 'critical' },
              { type: 'min', units: '', value: 70 },
              { type: 'max', units: '', value: 115 },
              { type: 'max', units: '', value: 120, criticality: 'critical' },
            ],
            minAge: { unit: 'months', value: 6 },
            maxAge: { unit: 'months', value: 9 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 68, criticality: 'critical' },
              { type: 'min', units: '', value: 73 },
              { type: 'max', units: '', value: 118 },
              { type: 'max', units: '', value: 130, criticality: 'critical' },
            ],
            minAge: { unit: 'months', value: 9 },
            maxAge: { unit: 'months', value: 12 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 70, criticality: 'critical' },
              { type: 'min', units: '', value: 75 },
              { type: 'max', units: '', value: 120 },
              { type: 'max', units: '', value: 130, criticality: 'critical' },
            ],
            minAge: { unit: 'months', value: 12 },
            maxAge: { unit: 'months', value: 18 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 72, criticality: 'critical' },
              { type: 'min', units: '', value: 77 },
              { type: 'max', units: '', value: 122 },
              { type: 'max', units: '', value: 130, criticality: 'critical' },
            ],
            minAge: { unit: 'months', value: 18 },
            maxAge: { unit: 'months', value: 24 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 74, criticality: 'critical' },
              { type: 'min', units: '', value: 79 },
              { type: 'max', units: '', value: 124 },
              { type: 'max', units: '', value: 140, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 2 },
            maxAge: { unit: 'years', value: 3 },
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
          {
            rules: [
              { type: 'min', units: '', value: 78, criticality: 'critical' },
              { type: 'min', units: '', value: 83 },
              { type: 'max', units: '', value: 128 },
              { type: 'max', units: '', value: 140, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 4 },
            maxAge: { unit: 'years', value: 6 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 82, criticality: 'critical' },
              { type: 'min', units: '', value: 87 },
              { type: 'max', units: '', value: 130 },
              { type: 'max', units: '', value: 150, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 6 },
            maxAge: { unit: 'years', value: 8 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 86, criticality: 'critical' },
              { type: 'min', units: '', value: 91 },
              { type: 'max', units: '', value: 130 },
              { type: 'max', units: '', value: 150, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 8 },
            maxAge: { unit: 'years', value: 12 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 90, criticality: 'critical' },
              { type: 'min', units: '', value: 97 },
              { type: 'max', units: '', value: 130 },
              { type: 'max', units: '', value: 160, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 12 },
            maxAge: { unit: 'years', value: 15 },
          },
          {
            rules: [
              { type: 'min', units: '', value: 90, criticality: 'critical' },
              { type: 'min', units: '', value: 100 },
              { type: 'max', units: '', value: 130 },
              { type: 'max', units: '', value: 180, criticality: 'critical' },
            ],
            minAge: { unit: 'years', value: 15 },
          },
        ],
      },
    },
  },
  'vital-weight': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'kg', value: 2.4, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 2.8 },
          { type: 'max', units: 'kg', value: 7.1 },
          { type: 'max', units: 'kg', value: 7.9, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 4.8, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 5.5 },
          { type: 'max', units: 'kg', value: 9.6 },
          { type: 'max', units: 'kg', value: 10.5, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 5.9, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 6.7 },
          { type: 'max', units: 'kg', value: 11 },
          { type: 'max', units: 'kg', value: 12, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 9 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 6.6, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 7.5 },
          { type: 'max', units: 'kg', value: 12.3 },
          { type: 'max', units: 'kg', value: 13.5, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 7.1, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 7.9 },
          { type: 'max', units: 'kg', value: 14.2 },
          { type: 'max', units: 'kg', value: 15.6, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 18 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 7.9, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 8.8 },
          { type: 'max', units: 'kg', value: 15.4 },
          { type: 'max', units: 'kg', value: 17, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 24 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 9.6, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 10.8 },
          { type: 'max', units: 'kg', value: 18 },
          { type: 'max', units: 'kg', value: 20, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 2 },
        maxAge: { unit: 'years', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 10.1, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 11.4 },
          { type: 'max', units: 'kg', value: 21.5 },
          { type: 'max', units: 'kg', value: 24, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 3 },
        maxAge: { unit: 'years', value: 4 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 11.6, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 13.2 },
          { type: 'max', units: 'kg', value: 27.5 },
          { type: 'max', units: 'kg', value: 31.5, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 4 },
        maxAge: { unit: 'years', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 13.8, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 15.8 },
          { type: 'max', units: 'kg', value: 37 },
          { type: 'max', units: 'kg', value: 43, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 6 },
        maxAge: { unit: 'years', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 17, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 19.5 },
          { type: 'max', units: 'kg', value: 58 },
          { type: 'max', units: 'kg', value: 68, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 8 },
        maxAge: { unit: 'years', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 22.5, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 26.5 },
          { type: 'max', units: 'kg', value: 80 },
          { type: 'max', units: 'kg', value: 93, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 12 },
        maxAge: { unit: 'years', value: 15 },
      },
      {
        rules: [
          { type: 'min', units: 'kg', value: 32, criticality: 'critical' },
          { type: 'min', units: 'kg', value: 37.5 },
          { type: 'max', units: 'kg', value: 91 },
          { type: 'max', units: 'kg', value: 105, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 15 },
        maxAge: { unit: 'years', value: 18 },
      },
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
  'vital-height': {
    alertThresholds: [
      {
        rules: [
          { type: 'min', units: 'cm', value: 40, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 45 },
          { type: 'max', units: 'cm', value: 64 },
          { type: 'max', units: 'cm', value: 66, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 0 },
        maxAge: { unit: 'months', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 52, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 56.4 },
          { type: 'max', units: 'cm', value: 70.8 },
          { type: 'max', units: 'cm', value: 74, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 3 },
        maxAge: { unit: 'months', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 56, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 61.8 },
          { type: 'max', units: 'cm', value: 75.8 },
          { type: 'max', units: 'cm', value: 79, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 6 },
        maxAge: { unit: 'months', value: 9 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 61, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 66 },
          { type: 'max', units: 'cm', value: 80 },
          { type: 'max', units: 'cm', value: 83, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 9 },
        maxAge: { unit: 'months', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 64, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 69.5 },
          { type: 'max', units: 'cm', value: 86.9 },
          { type: 'max', units: 'cm', value: 89, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 12 },
        maxAge: { unit: 'months', value: 18 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 69, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 75.4 },
          { type: 'max', units: 'cm', value: 92.6 },
          { type: 'max', units: 'cm', value: 95, criticality: 'critical' },
        ],
        minAge: { unit: 'months', value: 18 },
        maxAge: { unit: 'months', value: 24 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 74, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 79.3 },
          { type: 'max', units: 'cm', value: 100.6 },
          { type: 'max', units: 'cm', value: 105, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 2 },
        maxAge: { unit: 'years', value: 3 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 80, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 87.8 },
          { type: 'max', units: 'cm', value: 108.3 },
          { type: 'max', units: 'cm', value: 113, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 3 },
        maxAge: { unit: 'years', value: 4 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 87, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 94 },
          { type: 'max', units: 'cm', value: 123.3 },
          { type: 'max', units: 'cm', value: 127, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 4 },
        maxAge: { unit: 'years', value: 6 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 98, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 106.9 },
          { type: 'max', units: 'cm', value: 130.4 },
          { type: 'max', units: 'cm', value: 143, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 6 },
        maxAge: { unit: 'years', value: 8 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 108, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 118.5 },
          { type: 'max', units: 'cm', value: 155.1 },
          { type: 'max', units: 'cm', value: 163, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 8 },
        maxAge: { unit: 'years', value: 12 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 118, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 125 },
          { type: 'max', units: 'cm', value: 176.5 },
          { type: 'max', units: 'cm', value: 182, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 12 },
        maxAge: { unit: 'years', value: 15 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 122, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 130 },
          { type: 'max', units: 'cm', value: 187.8 },
          { type: 'max', units: 'cm', value: 195, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 15 },
        maxAge: { unit: 'years', value: 18 },
      },
      {
        rules: [
          { type: 'min', units: 'cm', value: 122, criticality: 'critical' },
          { type: 'min', units: 'cm', value: 152.5 },
          { type: 'max', units: 'cm', value: 188 },
          { type: 'max', units: 'cm', value: 206, criticality: 'critical' },
        ],
        minAge: { unit: 'years', value: 18 },
      },
    ],
  },
};

const AgeSchema = z.object({
  unit: z.enum(['years', 'months', 'days']),
  value: z.number().int().nonnegative(),
});

function ageToDays(age: z.infer<typeof AgeSchema>): number {
  switch (age.unit) {
    case 'years':
      return age.value * 365;
    case 'months':
      return age.value * 30;
    case 'days':
      return age.value;
  }
}
const BaseConstraintSchema = z.object({
  type: z.enum(['min', 'max']),
  units: z.string().optional(),
  criticality: z.nativeEnum(VitalAlertCriticality).default(VitalAlertCriticality.Abnormal),
});
const ValueConstraintSchema = BaseConstraintSchema.extend({
  value: z.number(),
});
const AgeFunctionConstraintSchema = BaseConstraintSchema.extend({
  ageFunction: z.function().args(z.number()).returns(z.number()),
});
const AgeSexFunctionConstraintSchema = BaseConstraintSchema.extend({
  ageSexFunction: z
    .function()
    .args(z.number(), z.enum(['male', 'female']))
    .returns(z.number()),
});

export const ConstraintSchema = z
  .union([ValueConstraintSchema, AgeFunctionConstraintSchema, AgeSexFunctionConstraintSchema])
  .refine(
    (data) => {
      // Ensure that if a value is provided, it is a number
      if ('value' in data) {
        return typeof data.value === 'number';
      } else if ('ageFunction' in data || 'ageSexFunction' in data) {
        return true;
      } else {
        return false;
      }
    },
    { message: 'Constraint must have either a value or an ageFunction' }
  );
const AlertThresholdSchema = z
  .object({
    rules: z.array(ConstraintSchema).refine(
      (rulesList) => {
        const conflict = rulesList.some((rule, idx) => {
          const otherRules = rulesList.slice(idx + 1);
          const conflictingRule = otherRules.some((otherRule) => {
            if (rule.type === 'min' && otherRule.type === 'max' && 'value' in rule && 'value' in otherRule) {
              return rule.units === otherRule.units && rule.value > otherRule.value;
            }
            if (rule.type === 'max' && otherRule.type === 'min' && 'value' in rule && 'value' in otherRule) {
              return rule.units === otherRule.units && rule.value < otherRule.value;
            }
            if (
              rule.type === otherRule.type &&
              'value' in rule &&
              'value' in otherRule &&
              rule.criticality === otherRule.criticality
            ) {
              return rule.units === otherRule.units && rule.value !== otherRule.value;
            }
            return false;
          });
          if (conflictingRule) {
            return true;
          }
          return false;
        });
        return !conflict;
      },
      { message: 'Conflicting rules found' }
    ),
    minAge: AgeSchema.optional(),
    maxAge: AgeSchema.optional(),
  })
  .refine(
    (data) => {
      if (data.minAge && data.maxAge) {
        return ageToDays(data.minAge) <= ageToDays(data.maxAge);
      }
      return true;
    },
    { message: 'minAge must be less than or equal to maxAge in an alert threshold' }
  );

// this can be expanded to include things like out-of-range / invalid values
const VitalsObjectSchema = z.object({
  alertThresholds: z.array(AlertThresholdSchema).optional(),
});
const VitalsVisionSchema = VitalsObjectSchema.extend({
  components: z.record(z.nativeEnum(VitalVisionComponents), VitalsObjectSchema),
}).refine(
  (data) => {
    if (data.alertThresholds) {
      return false;
    }
    return true;
  },
  { message: 'vital-vision object may only define components' }
);
const VitalsBloodPressureSchema = VitalsObjectSchema.extend({
  components: z.record(z.nativeEnum(VitalBloodPressureComponents), VitalsObjectSchema),
}).refine(
  (data) => {
    if (data.alertThresholds) {
      return false;
    }
    return true;
  },
  { message: 'vital-blood-pressure object may only define components' }
);

const VitalsWeightSchema = VitalsObjectSchema.extend({
  unit: z
    .enum(['kg', 'lbs'] as const)
    .optional()
    .default('kg'),
});

export const VitalsMap = z.object({
  'vital-temperature': VitalsObjectSchema.optional(),
  'vital-heartbeat': VitalsObjectSchema.optional(),
  'vital-oxygen-sat': VitalsObjectSchema.optional(),
  'vital-respiration-rate': VitalsObjectSchema.optional(),
  'vital-weight': VitalsWeightSchema.optional().default({ unit: 'kg' }),
  'vital-height': VitalsObjectSchema.optional(),
  'vital-blood-pressure': VitalsBloodPressureSchema.optional(),
  'vital-vision': VitalsVisionSchema.optional(),
});

export const DefaultVitalsConfig = Object.freeze(VitalsMap.parse(VitalsConfigData));

export type VitalsSchema = z.infer<typeof VitalsMap>;

export const VitalsDef = (config?: any): VitalsSchema => {
  if (config) {
    return Object.freeze(VitalsMap.parse(config));
  }
  return DefaultVitalsConfig;
};

export type AlertThreshold = z.infer<typeof AlertThresholdSchema>;

export type AlertRule = ReturnType<typeof ConstraintSchema.parse>;

export const vitalsConfig = VitalsDef();
