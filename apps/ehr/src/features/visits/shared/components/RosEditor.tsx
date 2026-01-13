import { Box, CircularProgress, SxProps, Theme } from '@mui/material';
import { Editor, EditorContent } from '@tiptap/react';
import { FC } from 'react';

interface RosEditorProps {
  editor: Editor | null;
  isLoading?: boolean;
  dataTestId?: string;
}

const containerSx: SxProps<Theme> = {
  position: 'relative',
  border: 1,
  borderColor: 'divider',
  borderRadius: 1,
  minHeight: 120,
  transition: 'border-color 0.2s, border-width 0.2s',

  '&:hover': {
    borderColor: 'text.primary',
  },

  '&:focus-within': {
    borderColor: 'primary.main',
    borderWidth: 2,
    margin: '-1px',
  },
};

const editorWrapperSx: SxProps<Theme> = {
  p: 2,

  '& .ProseMirror': {
    outline: 'none',
    minHeight: 80,

    '& p.is-editor-empty:first-of-type::before': {
      color: 'text.disabled',
      content: 'attr(data-placeholder)',
      float: 'left',
      height: 0,
      pointerEvents: 'none',
    },

    '& ul[data-type="ros-list"]': {
      listStyle: 'none',
      p: 0,
      m: 0,

      '& li[data-type="ros-item"]': {
        mb: 1.5,
        display: 'flex',
        alignItems: 'center',

        '& .ros-item-container': {
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          width: '100%',
        },

        '& .ros-item-content': {
          flex: 1,

          '& > p': {
            m: 0,
          },
        },

        '& .ros-radio-group': {
          display: 'flex',
          gap: 1,
          flexShrink: 0,
          ml: 'auto',
        },

        '& .ros-radio-option': {
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
          userSelect: 'none',

          '& input[type="checkbox"]': {
            width: 18,
            height: 18,
            m: 0,
            cursor: 'pointer',
            appearance: 'none',
            border: '2px solid',
            borderColor: 'rgba(0, 0, 0, 0.23)',
            borderRadius: '2px',
            backgroundColor: 'transparent',
            position: 'relative',
            transition: 'all 0.2s',

            '&:hover': {
              borderColor: 'rgba(0, 0, 0, 0.87)',
            },

            '&:checked': {
              backgroundColor: 'primary.main',
              borderColor: 'primary.main',

              '&::after': {
                content: '""',
                position: 'absolute',
                left: 5,
                top: 2,
                width: 4,
                height: 8,
                border: 'solid white',
                borderWidth: '0 2px 2px 0',
                transform: 'rotate(45deg)',
              },
            },
          },

          '& .ros-radio-label': {
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'text.secondary',
            ml: 0.5,
          },
        },
      },
    },

    '& h1, & h2, & h3, & h4, & h5, & h6': {
      fontWeight: 600,
      mt: 2,
      mb: 1,

      '&:first-of-type': {
        mt: 0,
      },
    },
  },
};

const loaderSx: SxProps<Theme> = {
  position: 'absolute',
  top: 8,
  right: 8,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

export const RosEditor: FC<RosEditorProps> = ({ editor, isLoading = false, dataTestId }) => {
  return (
    <Box sx={containerSx} data-testid={dataTestId}>
      <Box sx={editorWrapperSx}>
        <EditorContent editor={editor} />
      </Box>

      {isLoading && (
        <Box sx={loaderSx}>
          <CircularProgress size={20} />
        </Box>
      )}
    </Box>
  );
};
