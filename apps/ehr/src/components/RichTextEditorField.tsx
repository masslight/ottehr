import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatStrikethrough,
  Title as TitleIcon,
} from '@mui/icons-material';
import { Box, IconButton, Tooltip } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { ReactElement, useEffect } from 'react';

interface RichTextEditorFieldProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}

export function RichTextEditorField({
  value,
  onChange,
  placeholder,
  minHeight = 240,
  disabled = false,
}: RichTextEditorFieldProps): ReactElement {
  const theme = useTheme();

  const editor = useEditor({
    extensions: [StarterKit.configure({ heading: { levels: [2, 3] } })],
    content: value || '',
    editable: !disabled,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML();
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? '' : editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
  }, [editor, value]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [editor, disabled]);

  if (!editor) return <></>;

  return (
    <Box
      sx={{
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        bgcolor: 'background.paper',
        '&:focus-within': { borderColor: theme.palette.primary.main },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 0.5,
          flexWrap: 'wrap',
          borderBottom: `1px solid ${theme.palette.divider}`,
          p: 0.5,
          bgcolor: alpha(theme.palette.primary.main, 0.04),
        }}
      >
        <Tooltip title="Heading">
          <IconButton
            size="small"
            color={editor.isActive('heading', { level: 2 }) ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            disabled={disabled}
          >
            <TitleIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Bold">
          <IconButton
            size="small"
            color={editor.isActive('bold') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleBold().run()}
            disabled={disabled}
          >
            <FormatBold fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic">
          <IconButton
            size="small"
            color={editor.isActive('italic') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            disabled={disabled}
          >
            <FormatItalic fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Strikethrough">
          <IconButton
            size="small"
            color={editor.isActive('strike') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleStrike().run()}
            disabled={disabled}
          >
            <FormatStrikethrough fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Bulleted list">
          <IconButton
            size="small"
            color={editor.isActive('bulletList') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            disabled={disabled}
          >
            <FormatListBulleted fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Numbered list">
          <IconButton
            size="small"
            color={editor.isActive('orderedList') ? 'primary' : 'default'}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            disabled={disabled}
          >
            <FormatListNumbered fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      <Box
        sx={{
          p: 1.5,
          minHeight,
          '& .ProseMirror': {
            minHeight: `${minHeight - 24}px`,
            outline: 'none',
            '& p.is-editor-empty:first-of-type::before': {
              content: `"${placeholder ?? ''}"`,
              float: 'left',
              color: theme.palette.text.disabled,
              pointerEvents: 'none',
              height: 0,
            },
            '& h2, & h3': { marginTop: 0, marginBottom: '0.5em' },
            '& ul, & ol': { paddingLeft: '1.5em' },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
    </Box>
  );
}
