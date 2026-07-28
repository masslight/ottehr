import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PatientEducationLanguageSelector } from 'src/features/visits/shared/components/PatientEducationLanguageSelector';
import { describe, expect, it, vi } from 'vitest';

describe('PatientEducationLanguageSelector', () => {
  it('renders English and Spanish options and calls onChange with the selected language', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PatientEducationLanguageSelector value="en" onChange={onChange} />);

    expect(screen.getByText('Language')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Español' })).not.toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Español' }));

    expect(onChange).toHaveBeenCalledWith('es');
  });

  it('can show the preferred Spanish hint and disable both language options', () => {
    render(<PatientEducationLanguageSelector value="es" onChange={vi.fn()} disabled showPreferredSpanishHint />);

    expect(screen.getByText("(patient's preferred language is Spanish)")).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'English' })).toBeDisabled();
    expect(screen.getByRole('radio', { name: 'Español' })).toBeDisabled();
  });
});
