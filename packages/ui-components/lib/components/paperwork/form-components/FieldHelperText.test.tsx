import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FieldHelperText } from './FieldHelperText';

// Seed test for the ui-components vitest rig. Beyond proving the pipeline
// (happy-dom + react + tsconfig paths) works in this package, it pins the
// `${name}-helper-text` id contract that intake e2e locators select on.
describe('FieldHelperText', () => {
  it('renders the error message under the `${name}-helper-text` id when hasError is set', () => {
    const { container } = render(
      <FieldHelperText name="patient-first-name" hasError={true} errorMessage="First name is required" />
    );

    const helperText = container.querySelector('#patient-first-name-helper-text');
    expect(helperText).not.toBeNull();
    expect(helperText?.textContent).toBe('First name is required');
  });

  it('renders an empty helper node instead of the error message when hasError is false', () => {
    const { container } = render(
      <FieldHelperText name="patient-first-name" hasError={false} errorMessage="First name is required" />
    );

    const helperText = container.querySelector('#patient-first-name-helper-text');
    expect(helperText).not.toBeNull();
    expect(helperText?.textContent).toBe('');
  });

  it('renders helper text with the info icon by default', () => {
    const { container } = render(
      <FieldHelperText name="patient-email" hasError={false} helperText="We only use this for visit updates" />
    );

    expect(screen.getByText('We only use this for visit updates')).toBeDefined();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('omits the info icon when showHelperTextIcon is false', () => {
    const { container } = render(
      <FieldHelperText
        name="patient-email"
        hasError={false}
        helperText="We only use this for visit updates"
        showHelperTextIcon={false}
      />
    );

    expect(screen.getByText('We only use this for visit updates')).toBeDefined();
    expect(container.querySelector('svg')).toBeNull();
  });
});
