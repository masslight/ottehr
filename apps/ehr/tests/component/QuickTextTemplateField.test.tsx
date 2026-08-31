import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================================
// MOCKS
// ============================================================================

const mockRun = vi.fn();
const mockInsertContent = vi.fn(() => ({ run: mockRun }));
const mockFocus = vi.fn(() => ({ insertContent: mockInsertContent }));
const mockChain = vi.fn(() => ({ focus: mockFocus }));

// Capture props passed to the mocked TemplateEditorField so we can assert on them
// and exercise the writeFooter / editorRef contract that QuickTextTemplateField relies on.
let capturedTemplateEditorProps: Record<string, any> | null = null;

vi.mock('src/components/template-editor-field/TemplateEditorField', () => ({
  TemplateEditorField: (props: any) => {
    capturedTemplateEditorProps = props;
    // Simulate Tiptap exposing an editor instance via the ref so chip clicks can
    // call editor.chain().focus().insertContent(...).run().
    React.useEffect(() => {
      props.editorRef.current = { chain: mockChain };
      return () => {
        props.editorRef.current = null;
      };
    }, [props.editorRef]);

    return (
      <div data-testid="template-editor-field">
        {props.label && <div data-testid="te-label">{props.label}</div>}
        <textarea data-testid="te-value" value={props.value} onChange={(e) => props.onChange(e.target.value)} />
        {props.helperText && <div data-testid="te-helper">{props.helperText}</div>}
        <div data-testid="te-write-footer">{props.writeFooter}</div>
      </div>
    );
  },
}));

vi.mock('src/components/template-editor-field/PlaceholderChips', () => ({
  PlaceholderChips: ({ tokens, onInsert }: { tokens: readonly string[]; onInsert: (id: string) => void }) => (
    <div data-testid="placeholder-chips">
      {tokens.map((id) => (
        <button key={id} data-testid={`chip-${id}`} onClick={() => onInsert(id)} type="button">
          {`{{${id}}}`}
        </button>
      ))}
    </div>
  ),
}));

import { QUICK_TEXT_TOKEN_IDS } from '../../src/features/chat/chat.queries';
import { QuickTextTemplateField } from '../../src/features/visits/telemed/components/admin/QuickTextTemplateField';

// ============================================================================
// TESTS
// ============================================================================

describe('QuickTextTemplateField', () => {
  beforeEach(() => {
    capturedTemplateEditorProps = null;
    mockChain.mockClear();
    mockFocus.mockClear();
    mockInsertContent.mockClear();
    mockRun.mockClear();
  });

  it('renders all quick-text tokens as clickable chips', () => {
    render(<QuickTextTemplateField value="" onChange={() => undefined} />);

    for (const token of QUICK_TEXT_TOKEN_IDS) {
      expect(screen.getByTestId(`chip-${token}`)).toBeInTheDocument();
    }
  });

  it('forwards label, required, value, and the full token list to TemplateEditorField', () => {
    render(
      <QuickTextTemplateField
        label="English"
        required
        value="Hello {{patient-first-name}}"
        onChange={() => undefined}
      />
    );

    expect(capturedTemplateEditorProps).toBeTruthy();
    expect(capturedTemplateEditorProps!.label).toBe('English');
    expect(capturedTemplateEditorProps!.required).toBe(true);
    expect(capturedTemplateEditorProps!.value).toBe('Hello {{patient-first-name}}');
    expect(capturedTemplateEditorProps!.tokens).toEqual(QUICK_TEXT_TOKEN_IDS);
  });

  it('passes a sample previewValues map covering every token', () => {
    render(<QuickTextTemplateField value="" onChange={() => undefined} />);

    const previewValues = capturedTemplateEditorProps!.previewValues as Record<string, string>;
    for (const token of QUICK_TEXT_TOKEN_IDS) {
      expect(previewValues[token]).toBeTruthy();
    }
  });

  it('renders a character-count helper when maxLength is provided', () => {
    render(<QuickTextTemplateField value="hello" onChange={() => undefined} maxLength={300} />);

    expect(screen.getByTestId('te-helper')).toHaveTextContent('5 / 300');
  });

  it('omits the character-count helper when maxLength is not provided', () => {
    render(<QuickTextTemplateField value="hello" onChange={() => undefined} />);

    expect(screen.queryByTestId('te-helper')).not.toBeInTheDocument();
  });

  it('forwards maxLength to TemplateEditorField so the editor can enforce the limit', () => {
    render(<QuickTextTemplateField value="" onChange={() => undefined} maxLength={300} />);

    expect(capturedTemplateEditorProps!.maxLength).toBe(300);
  });

  it('inserts a mention node into the editor when a chip is clicked', async () => {
    const user = userEvent.setup();
    render(<QuickTextTemplateField value="" onChange={() => undefined} />);

    await user.click(screen.getByTestId('chip-patient-first-name'));

    expect(mockChain).toHaveBeenCalledTimes(1);
    expect(mockFocus).toHaveBeenCalledTimes(1);
    expect(mockInsertContent).toHaveBeenCalledWith({
      type: 'mention',
      attrs: { id: 'patient-first-name', label: 'patient-first-name' },
    });
    expect(mockRun).toHaveBeenCalledTimes(1);
  });

  it('inserts the correct token id for each chip', async () => {
    const user = userEvent.setup();
    render(<QuickTextTemplateField value="" onChange={() => undefined} />);

    await user.click(screen.getByTestId('chip-office-phone'));
    expect(mockInsertContent).toHaveBeenLastCalledWith({
      type: 'mention',
      attrs: { id: 'office-phone', label: 'office-phone' },
    });

    await user.click(screen.getByTestId('chip-booking-time'));
    expect(mockInsertContent).toHaveBeenLastCalledWith({
      type: 'mention',
      attrs: { id: 'booking-time', label: 'booking-time' },
    });
  });
});

