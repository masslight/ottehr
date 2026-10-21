import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ReactElement, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { InvoiceTemplateField } from '../../src/components/InvoiceTemplateField';

function Editor({ initialValue = '', disabled = false }: { initialValue?: string; disabled?: boolean }): ReactElement {
  const [value, setValue] = useState(initialValue);
  return (
    <>
      <InvoiceTemplateField
        label="SMS template"
        value={value}
        onChange={setValue}
        onBlur={() => undefined}
        inputRef={() => undefined}
        error={false}
        disabled={disabled}
      />
      <button onClick={() => setValue(initialValue)}>Reset</button>
    </>
  );
}

const input = (): HTMLTextAreaElement => screen.getByRole('textbox', { name: 'SMS template' });

describe('Invoice template suggestions', () => {
  it('opens on {{ and filters the placeholders as the user types', async () => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello " />);
    await user.click(input());
    await user.paste('{{');
    expect(screen.getByRole('listbox', { name: 'SMS template placeholders' })).toBeVisible();
    expect(screen.getAllByRole('option')).toHaveLength(8);
    await user.keyboard('CL');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: '{{clinic}}' })).toHaveAttribute('aria-selected', 'true');
    expect(input()).toHaveValue('Hello {{CL');
  });

  it('supports arrow navigation and Enter and restores the cursor after completion', async () => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello " />);
    await user.click(input());
    await user.paste('{{');
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('option', { name: '{{patient-portal-link}}' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{ArrowDown}{ArrowDown}');
    const selected = screen.getByRole('option', { name: '{{clinic}}' });
    expect(input()).toHaveAttribute('aria-activedescendant', selected.id);
    await user.keyboard('{Enter}');
    expect(input()).toHaveValue('Hello {{clinic}}');
    expect(input()).toHaveFocus();
    expect(input().selectionStart).toBe('Hello {{clinic}}'.length);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('!');
    expect(input()).toHaveValue('Hello {{clinic}}!');
  });

  it('completes with Tab without moving focus', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(input());
    await user.paste('{{due');
    await user.tab();
    expect(input()).toHaveValue('{{due-date}}');
    expect(input()).toHaveFocus();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('inserts a clicked suggestion in the middle of the template without losing surrounding text', async () => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello . Thanks." />);
    await user.click(input());
    input().setSelectionRange(6, 6);
    await user.paste('{{am');
    await user.click(screen.getByRole('option', { name: '{{amount}}' }));
    expect(input()).toHaveValue('Hello {{amount}}. Thanks.');
    expect(input()).toHaveFocus();
    expect(input().selectionStart).toBe('Hello {{amount}}'.length);
  });

  it.each([8, 10, 14])('replaces an existing placeholder when completing at cursor position %s', async (cursor) => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello {{clinic}}. Thanks." />);
    await user.click(input());
    input().setSelectionRange(cursor, cursor);
    fireEvent.select(input());
    await user.click(screen.getByRole('option', { name: '{{clinic}}' }));
    expect(input()).toHaveValue('Hello {{clinic}}. Thanks.');
    expect(input()).toHaveFocus();
    expect(input().selectionStart).toBe('Hello {{clinic}}'.length);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('!');
    expect(input()).toHaveValue('Hello {{clinic}}!. Thanks.');
  });

  it('completes a partially typed placeholder when its chip is clicked', async () => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello . Thanks." />);
    await user.click(input());
    input().setSelectionRange(6, 6);
    await user.paste('{{cl');
    await user.click(screen.getByRole('button', { name: '{{clinic}}' }));
    expect(input()).toHaveValue('Hello {{clinic}}. Thanks.');
    expect(input()).toHaveFocus();
    expect(input().selectionStart).toBe('Hello {{clinic}}'.length);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('dismisses suggestions with Escape and lets Enter insert a newline', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(input());
    await user.paste('{{cl');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input()).toHaveValue('{{cl');
    await user.keyboard('{Enter}');
    expect(input()).toHaveValue('{{cl\n');
  });

  it.each(['{{unknown', '{{clinic}}'])('leaves %s unchanged when there is no suggestion', async (text) => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(input());
    await user.paste(text);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(input()).toHaveValue(text + '\n');
  });

  it('closes suggestions when the cursor moves outside the token or text is selected', async () => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello " />);
    await user.click(input());
    await user.paste('{{cl');
    await user.keyboard('{Home}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.getByRole('listbox')).toBeVisible();
    input().setSelectionRange(6, 10);
    fireEvent.select(input());
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('closes suggestions on blur and Reset', async () => {
    const user = userEvent.setup();
    render(<Editor initialValue="Hello " />);
    await user.click(input());
    await user.paste('{{cl');
    await user.click(screen.getByRole('button', { name: 'Reset' }));
    expect(input()).toHaveValue('Hello ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not handle Enter during IME composition or Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<Editor />);
    await user.click(input());
    await user.paste('{{cl');
    expect(fireEvent.keyDown(input(), { key: 'Enter', isComposing: true })).toBe(true);
    expect(input()).toHaveValue('{{cl');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    expect(input()).toHaveValue('{{cl\n');
  });

  it('hides suggestions when the editor is disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Editor />);
    await user.click(input());
    await user.paste('{{cl');
    expect(screen.getByRole('listbox')).toBeVisible();
    rerender(<Editor disabled />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(input()).toBeDisabled();
    expect(input()).toHaveValue('{{cl');
  });
});
