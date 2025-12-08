import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InputHTMLAttributes } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PATIENT_RECORD_CONFIG } from 'utils';
import { describe, expect, it, vi } from 'vitest';
import { PrimaryCareContainer } from './PrimaryCareContainer';

vi.mock('../InputMask', async () => {
  const React = await import('react');
  return {
    default: React.forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
      ({ onChange, value, ...rest }, ref) => {
        return <input ref={ref} {...rest} onChange={onChange} value={value} />;
      }
    ),
  };
});

const TestWrapper = ({
  children,
  defaultValues = {},
}: {
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
}): JSX.Element => {
  const TestForm = (): JSX.Element => {
    const methods = useForm({
      defaultValues: {
        [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.active.key]: true,
        [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.firstName.key]: '',
        [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.lastName.key]: '',
        [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.practiceName.key]: '',
        [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.address.key]: '',
        [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.phone.key]: '',
        ...defaultValues,
      },
    });

    return <FormProvider {...methods}>{children}</FormProvider>;
  };

  return <TestForm />;
};

const getFieldInput = (fieldTestId: string): HTMLInputElement =>
  screen.getByTestId(fieldTestId).querySelector('input') as HTMLInputElement;

describe('PrimaryCareContainer', () => {
  const user = userEvent.setup();

  const filledFieldValues = {
    [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.active.key]: true,
    [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.firstName.key]: 'Dr. Jane',
    [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.lastName.key]: 'Smith',
    [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.practiceName.key]: 'Family Medical Center',
    [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.address.key]: '123 Main St, AnyTown, ST 12345',
    [PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.phone.key]: '(555) 123-4567',
  };

  it('should display correct checkbox label', () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    expect(screen.getByText("Patient doesn't have a PCP at this time")).toBeInTheDocument();
  });

  it('should show and hide PCP form fields based on checkbox state', async () => {
    render(
      <TestWrapper>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    const pcpCheckbox = getFieldInput(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox);

    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.address)).toBeVisible();
    expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile)).toBeVisible();

    await user.click(pcpCheckbox);

    await waitFor(() => {
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.firstName)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.lastName)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.practiceName)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.address)).not.toBeVisible();
      expect(screen.getByTestId(dataTestIds.primaryCarePhysicianContainer.mobile)).not.toBeVisible();
    });
  });

  it('should preserve field values when checkbox is checked and unchecked', async () => {
    render(
      <TestWrapper defaultValues={filledFieldValues}>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    const pcpCheckbox = getFieldInput(dataTestIds.primaryCarePhysicianContainer.pcpCheckbox);

    expect(pcpCheckbox).toBeInTheDocument();
    expect(pcpCheckbox).not.toBeChecked();

    const firstNameInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.firstName);
    const lastNameInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.lastName);
    const practiceNameInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.practiceName);
    const addressInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.address);
    const mobileInput = getFieldInput(dataTestIds.primaryCarePhysicianContainer.mobile);

    expect(firstNameInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.firstName.key] as string
    );
    expect(lastNameInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.lastName.key] as string
    );
    expect(practiceNameInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.practiceName.key] as string
    );
    expect(addressInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.address.key] as string
    );
    expect(mobileInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.phone.key] as string
    );

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).toBeChecked();

    await waitFor(() => {
      expect(firstNameInput).not.toBeVisible();
      expect(lastNameInput).not.toBeVisible();
      expect(practiceNameInput).not.toBeVisible();
      expect(addressInput).not.toBeVisible();
      expect(mobileInput).not.toBeVisible();
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).not.toBeChecked();

    await waitFor(() => {
      expect(firstNameInput).toBeVisible();
      expect(lastNameInput).toBeVisible();
      expect(practiceNameInput).toBeVisible();
      expect(addressInput).toBeVisible();
      expect(mobileInput).toBeVisible();
    });

    expect(firstNameInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.firstName.key] as string
    );
    expect(lastNameInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.lastName.key] as string
    );
    expect(practiceNameInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.practiceName.key] as string
    );
    expect(addressInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.address.key] as string
    );
    expect(mobileInput).toHaveValue(
      filledFieldValues[PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items.phone.key] as string
    );
  });
});
