import { MEDICATIONS_OVERRIDES } from '../../../.ottehr_config';
import { InHouseMedicationInfo } from '../../types';
import { deepFreezeObject } from '../../utils';

const MEDICATIONS_DEFAULTS: { inHouseMedications: InHouseMedicationInfo[] } = {
  inHouseMedications: [
    { name: 'Acetaminophen (Liquid)', NDC: '50580-170-01', erxData: { id: '23562' } },
    { name: 'Acetaminophen (Tabs)', NDC: '71399-8024-1', erxData: { id: '23170' } },
    { name: 'Acetaminophen (80mg Suppository)', NDC: '51672-2114-2', erxData: { id: '23565' } },
    { name: 'Acetaminophen (325mg Suppository)', NDC: '51672-2116-2', erxData: { id: '23564' } },
    { name: 'Acetaminophen (120mg Suppository)', NDC: '45802-732-30', erxData: { id: '21887' } },
    { name: 'Activated Charcoal', NDC: '66689-203-04', erxData: { id: '32034' } },
    { name: 'Albuterol', NDC: '0487-9501-25', erxData: { id: '29518' } },
    { name: 'Ventolin HFA', NDC: '0173-0682-24', erxData: { id: '38526' } },
    { name: 'Amoxicillin', NDC: '0143-9887-01', erxData: { id: '34220' } },
    { name: 'Amoxicillin Clavulanate', NDC: '65862-535-75', erxData: { id: '22329' } },
  ],
};

export const MEDICATIONS_CONFIG = deepFreezeObject(MEDICATIONS_OVERRIDES || MEDICATIONS_DEFAULTS);
