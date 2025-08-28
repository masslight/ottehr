import { DateTime } from 'luxon';
import { ImmunizationOrder } from 'utils';

export interface AdministrationType {
  type: string;
  label: string;
}

export const ADMINISTERED: AdministrationType = {
  type: 'administered',
  label: 'Administered',
};

export const NOT_ADMINISTERED: AdministrationType = {
  type: 'administered-not',
  label: 'Not Administered',
};

export const PARTLY_ADMINISTERED: AdministrationType = {
  type: 'administered-partly',
  label: 'Partly Administered',
};

export function ordersRecentFirstComparator(orderA: ImmunizationOrder, orderB: ImmunizationOrder): number {
  return (
    DateTime.fromISO(orderB.details.orderedDateTime).toMillis() -
    DateTime.fromISO(orderA.details.orderedDateTime).toMillis()
  );
}
