import { ReactElement } from 'react';
import { useForm } from 'react-hook-form';
import { AgeRangesEditor } from 'src/features/admin/vitals-alert-config/AgeRangesEditor';
import { VitalsAlertConfigFormValues } from 'src/features/admin/vitals-alert-config/vitalsAlertConfigFormValues';
import { VitalAlertAgeRange } from 'utils/lib/types/api/vitals-alert-config/vitals-alert-config.types';
import { defineStory } from '../../harness/story';

const ageRanges: VitalAlertAgeRange[] = [
  { id: 'range-1', minAge: { value: 0, unit: 'months' }, maxAge: { value: 12, unit: 'months' } },
  { id: 'range-2', minAge: { value: 1, unit: 'years' }, maxAge: { value: 12, unit: 'years' } },
  { id: 'range-3', minAge: { value: 12, unit: 'years' } },
];

const Host = (): ReactElement => {
  const { control } = useForm<VitalsAlertConfigFormValues>({
    defaultValues: { ageRanges, thresholds: {} as VitalsAlertConfigFormValues['thresholds'] },
  });
  return (
    <AgeRangesEditor
      control={control}
      ageRanges={ageRanges}
      rowKeys={ageRanges.map((range) => range.id)}
      onAdd={() => undefined}
      onRemove={() => undefined}
      onMaxAgeValueEntered={() => undefined}
    />
  );
};

export default defineStory({
  title: 'Remove vitals alert age range',
  source: 'apps/ehr/src/features/admin/vitals-alert-config/AgeRangesEditor.tsx',
  base: 'ConfirmationDialog',
  kind: 'destructive-confirm',
  where: 'Admin → Vitals alert config → age ranges → remove (trash) icon',
  render: () => <Host />,
  play: async ({ user, screen }) => {
    const buttons = await screen.findAllByRole('button', { name: /Remove age range/ });
    await user.click(buttons[1]);
    await screen.findByText('Remove this age range?');
  },
  notes: 'AgeRangesEditor rendered with a react-hook-form control from a minimal host instead of the full admin page.',
});
