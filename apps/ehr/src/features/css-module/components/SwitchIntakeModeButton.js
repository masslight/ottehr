"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SwitchIntakeModeButton = void 0;
var react_1 = require("react");
var data_test_ids_1 = require("../../../constants/data-test-ids");
var RoundedButton_1 = require("./RoundedButton");
var SwitchIntakeModeButton = function (_a) {
    var isDisabled = _a.isDisabled, handleSwitchMode = _a.handleSwitchMode, nextMode = _a.nextMode;
    return (<RoundedButton_1.ButtonRounded data-testid={data_test_ids_1.dataTestIds.cssHeader.switchModeButton(nextMode)} variant="contained" disabled={isDisabled} onClick={handleSwitchMode}>
      Switch to {nextMode.charAt(0).toUpperCase() + nextMode.slice(1)} view
    </RoundedButton_1.ButtonRounded>);
};
exports.SwitchIntakeModeButton = SwitchIntakeModeButton;
//# sourceMappingURL=SwitchIntakeModeButton.js.map