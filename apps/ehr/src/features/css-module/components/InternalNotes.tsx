import React from 'react';
import { CSS_NOTE_ID, NOTE_TYPE, PRIVATE_EXTENSION_BASE_URL } from 'utils';
import { useGetChartData } from '../../../telemed';
import { useOystehrAPIClient } from '../../../telemed/hooks/useOystehrAPIClient';
import { useInternalNotesModal } from '../hooks/useInternalNotes';
import { ButtonRounded } from './RoundedButton';

const icon = (
  <svg width="20" height="20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 11.833a2.17 2.17 0 0 1-1.594-.656 2.17 2.17 0 0 1-.656-1.594c0-.625.219-1.156.656-1.593A2.17 2.17 0 0 1 10 7.333a2.17 2.17 0 0 1 1.594.657c.437.437.656.968.656 1.593a2.17 2.17 0 0 1-.656 1.594 2.17 2.17 0 0 1-1.594.656Zm0 4c-2.028 0-3.875-.566-5.542-1.698-1.666-1.131-2.875-2.649-3.625-4.552.75-1.902 1.959-3.42 3.625-4.552C6.125 3.9 7.972 3.333 10 3.333c1.958 0 3.747.528 5.365 1.584A9.796 9.796 0 0 1 19 9.167h-1.896a8.01 8.01 0 0 0-2.979-3.052A7.995 7.995 0 0 0 10 5c-1.57 0-3.01.413-4.323 1.24a8.144 8.144 0 0 0-3.01 3.343 8.144 8.144 0 0 0 3.01 3.344A7.954 7.954 0 0 0 10 14.167 8.364 8.364 0 0 0 11.667 14v1.688c-.278.041-.556.076-.834.104a8.395 8.395 0 0 1-.833.041Zm0-2.5a3.727 3.727 0 0 0 1.688-.396c.069-.694.288-1.319.656-1.874.368-.556.837-1 1.406-1.334v-.146c0-1.041-.364-1.927-1.094-2.656-.729-.73-1.614-1.094-2.656-1.094s-1.927.365-2.656 1.094c-.73.73-1.094 1.615-1.094 2.656 0 1.042.365 1.927 1.094 2.657.729.729 1.614 1.093 2.656 1.093Zm4.167 4.167a.806.806 0 0 1-.594-.24.806.806 0 0 1-.24-.593v-2.5c0-.236.08-.434.24-.594.16-.16.358-.24.594-.24V12.5c0-.458.163-.85.49-1.177.326-.327.718-.49 1.176-.49.459 0 .851.163 1.178.49.326.326.489.719.489 1.177v.833c.236 0 .434.08.594.24.16.16.24.358.24.594v2.5c0 .236-.08.434-.24.593a.806.806 0 0 1-.594.24h-3.333ZM15 13.333h1.667V12.5a.806.806 0 0 0-.24-.594.806.806 0 0 0-.594-.24.806.806 0 0 0-.593.24.806.806 0 0 0-.24.594v.833Z"
      fill="#2169F5"
    />
  </svg>
);

const noop = (): void => {
  return;
};

export const InternalNotes = ({ encounterId }: { encounterId: string }): React.ReactElement => {
  const apiClient = useOystehrAPIClient();
  const { isOpen, openModal, InternalNotesModal, closeModal } = useInternalNotesModal();
  const { data } = useGetChartData(
    {
      apiClient,
      encounterId,
      requestedFields: {
        notes: {
          _search_by: 'encounter',
          _sort: '-_lastUpdated',
          _count: 1000,
          _tag: `${PRIVATE_EXTENSION_BASE_URL}/${NOTE_TYPE.INTERNAL}|${CSS_NOTE_ID}`,
        },
      },
    },
    noop
  );

  const notesCount = data?.notes?.length ?? 0;

  return (
    <>
      <ButtonRounded
        variant="outlined"
        startIcon={icon}
        onClick={openModal}
        sx={{
          '& .button-text': {
            display: 'none',
            '@media (min-width: 1179px)': {
              display: 'inline',
            },
          },
        }}
      >
        <span className="button-text">Internal Notes</span> ({notesCount})
      </ButtonRounded>
      <InternalNotesModal open={isOpen} onClose={closeModal} />
    </>
  );
};
