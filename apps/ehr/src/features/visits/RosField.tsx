import { Box, CircularProgress, Typography } from '@mui/material';
import Placeholder from '@tiptap/extension-placeholder';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { Markdown } from '@tiptap/markdown';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FC, useEffect } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

export const RosField: FC = () => {
  const { data: chartDataFields } = useChartFields({
    requestedFields: {
      ros: { _tag: 'ros' },
    },
  });

  const {
    onValueChange: onRosChange,
    isLoading: isRosLoading,
    isChartDataLoading: isRosChartDataLoading,
  } = useDebounceNotesField('ros');

  const editor = useEditor({
    extensions: [
      StarterKit,
      Markdown,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'ROS (Optional) - Type [ ] for checklist items, or just type notes...',
      }),
    ],
    content: chartDataFields?.ros?.text || '',
    editable: !isRosChartDataLoading,
    editorProps: {
      handlePaste: (view, event) => {
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          // Check if it looks like markdown
          const hasMarkdownSyntax = /[#*\-[\]`]/.test(text);
          if (hasMarkdownSyntax && editor) {
            event.preventDefault();
            editor.commands.setContent(text, { contentType: 'markdown' });
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onRosChange(editor.getMarkdown());
    },
  });

  useEffect(() => {
    if (chartDataFields?.ros?.text !== undefined && editor) {
      const currentContent = editor.getMarkdown();
      const newContent = chartDataFields.ros.text;

      // Only update if content is different to avoid cursor jumps
      if (currentContent !== newContent) {
        editor.commands.setContent(newContent, { contentType: 'markdown' });
      }
    }
  }, [chartDataFields?.ros?.text, editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isRosChartDataLoading);
    }
  }, [isRosChartDataLoading, editor]);

  return (
    <Box
      sx={{
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 1,
        minHeight: '120px',
        '&:hover': {
          borderColor: 'text.primary',
        },
        '&:focus-within': {
          borderColor: 'primary.main',
          borderWidth: '2px',
          margin: '-1px', // Prevent layout shift when border width changes
        },
      }}
      data-testid={dataTestIds.telemedEhrFlow.hpiChiefComplaintRos}
    >
      <Box
        sx={{
          p: 2,
          '& .ProseMirror': {
            outline: 'none',
            minHeight: '80px',
            '& p.is-editor-empty:first-of-type::before': {
              color: 'text.disabled',
              content: 'attr(data-placeholder)',
              float: 'left',
              height: 0,
              pointerEvents: 'none',
            },
            '& ul[data-type="taskList"]': {
              listStyle: 'none',
              padding: 0,
              '& li': {
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                marginBottom: '0.5rem',
                '& > label': {
                  flex: '0 0 auto',
                  marginRight: '0.5rem',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                },
                '& > div': {
                  flex: '1 1 auto',
                  '& > p': {
                    margin: 0,
                  },
                },
                '& input[type="checkbox"]': {
                  width: '18px',
                  height: '18px',
                  margin: 0,
                  cursor: 'pointer',
                },
              },
            },
            '& ul, & ol': {
              paddingLeft: '1.5rem',
            },
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              fontWeight: 600,
              marginTop: '1rem',
              marginBottom: '0.5rem',
            },
            '& code': {
              backgroundColor: 'action.hover',
              borderRadius: '0.25rem',
              padding: '0.125rem 0.25rem',
              fontFamily: 'monospace',
            },
            '& pre': {
              backgroundColor: 'action.hover',
              borderRadius: '0.5rem',
              padding: '0.75rem',
              overflow: 'auto',
              '& code': {
                backgroundColor: 'transparent',
                padding: 0,
              },
            },
            '& blockquote': {
              borderLeft: '3px solid',
              borderColor: 'divider',
              paddingLeft: '1rem',
              marginLeft: 0,
            },
          },
        }}
      >
        <EditorContent editor={editor} />
      </Box>
      {isRosLoading && (
        <Box
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CircularProgress size="20px" />
        </Box>
      )}
    </Box>
  );
};

export const RosFieldReadOnly: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      ros: { _tag: 'ros' },
    },
  });

  const ros = chartFields?.ros?.text;

  if (!ros) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="subtitle2" color="primary.dark">
        ROS provider notes
      </Typography>
      <Typography variant="body2">{ros}</Typography>
    </Box>
  );
};
