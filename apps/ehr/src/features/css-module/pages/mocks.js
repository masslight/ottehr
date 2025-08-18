"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ERX = exports.mockStyle = void 0;
exports.mockStyle = {
    border: '2px solid red',
    padding: '20px',
    marginTop: '10px',
    borderRadius: '5px',
};
var MockComponent = function (_a) {
    var child = _a.child;
    return <div style={exports.mockStyle}>{child}</div>;
};
var ERX = function () { return <MockComponent child={<div>ERX</div>}/>; };
exports.ERX = ERX;
//# sourceMappingURL=mocks.js.map