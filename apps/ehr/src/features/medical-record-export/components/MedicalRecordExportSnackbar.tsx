import { CustomContentProps, MaterialDesignContent } from 'notistack';
import { forwardRef } from 'react';
import { taskIdFromExportSnackbarKey } from '../model/medicalRecordExportPolling';
import { ExportProgressMessage } from './ExportProgressMessage';

declare module 'notistack' {
  interface VariantOverrides {
    medicalRecordExport: true;
  }
}

export const MedicalRecordExportSnackbar = forwardRef<HTMLDivElement, CustomContentProps>(
  function MedicalRecordExportSnackbar(props, ref) {
    const taskId = taskIdFromExportSnackbarKey(props.id);

    return (
      <MaterialDesignContent
        {...props}
        ref={ref}
        variant="info"
        message={taskId ? <ExportProgressMessage taskId={taskId} /> : props.message}
      />
    );
  }
);
