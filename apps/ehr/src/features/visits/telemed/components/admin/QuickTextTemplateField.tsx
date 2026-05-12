import { FormHelperText } from '@mui/material';
import { useEditor } from '@tiptap/react';
import { ReactElement, useRef } from 'react';
import { PlaceholderChips } from 'src/components/template-editor-field/PlaceholderChips';
import { TemplateEditorField } from 'src/components/template-editor-field/TemplateEditorField';
import { QUICK_TEXT_TOKEN_IDS } from 'src/features/chat/chat.queries';

const SAMPLE_PREVIEW_VALUES: Record<string, string> = {
  'patient-first-name': 'First Name',
  'patient-last-name': 'Last Name',
  'paperwork-url': 'https://example.com/visit/...',
  'ai-interview-url': 'https://example.com/visit/.../ai-interview-start',
  'practice-name': 'Practice Name',
  'location-name': 'Location Name',
  'booking-time': '3:30 PM',
  'office-phone': '(555) 000-0000',
  'support-phone': '(555) 000-0001',
};

interface QuickTextTemplateFieldProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  required?: boolean;
  maxLength?: number;
}

export function QuickTextTemplateField({
  value,
  onChange,
  label,
  required,
  maxLength,
}: QuickTextTemplateFieldProps): ReactElement {
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);

  const insertToken = (tokenId: string): void => {
    const ed = editorRef.current;
    if (!ed) return;
    ed.chain()
      .focus()
      .insertContent({ type: 'mention', attrs: { id: tokenId, label: tokenId } })
      .run();
  };

  return (
    <TemplateEditorField
      label={label}
      required={required}
      value={value}
      onChange={onChange}
      editorRef={editorRef}
      tokens={QUICK_TEXT_TOKEN_IDS}
      previewValues={SAMPLE_PREVIEW_VALUES}
      maxLength={maxLength}
      helperText={maxLength !== undefined ? `${value.length} / ${maxLength}` : undefined}
      writeFooter={
        <>
          <FormHelperText sx={{ mt: 0 }}>Type {'{{'} to insert a placeholder, or click one below</FormHelperText>
          <PlaceholderChips tokens={QUICK_TEXT_TOKEN_IDS} onInsert={insertToken} />
        </>
      }
    />
  );
}
