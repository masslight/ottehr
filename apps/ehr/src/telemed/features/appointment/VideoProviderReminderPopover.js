"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VideoProviderReminderPopover = void 0;
var material_1 = require("@mui/material");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../../hooks/useEvolveUser");
var getSelectors_1 = require("../../../shared/store/getSelectors");
var assets_1 = require("../../assets");
var components_1 = require("../../components");
var hooks_1 = require("../../hooks");
var state_1 = require("../../state");
var VideoProviderReminderPopover = function () {
    var _a, _b, _c;
    var availableStates = (0, hooks_1.useGetAppointmentAccessibility)().licensedPractitionerStates;
    var questionnaireResponse = (0, getSelectors_1.getSelectors)(state_1.useAppointmentStore, ['questionnaireResponse']).questionnaireResponse;
    var user = (0, useEvolveUser_1.default)();
    var providerName = (user === null || user === void 0 ? void 0 : user.userName) || '___';
    var states = availableStates && availableStates.length > 0 ? availableStates.join(', ') : '___';
    var address = ((_c = (_b = (_a = (0, utils_1.getQuestionnaireResponseByLinkId)('patient-street-address', questionnaireResponse)) === null || _a === void 0 ? void 0 : _a.answer) === null || _b === void 0 ? void 0 : _b[0]) === null || _c === void 0 ? void 0 : _c.valueString) ||
        '___';
    return (<components_1.InnerStatePopover popoverChildren={<material_1.Box sx={{ p: 2, maxWidth: '330px' }}>
          <material_1.Typography fontWeight={500}>Provider reminder</material_1.Typography>
          <material_1.Typography>
            Please confirm the patient's name, DOB, and introduce yourself with your licensure and credentials (e.g. My
            name is Dr. {providerName} and I am licensed in {states} and board certified in pediatrics). For patients
            located in NJ you must also confirm their address, the address for this patient is: {address}
          </material_1.Typography>
        </material_1.Box>} popoverProps={{ sx: undefined }}>
      {function (_a) {
            var handlePopoverOpen = _a.handlePopoverOpen;
            return (<material_1.Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }} onClick={handlePopoverOpen}>
          <assets_1.ReminderIcon fontSize="small"/>
          <material_1.Typography variant="body2" fontWeight={500}>
            Reminder
          </material_1.Typography>
        </material_1.Box>);
        }}
    </components_1.InnerStatePopover>);
};
exports.VideoProviderReminderPopover = VideoProviderReminderPopover;
//# sourceMappingURL=VideoProviderReminderPopover.js.map