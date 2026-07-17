import { ChargeItemDefinitionDefault, ChargeItemDefinitionType } from 'utils';

export type CIDDefaultInputValue = ChargeItemDefinitionDefault | '';

export const ChargeItemDefinitionLabels: Record<
  ChargeItemDefinitionType,
  {
    listTitle: string;
    listText: string;
    singularTitle: string;
    singularText: string;
    addButton: string;
    pathComponent: string;
  }
> = {
  'charge-master': {
    listTitle: 'Charge Masters',
    listText: 'charge masters',
    singularTitle: 'Charge Master',
    singularText: 'charge master',
    addButton: 'Add Charge Master',
    pathComponent: 'charge-masters',
  },
  'fee-schedule': {
    listTitle: 'Fee Schedules',
    listText: 'fee schedules',
    singularTitle: 'Fee Schedule',
    singularText: 'fee schedule',
    addButton: 'Add Fee Schedule',
    pathComponent: 'fee-schedules',
  },
};

export function formatChargeItemDefinitionDefault(def?: ChargeItemDefinitionDefault): string {
  if (!def) {
    return '';
  }
  if (def === 'insurance') {
    return 'Insurance';
  }
  return 'Self-Pay';
}
