import { LabOrderDTO } from 'utils';

export const DetailsWithResults: React.FC<{ labOrder?: LabOrderDTO }> = ({ labOrder }) => {
  return <div>DetailsWithResults {labOrder?.orderId}</div>;
};
