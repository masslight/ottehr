import {
  DME_LATERALITY_LABELS,
  DME_MODIFIER_LABELS,
  DME_ORDER_STATUS_LABELS,
  DmeOrderDTO,
  formatDmeBillingCode,
  formatDmeDuration,
} from 'utils/lib/types/api/dme.types';
import { DataComposer } from '../../pdf-common';
import { DmeOrdersData, PdfSection } from '../../types';
import { createTitledLinesSection } from '../titledLines';

export const composeDmeOrders: DataComposer<{ dmeOrders?: DmeOrderDTO[] }, DmeOrdersData> = ({ dmeOrders }) => ({
  dmeOrders: (dmeOrders ?? []).map((order) => {
    const details = [
      `Qty: ${order.quantity}`,
      order.laterality && `Laterality: ${DME_LATERALITY_LABELS[order.laterality]}`,
      order.modifier && `Modifier: ${DME_MODIFIER_LABELS[order.modifier]}`,
      order.duration && `Duration: ${formatDmeDuration(order.duration)}`,
    ].filter(Boolean);
    const lines = [
      `Status: ${DME_ORDER_STATUS_LABELS[order.status]}`,
      details.join(' | '),
      order.billingCodes.length ? `HCPCS: ${order.billingCodes.map(formatDmeBillingCode).join('; ')}` : undefined,
      order.diagnoses.length ? `Dx: ${order.diagnoses.map((dx) => `${dx.code} ${dx.display}`).join('; ')}` : undefined,
      order.external && order.thirdParty?.name ? `Third party: ${order.thirdParty.name}` : undefined,
      order.instructions?.trim() ? `Instructions: ${order.instructions.trim()}` : undefined,
    ].filter((line): line is string => !!line);
    return { itemName: order.itemName, lines };
  }),
});

export const createDmeOrdersSection = <TData extends { dmeOrders?: DmeOrdersData }>(): PdfSection<
  TData,
  DmeOrdersData
> =>
  createTitledLinesSection({
    title: 'Durable Medical Equipment',
    dataSelector: (data: TData) => data.dmeOrders,
    blocks: (data) => data.dmeOrders.map((order) => ({ title: order.itemName, lines: order.lines })),
  });
