import { render, screen } from '@testing-library/react';
import { DateTime } from 'luxon';
import { MemoryRouter } from 'react-router-dom';
import { getPrivacyPolicyLinkDefForLocation, getTermsAndConditionsLinkDefForLocation, VisitType } from 'utils';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import ReviewPage from '../../src/pages/Review';

const mockUseBookingContext = vi.fn();
vi.mock('../../src/pages/BookingHome', () => ({
  useBookingContext: () => mockUseBookingContext(),
  PROGRESS_STORAGE_KEY: 'patient-information-progress',
}));

const mockData = {
  patientInfo: {
    firstName: 'John',
    lastName: 'Doe',
  },
  visitType: VisitType.PreBook,
  scheduleOwnerName: 'Test Location',
  scheduleOwnerType: 'Location',
  timezone: 'America/New_York',
  startISO: '2025-11-06T10:00:00-05:00',
};

describe('Review and Submit Screen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseBookingContext.mockReturnValue(mockData);

    // Set up sessionStorage with patient information
    const mockSessionData = {
      'patient-information-page-1': {
        'patient-first-name': { linkId: 'patient-first-name', answer: [{ valueString: 'John' }] },
        'patient-last-name': { linkId: 'patient-last-name', answer: [{ valueString: 'Doe' }] },
      },
    };
    sessionStorage.setItem('patient-information-progress', JSON.stringify(mockSessionData));
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  test('should render Review page', () => {
    const wrapper = render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    expect(wrapper).toBeTruthy();
  });

  test('Check title block displays correctly', () => {
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Review and submit' })).toBeDefined();
    expect(screen.getByText('Review and confirm all details below.')).toBeDefined();
  });

  test('Check visit details block displays correctly', () => {
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    expect(screen.getByRole('heading', { name: 'Visit details' })).toBeDefined();

    expect(screen.getByText('Patient')).toBeDefined();
    const patientName = screen.getByTestId('patient-name-review-screen');
    expect(patientName).toBeDefined();
    expect(patientName.textContent).toBe(mockData.patientInfo.firstName + ' ' + mockData.patientInfo.lastName);

    expect(screen.getByText(mockData.scheduleOwnerType)).toBeDefined();
    // Location / Provider / Group
    const locationName = screen.getByTestId('location-name-review-screen');
    expect(locationName).toBeDefined();
    expect(locationName.textContent).toBe(mockData.scheduleOwnerName);

    expect(screen.getByText('Check-in time')).toBeDefined();
    const slotTime = screen.getByTestId('prebook-slot-review-screen');
    expect(slotTime).toBeDefined();
    expect(slotTime.textContent).toBe(
      // eg November 6, 10:00 AM EST
      DateTime.fromISO(mockData.startISO, { zone: mockData.timezone }).toFormat('MMMM d, h:mm a ZZZZ')
    );
  });

  test('Check links display correctly', () => {
    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    const privacyLinkDef = getPrivacyPolicyLinkDefForLocation('REVIEW_PAGE');
    const privacyPolicyLink = screen.getByRole('link', { name: 'Privacy Policy' });
    if (privacyLinkDef === undefined) {
      expect(privacyPolicyLink).toBeUndefined();
    } else {
      expect(privacyPolicyLink).toBeDefined();
      expect(privacyPolicyLink.getAttribute('href')).toBe(privacyLinkDef.url);
      expect(privacyPolicyLink.getAttribute('target')).toBe('_blank');
    }

    const termsLinkDef = getTermsAndConditionsLinkDefForLocation('REVIEW_PAGE');
    const termsLink = screen.getByRole('link', { name: 'Terms and Conditions of Service' });
    if (termsLinkDef === undefined) {
      expect(termsLink).toBeUndefined();
    } else {
      expect(termsLink).toBeDefined();
      expect(termsLink.getAttribute('href')).toBe(termsLinkDef.url);
      expect(termsLink.getAttribute('target')).toBe('_blank');
    }
  });

  test('Check visit type display differences', () => {
    const testCases = [
      {
        visitType: VisitType.WalkIn,
        expectedLabel: 'Walk-in time',
        buttonName: /confirm this walk-in time/i,
        editButton: false,
      },
      {
        visitType: VisitType.PreBook,
        expectedLabel: 'Check-in time',
        buttonName: /reserve this check-in time/i,
        editButton: true,
      },
    ];

    testCases.forEach(({ visitType, expectedLabel, buttonName, editButton }) => {
      mockUseBookingContext.mockReturnValue({
        ...mockData,
        visitType,
      });

      const { unmount } = render(
        <MemoryRouter>
          <ReviewPage />
        </MemoryRouter>
      );

      expect(screen.getByText(expectedLabel)).toBeDefined();
      expect(screen.getByRole('button', { name: buttonName })).toBeDefined();
      if (editButton) {
        expect(screen.getByRole('button', { name: /edit/i })).toBeDefined();
      }
      unmount();
    });
  });

  test('Check patient name displays "Unknown" when patientInfo is missing', () => {
    // Clear sessionStorage to simulate missing patient info
    sessionStorage.clear();

    mockUseBookingContext.mockReturnValue({
      ...mockData,
      patientInfo: undefined,
    });

    render(
      <MemoryRouter>
        <ReviewPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('patient-name-review-screen').textContent).toBe('Unknown');
  });

  test('Check different time zones display correctly', () => {
    const testCases = [
      { startISO: '2025-05-06T09:00:00-05:00', timezone: 'America/New_York', expectedZone: 'EDT' },
      { startISO: '2025-05-06T09:00:00-05:00', timezone: 'America/Chicago', expectedZone: 'CDT' },
      { startISO: '2025-05-06T09:00:00-05:00', timezone: 'America/Denver', expectedZone: 'MDT' },
      // Phoenix doesn't do DST
      { startISO: '2025-05-06T09:00:00-05:00', timezone: 'America/Phoenix', expectedZone: 'MST' },
      { startISO: '2025-05-06T09:00:00-05:00', timezone: 'America/Los_Angeles', expectedZone: 'PDT' },
      { startISO: '2025-11-06T09:00:00-05:00', timezone: 'America/New_York', expectedZone: 'EST' },
      { startISO: '2025-11-06T09:00:00-05:00', timezone: 'America/Chicago', expectedZone: 'CST' },
      { startISO: '2025-11-06T09:00:00-05:00', timezone: 'America/Denver', expectedZone: 'MST' },
      { startISO: '2025-11-06T09:00:00-05:00', timezone: 'America/Phoenix', expectedZone: 'MST' },
      { startISO: '2025-11-06T09:00:00-05:00', timezone: 'America/Los_Angeles', expectedZone: 'PST' },
    ];

    testCases.forEach(({ startISO, timezone, expectedZone }) => {
      mockUseBookingContext.mockReturnValue({
        ...mockData,
        startISO,
        timezone,
      });

      const { unmount } = render(
        <MemoryRouter>
          <ReviewPage />
        </MemoryRouter>
      );

      expect(screen.getByText('Check-in time')).toBeDefined();
      const slotTime = screen.getByTestId('prebook-slot-review-screen');
      expect(slotTime).toBeDefined();
      expect(slotTime.textContent).toBe(
        // eg November 6, 10:00 AM EST
        DateTime.fromISO(startISO, { zone: timezone }).toFormat(`MMMM d, h:mm a '${expectedZone}'`)
      );
      unmount();
    });
  });
});
