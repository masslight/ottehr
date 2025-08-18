"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoTimer = void 0;
var InfoOutlined_1 = require("@mui/icons-material/InfoOutlined");
var material_1 = require("@mui/material");
var luxon_1 = require("luxon");
var notistack_1 = require("notistack");
var react_1 = require("react");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var components_1 = require("../../components");
var state_1 = require("../../state");
var utils_1 = require("../../utils");
var VideoTimer = function () {
    var _a;
    var encounter = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['encounter']).encounter;
    var _b = (0, react_1.useState)(), difference = _b[0], setDifference = _b[1];
    var _c = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['chartData', 'setPartialChartData']), chartData = _c.chartData, setPartialChartData = _c.setPartialChartData;
    var _d = (0, state_1.useSaveChartData)(), mutate = _d.mutate, isLoading = _d.isLoading;
    var addToVisitNote = ((_a = chartData === null || chartData === void 0 ? void 0 : chartData.addToVisitNote) === null || _a === void 0 ? void 0 : _a.value) || false;
    var onChange = function (value) {
        setPartialChartData({ addToVisitNote: { value: value } });
        mutate({ addToVisitNote: { value: value } }, {
            onSuccess: function (data) {
                var addToVisitNoteUpdated = data.chartData.addToVisitNote;
                if (addToVisitNoteUpdated) {
                    setPartialChartData({ addToVisitNote: addToVisitNoteUpdated });
                }
            },
            onError: function () {
                (0, notistack_1.enqueueSnackbar)('An error has occurred while adding to visit note. Please try again.', {
                    variant: 'error',
                });
                setPartialChartData({ addToVisitNote: chartData === null || chartData === void 0 ? void 0 : chartData.addToVisitNote });
            },
        });
    };
    (0, react_1.useEffect)(function () {
        var _a, _b;
        var startTime = (_b = (_a = encounter.statusHistory) === null || _a === void 0 ? void 0 : _a.find(function (item) { return item.status === 'in-progress'; })) === null || _b === void 0 ? void 0 : _b.period.start;
        if (!startTime) {
            return;
        }
        var interval = setInterval(function () { return setDifference(luxon_1.DateTime.fromISO(startTime).diffNow(['minute', 'second'])); }, 100);
        return function () {
            clearInterval(interval);
        };
    }, [encounter.statusHistory]);
    if (!difference) {
        return null;
    }
    return (<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <material_1.Typography fontWeight={500} sx={{ width: '45px' }}>
        {(0, utils_1.formatVideoTimerTime)(difference)}
      </material_1.Typography>

      <material_1.FormControlLabel sx={{
            mr: 0,
        }} control={<material_1.Checkbox sx={{
                color: '#C79DFF',
                '&.Mui-checked': {
                    color: '#C79DFF',
                },
                '&.Mui-disabled': {
                    color: (0, material_1.darken)('#C79DFF', 0.4),
                },
            }} disabled={isLoading} checked={addToVisitNote} onChange={function (e) { return onChange(e.target.checked); }}/>} label={<material_1.Typography sx={{ color: isLoading ? (0, material_1.darken)('#FFF', 0.4) : '#FFF' }}>Add to visit note</material_1.Typography>}/>

      <components_1.InnerStatePopover popoverChildren={<material_1.Typography sx={{ p: 2, maxWidth: '320px' }}>
            By checking this box you add time spent in visit statement to the progress note.
          </material_1.Typography>}>
        {function (_a) {
            var handlePopoverOpen = _a.handlePopoverOpen, handlePopoverClose = _a.handlePopoverClose;
            return (<InfoOutlined_1.default fontSize="small" onMouseEnter={handlePopoverOpen} onMouseLeave={handlePopoverClose}/>);
        }}
      </components_1.InnerStatePopover>
    </material_1.Box>);
};
exports.VideoTimer = VideoTimer;
//# sourceMappingURL=VideoTimer.js.map