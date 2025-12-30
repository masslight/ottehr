import { Coding } from 'fhir/r4b';
import { customRadiologyStudiesConfig } from '../../../ottehr-config-overrides/radiology';

export type RadiologyStudy = Pick<Coding, 'code' | 'display'>;

export const baseRadiologyStudiesConfig: RadiologyStudy[] = [
  { code: '71045', display: 'X-ray of chest, 1 view' },
  { code: '71046', display: 'X-ray of chest, 2 views' },
  { code: '74018', display: 'X-ray of abdomen, 1 view' },
  { code: '74019', display: 'X-ray of abdomen, 2 views' },
  { code: '76010', display: 'X-ray from nose to rectum' },
  { code: '73000', display: 'X-ray of collar bone' },
  { code: '73010', display: 'X-ray of shoulder blade' },
  { code: '73020', display: 'X-ray of shoulder, 1 view' },
  { code: '73060', display: 'X-ray of upper arm, minimum of 2 views' },
  { code: '73070', display: 'X-ray of elbow, 2 views' },
  { code: '73090', display: 'X-ray of forearm, 2 views' },
  { code: '73100', display: 'X-ray of wrist, 2 views' },
  { code: '73120', display: 'X-ray of hand, 2 views' },
  { code: '73140', display: 'X-ray of finger, minimum of 2 views' },
  { code: '72170', display: 'X-ray of pelvis, 1-2 views' },
  { code: '73552', display: 'X-ray of thigh bone, minimum 2 views' },
  { code: '73560', display: 'X-ray of knee, 1-2 views' },
  { code: '73590', display: 'X-ray of lower leg, 2 views' },
  { code: '73600', display: 'X-ray of ankle, 2 views' },
  { code: '73610', display: 'X-ray of ankle, minimum of 3 views' },
  { code: '73620', display: 'X-ray of foot, 2 views' },
  { code: '73630', display: 'X-ray of foot, minimum of 3 views' },
  { code: '73660', display: 'X-ray of toe, minimum of 2 views' },
];

export const radiologyStudiesConfig = customRadiologyStudiesConfig || baseRadiologyStudiesConfig;
