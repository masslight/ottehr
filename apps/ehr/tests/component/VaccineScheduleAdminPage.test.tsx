import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { VaccineScheduleAdminPage } from '../../src/features/admin/vaccine-schedule/VaccineScheduleAdminPage';

describe('VaccineScheduleAdminPage', () => {
  it('opens on Children, cites the CDC CDSi 4.64 data with AIRA 26.1 for the seasonal antigens and the AAP for HPV, and is read-only', () => {
    render(<VaccineScheduleAdminPage />);
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual(['Children', 'Adults', 'Seasonal']);
    expect(
      screen.getByText(
        /Childhood schedule from CDC CDSi Supporting Data 4\.64, with AIRA medical societies \(AAP\/AAFP\/ACOG\/IDSA\) Supporting Data 26\.1 for COVID-19, Influenza and RSV; AAP immunization schedule 2026 for HPV\./
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Hep B')).toBeInTheDocument();
    expect(screen.getByText('HepB 3-dose series · Target: 3')).toBeInTheDocument();
    expect(screen.getAllByText('Routine').length).toBeGreaterThan(5);
    expect(screen.getByText('Shared decision')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
  });

  it('shows only the target doses, with the DTaP Tdap row, in tables with the same fixed columns', () => {
    render(<VaccineScheduleAdminPage />);
    const dtap = screen.getByText('DTaP/Tdap/Td').closest('div.MuiPaper-root') as HTMLElement;
    const rows = within(dtap).getAllByRole('row').slice(1);
    expect(rows.map((row) => row.firstChild?.textContent)).toEqual([
      'Dose 1',
      'Dose 2',
      'Dose 3',
      'Dose 4',
      'Dose 5',
      'Tdap',
      'Booster',
    ]);
    for (const table of screen.getAllByRole('table')) {
      expect(table).toHaveStyle({ tableLayout: 'fixed' });
      expect(within(table).getAllByRole('columnheader')[0]).toHaveStyle({ width: '13%' });
    }
  });

  it('Adults lists the adolescent/adult series and the Td booster', () => {
    render(<VaccineScheduleAdminPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Adults' }));
    expect(screen.getByText('Zoster')).toBeInTheDocument();
    expect(screen.getByText('Pneumococcal (adult)')).toBeInTheDocument();
    expect(screen.getByText('Booster')).toBeInTheDocument();
    expect(screen.getByText('10 years')).toBeInTheDocument();
    expect(screen.queryByText('Rotavirus')).not.toBeInTheDocument();
  });

  it('Seasonal shows the flu and COVID season dates from the data', () => {
    render(<VaccineScheduleAdminPage />);
    fireEvent.click(screen.getByRole('tab', { name: 'Seasonal' }));
    const flu = screen.getByText('Influenza').closest('tr')!;
    expect(flu).toHaveTextContent('07/01/2026');
    expect(flu).toHaveTextContent('06/30/2027');
    const covid = screen.getByText('COVID-19').closest('tr')!;
    expect(covid).toHaveTextContent('09/02/2026');
    expect(covid).toHaveTextContent('Open');
    expect(flu).toHaveTextContent('26.1');
  });
});
