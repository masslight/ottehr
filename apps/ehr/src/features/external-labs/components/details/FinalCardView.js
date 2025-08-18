"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FinalCardView = void 0;
var BiotechOutlined_1 = require("@mui/icons-material/BiotechOutlined");
var lab_1 = require("@mui/lab");
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var FinalCardView = function (_a) {
    var resultPdfUrl = _a.resultPdfUrl, labStatus = _a.labStatus, onMarkAsReviewed = _a.onMarkAsReviewed, loading = _a.loading;
    var openPdf = function () {
        if (resultPdfUrl) {
            window.open(resultPdfUrl, '_blank');
        }
    };
    var isMarkAsReviewedButtonVisible = labStatus === utils_1.ExternalLabsStatus.received || labStatus === utils_1.ExternalLabsStatus.corrected;
    return (<material_1.Box sx={{ border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: '#fff' }}>
      <material_1.Box sx={{ padding: 2 }}>
        <material_1.Button variant="outlined" startIcon={<BiotechOutlined_1.default />} onClick={openPdf} sx={{ borderRadius: '50px', textTransform: 'none' }} disabled={!resultPdfUrl}>
          View Results
        </material_1.Button>
      </material_1.Box>

      {/* while toggle is hidden, the bottom panel is visible only when the button is visible */}
      {isMarkAsReviewedButtonVisible ? (<>
          <material_1.Divider />

          <material_1.Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 2 }}>
            <material_1.Box sx={{ display: 'flex', alignItems: 'center' }}>
              {/* <Switch
                  disabled={true} // todo: will be released in the future
                  checked={false} // todo: will be released in the future
                  onChange={() => null} // todo: will be released in the future
                  color="primary"
                  sx={{ mr: 1 }}
                />
                <Typography variant="body2">Show Results on the Patient Portal</Typography> */}
            </material_1.Box>

            {isMarkAsReviewedButtonVisible ? (<lab_1.LoadingButton loading={loading} variant="contained" onClick={onMarkAsReviewed} sx={{
                    borderRadius: '50px',
                    textTransform: 'none',
                }} color="primary">
                Mark as Reviewed
              </lab_1.LoadingButton>) : null}
          </material_1.Box>
        </>) : null}
    </material_1.Box>);
};
exports.FinalCardView = FinalCardView;
//# sourceMappingURL=FinalCardView.js.map