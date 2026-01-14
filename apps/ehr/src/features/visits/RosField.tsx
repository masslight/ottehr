import PostAddIcon from '@mui/icons-material/PostAdd';
import { Box, IconButton, Typography } from '@mui/material';
import Placeholder from '@tiptap/extension-placeholder';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { GenericToolTip } from 'src/components/GenericToolTip';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import { generateNarrativeFromMarkdown, isEmptyNarrative } from './shared/components/ros/generateNarrative';
import { RosItem, RosList } from './shared/components/ros/RosItem';
import { markdownToRos, rosToMarkdown } from './shared/components/ros/RosMarkdown';
import { ROS_TEMPLATE } from './shared/components/ros/rosTemplate';
import { RosEditor } from './shared/components/RosEditor';
import { useChartFields } from './shared/hooks/useChartFields';
import { useDebounceNotesField } from './shared/hooks/useDebounceNotesField';

type Mode = 'ros' | 'narrative';

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
  const lastContent = useRef<string>('');

  const [mode, setMode] = useState<Mode>(() => (chartDataFields?.rosNarrative?.text ? 'narrative' : 'ros'));
  // modeRef is used to access the latest mode inside TipTap callbacks
  const modeRef = useRef<Mode>('ros');

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

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
        placeholder: 'Type free text or type [ ] for systems checklist items',
      }),
    ],
    content: '',
    editable: !isRosChartDataLoading && !isRosNarrativeLoading,
    editorProps: {
      handlePaste: (view, event) => {
        if (modeRef.current === 'narrative') return false;

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
        if (modeRef.current === 'narrative') {
          const text = editor.getText();
          if (text !== lastContent.current) {
            lastContent.current = text;
            onRosNarrativeChange(text);
          }
        } else {
          const markdown = rosToMarkdown(editor.state.doc);
          if (markdown !== lastContent.current) {
            lastContent.current = markdown;
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

      if (hasNarrative) {
        setMode('narrative');
        const narrativeText = chartDataFields.rosNarrative!.text!;
        isUpdatingFromServer.current = true;
        editor.commands.setContent(narrativeText, { emitUpdate: false });
        lastContent.current = narrativeText;
      } else {
        const rosMarkdown = chartDataFields?.ros?.text || '';
        const doc = markdownToRos(rosMarkdown);
        isUpdatingFromServer.current = true;
        editor.commands.setContent(doc, { emitUpdate: false });
        lastContent.current = rosMarkdown;
      }

      isUpdatingFromServer.current = false;
      isInitialized.current = true;

      return;
    }

    if (!isFetching) {
      if (mode === 'narrative') {
        const narrativeText = chartDataFields?.rosNarrative?.text || '';
        const currentText = editor.getText();

        if (currentText !== narrativeText) {
          isUpdatingFromServer.current = true;
          editor.commands.setContent(narrativeText, { emitUpdate: false });
          lastContent.current = narrativeText;

          isUpdatingFromServer.current = false;
        }
      } else {
        const rosMarkdown = chartDataFields?.ros?.text || '';
        const currentMarkdown = rosToMarkdown(editor.state.doc);

        if (currentMarkdown !== rosMarkdown) {
          const doc = markdownToRos(rosMarkdown);
          isUpdatingFromServer.current = true;
          editor.commands.setContent(doc, { emitUpdate: false });
          lastContent.current = rosMarkdown;

          isUpdatingFromServer.current = false;
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
    mode,
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

    if (isEmptyNarrative(narrative)) {
      enqueueSnackbar?.('No ROS items selected to generate narrative', {
        variant: 'warning',
      });

      return;
    }
    setMode('narrative');

    onRosNarrativeChange(narrative);

    isUpdatingFromServer.current = true;
    editor.commands.setContent(narrative, { emitUpdate: false });
    lastContent.current = narrative;

    isUpdatingFromServer.current = false;
  };

  const handleDeleteNarrative = (): void => {
    setMode('ros');
    onRosNarrativeChange('');

    const rosMarkdown = chartDataFields?.ros?.text || '';
    const doc = markdownToRos(rosMarkdown);
    isUpdatingFromServer.current = true;
    editor?.commands.setContent(doc, { emitUpdate: false });
    lastContent.current = rosMarkdown;

    isUpdatingFromServer.current = false;
  };

  const insertRosTemplate = useCallback(() => {
    if (!editor) return;
    if (mode !== 'ros') return;

    const markdown = ROS_TEMPLATE;

    isUpdatingFromServer.current = true;
    editor.commands.setContent(markdownToRos(markdown), { emitUpdate: false });
    lastContent.current = markdown;
    onRosChange(markdown);

    isUpdatingFromServer.current = false;
  }, [editor, mode, onRosChange]);
  const isLoading = isRosLoading || isRosNarrativeLoading;

  return (
    <Box>
      {mode === 'ros' && (
        <GenericToolTip title={'Insert ROS template'}>
          <Box sx={{ display: 'flex', justifyContent: 'end' }}>
            <IconButton
              size="small"
              onClick={insertRosTemplate}
              disabled={isLoading || !editor}
              aria-label="Insert ROS template"
            >
              <PostAddIcon fontSize="small" />
            </IconButton>
          </Box>
        </GenericToolTip>
      )}
      <RosEditor editor={editor} isLoading={isLoading} dataTestId={dataTestIds.telemedEhrFlow.hpiChiefComplaintRos} />
      {mode === 'ros' && (
        <Box sx={{ mt: 2 }}>
          <RoundedButton variant="contained" onClick={handleGenerateNarrative} disabled={isLoading || !editor}>
            Generate ROS Narrative
          </RoundedButton>
        </Box>
      )}
      {mode === 'narrative' && (
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
