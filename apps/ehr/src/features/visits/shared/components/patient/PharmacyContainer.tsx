import { FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { FormTextField } from 'src/components/form';
import { Row, Section } from 'src/components/layout';
import { FormFields } from 'src/constants';

const fields = FormFields.preferredPharmacy;

export const PharmacyContainer: FC<{ isLoading: boolean }> = ({ isLoading }) => {
  const { control } = useFormContext();

  return (
    <Section title="Preferred pharmacy">
      <Row label={fields.name.label} inputId={fields.name.key}>
        <FormTextField name={fields.name.key} control={control} id={fields.name.key} disabled={isLoading} />
      </Row>
      <Row label={fields.address.label} inputId={fields.address.key}>
        <FormTextField name={fields.address.key} control={control} id={fields.address.key} disabled={isLoading} />
      </Row>
    </Section>
  );
};
