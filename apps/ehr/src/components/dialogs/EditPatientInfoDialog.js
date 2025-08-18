"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = EditPatientInfoDialog;
var icons_material_1 = require("@mui/icons-material");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
function EditPatientInfoDialog(_a) {
    var title = _a.title, modalOpen = _a.modalOpen, onClose = _a.onClose, input = _a.input, onSubmit = _a.onSubmit, submitButtonName = _a.submitButtonName, loading = _a.loading, error = _a.error, errorMessage = _a.errorMessage, modalDetails = _a.modalDetails;
    return (<material_1.Dialog open={modalOpen} onClose={onClose}>
      <material_1.Paper>
        <material_1.Box maxWidth="sm">
          <material_1.Box sx={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '16px', paddingRight: '16px' }}>
            <material_1.IconButton aria-label="Close" onClick={onClose}>
              <icons_material_1.Close />
            </material_1.IconButton>
          </material_1.Box>
          <material_1.Box margin={'0 40px 40px 40px'}>
            <form onSubmit={onSubmit}>
              <material_1.Typography sx={{ width: '100%' }} variant="h4" color="primary.main">
                {title}
              </material_1.Typography>
              {modalDetails}
              <material_1.Box sx={{ my: '24px' }}>{input}</material_1.Box>
              <material_1.Box sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
        }}>
                {error && (<material_1.Typography color="error" variant="body2" mb={2}>
                    {errorMessage}
                  </material_1.Typography>)}
                <lab_1.LoadingButton sx={{
            borderRadius: 100,
            textTransform: 'none',
            fontWeight: 600,
        }} variant="contained" type="submit" loading={loading}>
                  {submitButtonName}
                </lab_1.LoadingButton>
              </material_1.Box>
            </form>
          </material_1.Box>
        </material_1.Box>
      </material_1.Paper>
    </material_1.Dialog>);
}
//# sourceMappingURL=EditPatientInfoDialog.js.map