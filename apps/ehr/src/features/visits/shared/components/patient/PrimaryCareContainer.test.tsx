import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { InputHTMLAttributes } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
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

// Helper to get field input by config key (fields have id attribute matching their key)
const getFieldById = (fieldKey: string): HTMLElement => {
  const element = document.getElementById(fieldKey);
  if (!element) {
    throw new Error(`Element with id "${fieldKey}" not found`);
  }
  return element;
};

const getFieldInput = (fieldKey: string): HTMLInputElement => {
  // Query by name attribute (works for all field types including checkboxes)
  const input = document.querySelector(`input[name="${fieldKey}"]`);
  if (!input) {
    throw new Error(`Input with name "${fieldKey}" not found`);
  }
  return input as HTMLInputElement;
};

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

    const pcp = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;
    const pcpCheckbox = getFieldInput(pcp.active.key);

    // Initially, fields should be in the document
    expect(getFieldById(pcp.firstName.key)).toBeInTheDocument();
    expect(getFieldById(pcp.lastName.key)).toBeInTheDocument();
    expect(getFieldById(pcp.practiceName.key)).toBeInTheDocument();
    expect(getFieldById(pcp.address.key)).toBeInTheDocument();
    expect(getFieldById(pcp.phone.key)).toBeInTheDocument();

    await user.click(pcpCheckbox);

    // After clicking checkbox, fields should be removed from the document
    await waitFor(() => {
      expect(document.getElementById(pcp.firstName.key)).not.toBeInTheDocument();
      expect(document.getElementById(pcp.lastName.key)).not.toBeInTheDocument();
      expect(document.getElementById(pcp.practiceName.key)).not.toBeInTheDocument();
      expect(document.getElementById(pcp.address.key)).not.toBeInTheDocument();
      expect(document.getElementById(pcp.phone.key)).not.toBeInTheDocument();
    });
  });

  it('should preserve field values when checkbox is checked and unchecked', async () => {
    render(
      <TestWrapper defaultValues={filledFieldValues}>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    const pcp = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;
    const pcpCheckbox = getFieldInput(pcp.active.key);

    expect(pcpCheckbox).toBeInTheDocument();
    expect(pcpCheckbox).not.toBeChecked();

    const firstNameInput = getFieldInput(pcp.firstName.key);
    const lastNameInput = getFieldInput(pcp.lastName.key);
    const practiceNameInput = getFieldInput(pcp.practiceName.key);
    const addressInput = getFieldInput(pcp.address.key);
    const mobileInput = getFieldInput(pcp.phone.key);

    expect(firstNameInput).toHaveValue(filledFieldValues[pcp.firstName.key] as string);
    expect(lastNameInput).toHaveValue(filledFieldValues[pcp.lastName.key] as string);
    expect(practiceNameInput).toHaveValue(filledFieldValues[pcp.practiceName.key] as string);
    expect(addressInput).toHaveValue(filledFieldValues[pcp.address.key] as string);
    expect(mobileInput).toHaveValue(filledFieldValues[pcp.phone.key] as string);

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).toBeChecked();

    await waitFor(() => {
      expect(document.querySelector(`input[name="${pcp.firstName.key}"]`)).not.toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.lastName.key}"]`)).not.toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.practiceName.key}"]`)).not.toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.address.key}"]`)).not.toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.phone.key}"]`)).not.toBeInTheDocument();
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).not.toBeChecked();

    await waitFor(() => {
      expect(document.querySelector(`input[name="${pcp.firstName.key}"]`)).toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.lastName.key}"]`)).toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.practiceName.key}"]`)).toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.address.key}"]`)).toBeInTheDocument();
      expect(document.querySelector(`input[name="${pcp.phone.key}"]`)).toBeInTheDocument();
    });

    // Get fresh references after fields are re-rendered
    const refreshedFirstNameInput = getFieldInput(pcp.firstName.key);
    const refreshedLastNameInput = getFieldInput(pcp.lastName.key);
    const refreshedPracticeNameInput = getFieldInput(pcp.practiceName.key);
    const refreshedAddressInput = getFieldInput(pcp.address.key);
    const refreshedMobileInput = getFieldInput(pcp.phone.key);

    expect(refreshedFirstNameInput).toHaveValue(filledFieldValues[pcp.firstName.key] as string);
    expect(refreshedLastNameInput).toHaveValue(filledFieldValues[pcp.lastName.key] as string);
    expect(refreshedPracticeNameInput).toHaveValue(filledFieldValues[pcp.practiceName.key] as string);
    expect(refreshedAddressInput).toHaveValue(filledFieldValues[pcp.address.key] as string);
    expect(refreshedMobileInput).toHaveValue(filledFieldValues[pcp.phone.key] as string);
  });
});
