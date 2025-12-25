import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { type InputHTMLAttributes } from 'react';
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

interface TestWrapperProps {
  children: React.ReactNode;
  defaultValues?: Record<string, any>;
  onFormReady?: (methods: ReturnType<typeof useForm>) => void;
}

const TestWrapper = ({ children, defaultValues = {}, onFormReady }: TestWrapperProps): JSX.Element => {
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

    React.useEffect(() => {
      if (onFormReady) {
        onFormReady(methods);
      }
    }, [methods]);

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

// Helper to get conditionally rendered fields from config
const getConditionallyRenderedFields = (
  items: Record<string, any>,
  controlFieldKey: string
): { key: string; label: string; shouldBeRequired: boolean }[] => {
  return Object.values(items)
    .filter((item) => {
      // Field must have triggers
      if (!item.triggers || item.triggers.length === 0) return false;

      // Field must have disabledDisplay: 'hidden'
      if (item.disabledDisplay !== 'hidden') return false;

      // At least one trigger must target the control field
      return item.triggers.some((trigger: any) => trigger.targetQuestionLinkId === controlFieldKey);
    })
    .map((item) => {
      // Check if any trigger targeting the control field has 'require' effect
      const shouldBeRequired = item.triggers.some(
        (trigger: any) => trigger.targetQuestionLinkId === controlFieldKey && trigger.effect.includes('require')
      );
      return { key: item.key, label: item.label, shouldBeRequired };
    });
};

describe('PrimaryCareContainer', () => {
  const user = userEvent.setup();

  const pcp = PATIENT_RECORD_CONFIG.FormFields.primaryCarePhysician.items;

  // Build filled field values from config
  const conditionalFields = getConditionallyRenderedFields(pcp, pcp.active.key);
  const testFieldValues: Record<string, string> = {
    [pcp.firstName.key]: 'Dr. Jane',
    [pcp.lastName.key]: 'Smith',
    [pcp.practiceName.key]: 'Family Medical Center',
    [pcp.address.key]: '123 Main St, AnyTown, ST 12345',
    [pcp.phone.key]: '(555) 123-4567',
  };

  const filledFieldValues = {
    [pcp.active.key]: true,
    ...testFieldValues,
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

    // Get the list of conditionally rendered fields from config
    const conditionalFields = getConditionallyRenderedFields(pcp, pcp.active.key);

    // Initially, all conditional fields should be in the document
    conditionalFields.forEach((field) => {
      expect(getFieldById(field.key)).toBeInTheDocument();
    });

    await user.click(pcpCheckbox);

    // After clicking checkbox, all conditional fields should be removed from the document
    await waitFor(() => {
      conditionalFields.forEach((field) => {
        expect(document.getElementById(field.key)).not.toBeInTheDocument();
      });
    });
  });

  it('should preserve field values when checkbox is checked and unchecked', async () => {
    render(
      <TestWrapper defaultValues={filledFieldValues}>
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    const pcpCheckbox = getFieldInput(pcp.active.key);

    expect(pcpCheckbox).toBeInTheDocument();
    expect(pcpCheckbox).not.toBeChecked();

    // Verify initial values for all conditional fields
    conditionalFields.forEach((field) => {
      const input = getFieldInput(field.key);
      expect(input).toHaveValue(testFieldValues[field.key]);
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).toBeChecked();

    // All conditional fields should be removed from the document
    await waitFor(() => {
      conditionalFields.forEach((field) => {
        expect(document.querySelector(`input[name="${field.key}"]`)).not.toBeInTheDocument();
      });
    });

    await user.click(pcpCheckbox);
    expect(pcpCheckbox).not.toBeChecked();

    // All conditional fields should be back in the document
    await waitFor(() => {
      conditionalFields.forEach((field) => {
        expect(document.querySelector(`input[name="${field.key}"]`)).toBeInTheDocument();
      });
    });

    // Verify values are preserved after fields are re-rendered
    conditionalFields.forEach((field) => {
      const refreshedInput = getFieldInput(field.key);
      expect(refreshedInput).toHaveValue(testFieldValues[field.key]);
    });
  });

  it('should validate required fields based on config triggers', async () => {
    let formMethods: ReturnType<typeof useForm> | null = null;

    render(
      <TestWrapper
        onFormReady={(methods) => {
          formMethods = methods;
        }}
      >
        <PrimaryCareContainer isLoading={false} />
      </TestWrapper>
    );

    // Wait for form to be ready
    await waitFor(() => {
      expect(formMethods).not.toBeNull();
    });

    const pcpCheckbox = getFieldInput(pcp.active.key);
    expect(pcpCheckbox).not.toBeChecked(); // Fields should be visible and potentially required

    // Test each conditional field based on its config
    for (const field of conditionalFields) {
      const input = getFieldInput(field.key);

      // Clear the field
      await user.clear(input);

      // Trigger validation for this specific field
      await formMethods!.trigger(field.key);

      // Check if error appears based on config

      if (field.shouldBeRequired) {
        // Field should show required error
        await waitFor(() => {
          const errorElement = document.getElementById(field.key)?.querySelector('p.MuiFormHelperText-root.Mui-error');
          expect(errorElement).toBeInTheDocument();
          expect(errorElement).toHaveTextContent('This field is required');
        });
      } else {
        // Field should NOT show required error - wait a bit to ensure no error appears
        await waitFor(() => {
          const errorElement = document.getElementById(field.key)?.querySelector('p.MuiFormHelperText-root.Mui-error');
          expect(errorElement).not.toBeInTheDocument();
        });
      }
    }
  });
});
