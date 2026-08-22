import { CustomContentProps, MaterialDesignContent } from 'notistack';
import { forwardRef } from 'react';
import { taskIdFromExportSnackbarKey } from '../model/medicalRecordExportPolling';
import { ExportProgressMessage } from './ExportProgressMessage';

/**
 * Propless (`true`, not an object) on purpose: `VariantOverrides` is global, so a required extra prop here
 * would make `enqueueSnackbar` demand it at unrelated call sites. The job comes from the snackbar key.
 */
declare module 'notistack' {
  interface VariantOverrides {
    medicalRecordExport: true;
  }
}

/**
 * Registered as a notistack variant in `App.tsx`. Renders notistack's own `MaterialDesignContent` so it
 * matches every other snackbar in the EHR; only the message body differs. A variant rather than the
 * `content` option, which is deprecated and would mean assembling those props by hand.
 */
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
