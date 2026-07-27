import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PrivacyPolicyLine } from '../../src/features/easy-charting/PrivacyPolicyLine';

// The easy-chart note ends with the same acknowledgement line as Review & Sign's
// PrivacyPolicyAcknowledgement; without an appointment start it renders dateless.
describe('PrivacyPolicyLine', () => {
  it('renders the acknowledgement with the appointment start date and time', () => {
    render(<PrivacyPolicyLine appointmentStart="2026-07-01T14:30:00.000Z" />);
    expect(
      screen.getByText(
        /^Privacy Policy and Terms and Conditions of Service were reviewed and accepted on \d{2}\/\d{2}\/\d{4} at \d{2}:\d{2} (AM|PM)\.$/
      )
    ).toBeDefined();
  });

  it('renders the line without a date when no appointment start is available', () => {
    render(<PrivacyPolicyLine />);
    expect(
      screen.getByText('Privacy Policy and Terms and Conditions of Service were reviewed and accepted.')
    ).toBeDefined();
  });
});
