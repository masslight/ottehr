import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

const vitals = vi.hoisted(() => ({ encounter: {} as Record<string, unknown[]> }));

vi.mock('src/features/visits/shared/components/vitals/hooks/useGetVitals', () => ({
  useGetVitals: () => ({ data: vitals.encounter }),
  useGetAbnormalVitals: () => vitals.encounter,
}));

vi.mock('src/features/visits/shared/components/scribe-recommendations/aiAddedMarks', () => ({
  useAiAddedRecommendations: () => [],
  findAiAddedFor: () => undefined,
}));

import { VitalAlertCriticality, VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { GetVitalsResponseData } from 'utils/lib/types/api/chart-data/get-vitals.types';
import { InPersonAppointmentInformation } from 'utils/lib/types/data/appointments/appointments.types';
import { PatientVitalsContainer } from '../../src/features/visits/in-person/components/progress-note/PatientVitalsContainer';
import { AbnormalVitalsContent } from '../../src/features/visits/shared/components/vitals/components/AbnormalVitalsContent';
import { VitalsIconTooltip } from '../../src/features/visits/shared/components/VitalsIconTooltip';

const reading = (
  field: VitalFieldNames,
  value: number,
  alertCriticality?: VitalsObservationDTO['alertCriticality']
): VitalsObservationDTO =>
  ({
    field,
    value,
    alertCriticality,
    resourceId: `${field}-${value}`,
    authorName: 'Daniel Cohen',
    lastUpdated: '2026-11-18T14:39:00.000Z',
  }) as VitalsObservationDTO;

describe('head circumference wherever vitals appear', () => {
  it('sits directly below Height on Review & Sign', () => {
    vitals.encounter = {
      [VitalFieldNames.VitalWeight]: [reading(VitalFieldNames.VitalWeight, 8.2)],
      [VitalFieldNames.VitalHeight]: [reading(VitalFieldNames.VitalHeight, 68)],
      [VitalFieldNames.VitalHeadCircumference]: [reading(VitalFieldNames.VitalHeadCircumference, 43.8)],
      [VitalFieldNames.VitalBMI]: [reading(VitalFieldNames.VitalBMI, 17.7)],
    };
    render(<PatientVitalsContainer encounterId="enc-1" />);

    const headings = ['Weight', 'Height', 'Head circumference', 'BMI'].map((label) => screen.getByText(label));
    headings.slice(1).forEach((heading, index) => {
      expect(headings[index].compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    expect(screen.getByText(/43\.8 cm ≈ 17\.24 in/)).toBeInTheDocument();
  });

  it('lists an out-of-range reading on the Tracking Board hover', async () => {
    const abnormal = {
      [VitalFieldNames.VitalHeadCircumference]: [
        reading(VitalFieldNames.VitalHeadCircumference, 141, VitalAlertCriticality.Critical),
      ],
    } as unknown as GetVitalsResponseData;
    render(
      <MemoryRouter>
        <VitalsIconTooltip appointment={{ id: 'appt-1' } as InPersonAppointmentInformation} abnormalVitals={abnormal} />
      </MemoryRouter>
    );

    await userEvent.hover(screen.getByRole('link'));

    const tooltip = await screen.findByRole('tooltip');
    expect(within(tooltip).getByText(/Head Circumference -/)).toBeInTheDocument();
    expect(within(tooltip).getByText('141 cm ≈ 55.51 in')).toBeInTheDocument();
  });

  it('lists an out-of-range reading among the abnormal vitals to confirm', () => {
    vitals.encounter = {
      [VitalFieldNames.VitalHeadCircumference]: [
        reading(VitalFieldNames.VitalHeadCircumference, 31, VitalAlertCriticality.Abnormal),
      ],
    };
    render(<AbnormalVitalsContent />);

    expect(screen.getByText('Head Circumference')).toBeInTheDocument();
    expect(screen.getByText('31 cm ≈ 12.2 in')).toBeInTheDocument();
  });
});
