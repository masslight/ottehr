import { Box, Typography } from '@mui/material';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { FC, useEffect, useRef, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { generateNarrativeFromMarkdown } from './shared/components/ros/generateNarrative';
import { RosItem, RosList } from './shared/components/ros/RosItem';
import { markdownToRos, rosToMarkdown } from './shared/components/ros/RosMarkdown';
import { RosEditor } from './shared/components/RosEditor';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

export const RosField: FC = () => {
  const {
    data: chartDataFields,
    isFetching,
    isFetched,
  } = useChartFields({
    requestedFields: {
      ros: { _tag: 'ros' },
      rosNarrative: { _tag: 'ros-narrative' },
    },
  });

  const {
    onValueChange: onRosChange,
    isLoading: isRosLoading,
    isChartDataLoading: isRosChartDataLoading,
  } = useDebounceNotesField('ros');

  const { onValueChange: onRosNarrativeChange, isLoading: isRosNarrativeLoading } =
    useDebounceNotesField('rosNarrative');

  const isUpdatingFromServer = useRef(false);
  const isInitialized = useRef(false);
  const lastMarkdown = useRef<string>('');

  const [isNarrativeMode, setIsNarrativeMode] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      RosList,
      RosItem.configure({
        nested: true,
      }),
      Placeholder.configure({
        placeholder: 'ROS (Optional) - Type headers, then - [ ] for items, or - [R]/[D] for Reports/Denies...',
      }),
    ],
    content: '',
    editable: !isRosChartDataLoading && !isRosNarrativeLoading,
    editorProps: {
      handlePaste: (view, event) => {
        if (isNarrativeMode) return false;

        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          const normalizedText = text.replace(/\\n/g, '\n');

          if (normalizedText.match(/^-\s*\[([ RD])\]/m)) {
            event.preventDefault();
            const doc = markdownToRos(normalizedText);
            editor?.commands.setContent(doc);
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      if (!isUpdatingFromServer.current && isInitialized.current) {
        if (isNarrativeMode) {
          const text = editor.getText();
          if (text !== lastMarkdown.current) {
            lastMarkdown.current = text;
            onRosNarrativeChange(text);
          }
        } else {
          const markdown = rosToMarkdown(editor.state.doc);
          if (markdown !== lastMarkdown.current) {
            lastMarkdown.current = markdown;
            onRosChange(markdown);
          }
        }
      }
    },
    onTransaction: ({ editor, transaction }) => {
      if (isUpdatingFromServer.current || !isInitialized.current) {
        return;
      }

      if (transaction.docChanged) {
        if (isNarrativeMode) {
          const text = editor.getText();
          if (text !== lastMarkdown.current) {
            lastMarkdown.current = text;
            onRosNarrativeChange(text);
          }
        } else {
          const markdown = rosToMarkdown(editor.state.doc);
          if (markdown !== lastMarkdown.current) {
            lastMarkdown.current = markdown;
            onRosChange(markdown);
          }
        }
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (!isFetched) return;

    if (!isInitialized.current) {
      const hasNarrative = !!chartDataFields?.rosNarrative?.text;
      setIsNarrativeMode(hasNarrative);

      if (hasNarrative) {
        const narrativeText = chartDataFields.rosNarrative!.text!;
        isUpdatingFromServer.current = true;
        editor.commands.setContent(narrativeText);
        lastMarkdown.current = narrativeText;
      } else {
        const rosMarkdown = chartDataFields?.ros?.text || '';
        const doc = markdownToRos(rosMarkdown);
        isUpdatingFromServer.current = true;
        editor.commands.setContent(doc);
        lastMarkdown.current = rosMarkdown;
      }

      requestAnimationFrame(() => {
        isUpdatingFromServer.current = false;
        isInitialized.current = true;
      });
      return;
    }

    if (!isFetching) {
      if (isNarrativeMode) {
        const narrativeText = chartDataFields?.rosNarrative?.text || '';
        const currentText = editor.getText();

        if (currentText !== narrativeText) {
          isUpdatingFromServer.current = true;
          editor.commands.setContent(narrativeText);
          lastMarkdown.current = narrativeText;

          requestAnimationFrame(() => {
            isUpdatingFromServer.current = false;
          });
        }
      } else {
        const rosMarkdown = chartDataFields?.ros?.text || '';
        const currentMarkdown = rosToMarkdown(editor.state.doc);

        if (currentMarkdown !== rosMarkdown) {
          const doc = markdownToRos(rosMarkdown);
          isUpdatingFromServer.current = true;
          editor.commands.setContent(doc);
          lastMarkdown.current = rosMarkdown;

          requestAnimationFrame(() => {
            isUpdatingFromServer.current = false;
          });
        }
      }
    }
  }, [
    chartDataFields?.ros?.text,
    chartDataFields?.rosNarrative,
    chartDataFields?.rosNarrative?.text,
    editor,
    isFetched,
    isFetching,
    isNarrativeMode,
  ]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(!isRosChartDataLoading && !isRosNarrativeLoading);
    }
  }, [isRosChartDataLoading, isRosNarrativeLoading, editor]);

  const handleGenerateNarrative = (): void => {
    if (!editor) return;

    const markdown = rosToMarkdown(editor.state.doc);
    const narrative = generateNarrativeFromMarkdown(markdown);

    setIsNarrativeMode(true);

    onRosNarrativeChange(narrative);

    isUpdatingFromServer.current = true;
    editor.commands.setContent(narrative);
    lastMarkdown.current = narrative;

    requestAnimationFrame(() => {
      isUpdatingFromServer.current = false;
    });
  };

  const handleDeleteNarrative = (): void => {
    setIsNarrativeMode(false);
    onRosNarrativeChange('');

    const rosMarkdown = chartDataFields?.ros?.text || '';
    const doc = markdownToRos(rosMarkdown);
    isUpdatingFromServer.current = true;
    editor?.commands.setContent(doc);

    requestAnimationFrame(() => {
      isUpdatingFromServer.current = false;
    });
  };
  const isLoading = isRosLoading || isRosNarrativeLoading;

  return (
    <Box>
      <RosEditor editor={editor} isLoading={isLoading} dataTestId={dataTestIds.telemedEhrFlow.hpiChiefComplaintRos} />

      {!isNarrativeMode && (
        <Box sx={{ mt: 2 }}>
          <RoundedButton variant="contained" onClick={handleGenerateNarrative} disabled={isLoading || !editor}>
            Generate ROS Narrative
          </RoundedButton>
        </Box>
      )}
      {isNarrativeMode && (
        <Box sx={{ mt: 2 }}>
          <RoundedButton variant="contained" onClick={handleDeleteNarrative}>
            Back to ROS
          </RoundedButton>
        </Box>
      )}
    </Box>
  );
};

export const RosFieldReadOnly: FC = () => {
  const { data: chartFields } = useChartFields({
    requestedFields: {
      ros: { _tag: 'ros' },
      rosNarrative: { _tag: 'ros-narrative' },
    },
  });

  const rosText = chartFields?.rosNarrative?.text || chartFields?.ros?.text;

  if (!rosText) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="subtitle2" color="primary.dark">
        ROS provider notes
      </Typography>
      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
        {rosText}
      </Typography>
    </Box>
  );
};
