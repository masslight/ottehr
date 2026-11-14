import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BiliToolReading } from '../../src/features/flowsheets/biliTool';
import { BiliToolDialog } from '../../src/features/flowsheets/components/BiliToolDialog';

const time = '2025-05-19T10:00:00.000Z';
// A blood result and a skin meter reading taken at the same moment.
const readings: BiliToolReading[] = [
  { kind: 'blood', value: 14.6, unit: 'mg/dL', units: 'US', hours: 122, time },
  { kind: 'tcb', value: 13.9, unit: 'mg/dL', units: 'US', hours: 122, time },
];

describe('BiliToolDialog: result to send', () => {
  it('two readings at the same time are separate choices', () => {
    render(
      <BiliToolDialog
        open
        onClose={() => undefined}
        birthHistory={{ timeOfBirth: '08:14', gestationalAgeWeeks: 38, gestationalAgeDays: 0 }}
        readings={readings}
      />
    );
    const blood = screen.getByLabelText(/14\.6 mg\/dL · blood/);
    const tcb = screen.getByLabelText(/13\.9 mg\/dL · skin meter/);
    expect([blood, tcb].map((radio) => (radio as HTMLInputElement).checked)).toEqual([true, false]);
    fireEvent.click(tcb);
    expect([blood, tcb].map((radio) => (radio as HTMLInputElement).checked)).toEqual([false, true]);
  });
});

describe('BiliToolDialog: Open BiliTool hover', () => {
  const hoverText = async (): Promise<string | null> => {
    fireEvent.mouseOver(screen.getByRole('button', { name: 'Open BiliTool' }).parentElement!);
    return (await screen.findByRole('tooltip')).textContent;
  };
  const birthHistory = { timeOfBirth: '08:14', gestationalAgeWeeks: 38, gestationalAgeDays: 0 };

  it('disabled until the risk-factor question is answered, saying so', async () => {
    render(<BiliToolDialog open onClose={() => undefined} birthHistory={birthHistory} readings={readings} />);
    expect((screen.getByRole('button', { name: 'Open BiliTool' }) as HTMLButtonElement).disabled).toBe(true);
    expect(await hoverText()).toBe('Answer the risk-factor question');
  });

  it('with no result picked (only skin-meter readings), asks for both', async () => {
    render(<BiliToolDialog open onClose={() => undefined} birthHistory={birthHistory} readings={[readings[1]]} />);
    expect(await hoverText()).toBe('Pick a result to send and answer the risk-factor question');
  });
});
