"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingBoardPage = TrackingBoardPage;
var react_1 = require("react");
var utils_1 = require("utils");
var useEvolveUser_1 = require("../../hooks/useEvolveUser");
var features_1 = require("../features");
var state_1 = require("../state");
function TrackingBoardPage() {
    var user = (0, useEvolveUser_1.default)();
    (0, react_1.useEffect)(function () {
        var availableStates = (user === null || user === void 0 ? void 0 : user.profileResource) && (0, utils_1.allLicensesForPractitioner)(user.profileResource).map(function (item) { return item.state; });
        if (availableStates) {
            state_1.useTrackingBoardStore.setState({ availableStates: availableStates });
        }
    }, [user]);
    return <features_1.TrackingBoardBody />;
}
//# sourceMappingURL=TrackingBoardPage.js.map