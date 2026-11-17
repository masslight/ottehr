import { render, screen } from '@testing-library/react';
import { FC } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/components/input/SelectInput', () => ({ SelectInput: () => <div /> }));

import { ADMINISTERED, NOT_ADMINISTERED, PARTLY_ADMINISTERED } from '../../src/features/immunization/common';
import { AdministrationConfirmationDialog } from '../../src/features/immunization/components/AdministrationConfirmationDialog';
import { ReasonListCodes } from '../../src/features/visits/in-person/components/medication-administration/medicationTypes';

const renderDialog = (
  administrationType: typeof ADMINISTERED,
  values: { reason?: string; otherReason?: string }
): void => {
  const Wrapper: FC = () => {
    const methods = useForm({ defaultValues: values });
    return (
      <FormProvider {...methods}>
        <AdministrationConfirmationDialog
          administrationType={administrationType}
          patientName="Pat"
          medicationName="Tdap"
          dose="0.5"
          unit="mL"
          route="IM"
          open
          handleClose={vi.fn()}
          handleConfirm={vi.fn()}
        />
      </FormProvider>
    );
  };
  render(<Wrapper />);
};

describe('AdministrationConfirmationDialog - other reason', () => {
  it.each([NOT_ADMINISTERED, PARTLY_ADMINISTERED])(
    'disables "Mark as $label" when the other reason is whitespace only',
    (administrationType) => {
      renderDialog(administrationType, { reason: ReasonListCodes.OTHER, otherReason: '  \n ' });

      expect(screen.getByRole('button', { name: `Mark as ${administrationType.label}` })).toBeDisabled();
    }
  );

  it('enables confirmation once the other reason has text', () => {
    renderDialog(NOT_ADMINISTERED, { reason: ReasonListCodes.OTHER, otherReason: ' Fainted ' });

    expect(screen.getByRole('button', { name: 'Mark as Not Administered' })).toBeEnabled();
  });

  it('ignores a blank other reason when a listed reason is selected', () => {
    renderDialog(NOT_ADMINISTERED, { reason: ReasonListCodes.PATIENT_REFUSED, otherReason: '   ' });

    expect(screen.getByRole('button', { name: 'Mark as Not Administered' })).toBeEnabled();
  });
});