// ============================================================================
// chat.queries pure helpers — colocated since they back the same feature
// ============================================================================

import { buildQuickTextVariables, resolveQuickText } from '../../src/features/chat/chat.queries';

describe('buildQuickTextVariables', () => {
  it('maps context fields to the new kebab-case token keys', () => {
    const raw = {
      patientAppUrl: 'https://app.example.com',
      patientFirstName: 'Jane',
      patientLastName: 'Doe',
      visitId: 'visit-1',
      locationName: 'Downtown Clinic',
      bookingTime: '3:30 PM',
      officePhone: '555-111-2222',
      supportPhone: '555-333-4444',
    };
    const vars = buildQuickTextVariables(raw);

    expect(vars['patient-first-name']).toBe(raw.patientFirstName);
    expect(vars['patient-last-name']).toBe(raw.patientLastName);
    expect(vars['paperwork-url']).toBe(`${raw.patientAppUrl}/visit/${raw.visitId}`);
    expect(vars['ai-interview-url']).toBe(`${raw.patientAppUrl}/visit/${raw.visitId}/ai-interview-start`);
    expect(vars['location-name']).toBe(raw.locationName);
    expect(vars['booking-time']).toBe(raw.bookingTime);
    expect(vars['office-phone']).toBe(raw.officePhone);
    expect(vars['support-phone']).toBe(raw.supportPhone);
    // practice-name comes from BRANDING_CONFIG — just make sure it's present and a string.
    expect(typeof vars['practice-name']).toBe('string');
  });

  it('leaves URL keys empty when patientAppUrl or visitId is missing', () => {
    const vars = buildQuickTextVariables({ patientAppUrl: 'https://app.example.com' });
    expect(vars['paperwork-url']).toBe('');
    expect(vars['ai-interview-url']).toBe('');

    const vars2 = buildQuickTextVariables({ visitId: 'v1' });
    expect(vars2['paperwork-url']).toBe('');
    expect(vars2['ai-interview-url']).toBe('');
  });

  it('emits empty strings for missing optional context fields', () => {
    const vars = buildQuickTextVariables({});
    expect(vars['patient-first-name']).toBe('');
    expect(vars['patient-last-name']).toBe('');
    expect(vars['location-name']).toBe('');
    expect(vars['booking-time']).toBe('');
    expect(vars['office-phone']).toBe('');
    expect(vars['support-phone']).toBe('');
  });
});

describe('resolveQuickText', () => {
  it('substitutes placeholders that have values', () => {
    const resolved = resolveQuickText(
      { name: 'Greet', english: 'Hi {{patient-first-name}}!', spanish: '¡Hola {{patient-first-name}}!' },
      { 'patient-first-name': 'Jane' }
    );

    expect(resolved.english).toBe('Hi Jane!');
    expect(resolved.spanish).toBe('¡Hola Jane!');
  });

  it('keeps unresolved placeholders intact when the variable is missing', () => {
    const resolved = resolveQuickText(
      { name: 'Greet', english: 'Hi {{patient-first-name}} {{patient-last-name}}!' },
      { 'patient-first-name': 'Jane' }
    );

    expect(resolved.english).toBe('Hi Jane {{patient-last-name}}!');
  });

  it('keeps placeholders intact when the variable is an empty string', () => {
    const resolved = resolveQuickText(
      { name: 'Greet', english: 'Call us at {{office-phone}}.' },
      { 'office-phone': '' }
    );

    expect(resolved.english).toBe('Call us at {{office-phone}}.');
  });

  it('omits spanish when the source spanish field is missing', () => {
    const resolved = resolveQuickText({ name: 'Greet', english: 'Hi' }, {});
    expect(resolved.spanish).toBeUndefined();
  });
});
