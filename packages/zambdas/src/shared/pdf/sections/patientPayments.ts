import { capitalize } from 'lodash';
import { formatDateForDisplay } from 'utils';
import { DataComposer } from '../pdf-common';
import { PatientPaymentsDataInput, PatientPaymentsInfo, PdfSection } from '../types';

export const composePatientPaymentsData: DataComposer<PatientPaymentsDataInput, PatientPaymentsInfo> = ({
  payments,
}) => {
  const paymentsInfo = payments.map((payment) => {
    const date = formatDateForDisplay(payment.dateISO);

    let label = '';
    if (payment.paymentMethod === 'card') {
      label = `XXXX - XXXX - XXXX - ${payment.cardLast4}`;
    } else {
      label = capitalize(payment.paymentMethod);
    }

    const amount = `$${payment.amountInCents / 100}`;

    return { date, label, amount };
  });

  return { payments: paymentsInfo };
};

export const createPatientPaymentsSection = <TData extends { paymentHistory?: PatientPaymentsInfo }>(): PdfSection<
  TData,
  PatientPaymentsInfo
> => ({
  title: 'Patient Payments',
  dataSelector: (data) => data.paymentHistory,
  render: (client, paymentHistory, styles) => {
    if (paymentHistory.payments.length === 0) {
      client.drawText('No payments recorded.', styles.textStyles.regular);
    } else {
      paymentHistory.payments.map((payment) => {
        client.drawTextSequential(`${payment.label} ${payment.date} ${payment.amount}`, styles.textStyles.regular);
      });
    }
  },
});
