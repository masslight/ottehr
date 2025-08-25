import { DateTime } from 'luxon';
import { ImmunizationOrder } from 'utils';

export function ordersRecentFirstComparator(orderA: ImmunizationOrder, orderB: ImmunizationOrder): number {
  return (
    DateTime.fromISO(orderB.details.orderedDateTime).toMillis() -
    DateTime.fromISO(orderA.details.orderedDateTime).toMillis()
  );
}
