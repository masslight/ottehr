"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrelimCardView = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var PrelimCardView = function (_a) {
    var resultPdfUrl = _a.resultPdfUrl, receivedDate = _a.receivedDate, reviewedDate = _a.reviewedDate, onPrelimView = _a.onPrelimView, timezone = _a.timezone;
    var getDateEvent = function () {
        return receivedDate
            ? { event: 'received', date: (0, utils_1.formatDateForLabs)(receivedDate, timezone) }
            : { event: 'reviewed', date: (0, utils_1.formatDateForLabs)(reviewedDate, timezone) };
    };
    var openPdf = function () {
        if (resultPdfUrl) {
            // additional handling for prelim, prelim resources are marked as reviewed when pdf is viewed (resources are updated, but we didn't show it in the UI),
            // the final results resources are marked as reviewed by clicking on "mark as reviewed" and we show it in the UI
            onPrelimView();
            window.open(resultPdfUrl, '_blank');
        }
    };
    var _b = getDateEvent(), event = _b.event, date = _b.date;
    return (<material_1.Paper elevation={0} sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            p: 2,
            borderRadius: 1,
            border: '1px solid #e0e0e0',
            backgroundColor: '#fff',
        }}>
      <material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <material_1.Typography variant="body1" color="text.primary">
          Preliminary results ({event} {date})
        </material_1.Typography>
      </material_1.Box>

      <material_1.Button disabled={!resultPdfUrl} onClick={openPdf} variant="text" color="primary" sx={{ fontWeight: 700, textTransform: 'none' }}>
        View
      </material_1.Button>
    </material_1.Paper>);
};
exports.PrelimCardView = PrelimCardView;
//# sourceMappingURL=PrelimCardView.js.map