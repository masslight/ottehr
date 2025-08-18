"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useDispositionMultipleNotes = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var utils_1 = require("utils");
var utils_2 = require("../../../utils");
/**
 * This hook makes it possible to use DispositionDTO with a single note field as if we have unique note fields for each disposition type.
 * It creates a notes cache for each disposition type during the session and handles their usage.
 */
var useDispositionMultipleNotes = function (_a) {
    var methods = _a.methods, savedDisposition = _a.savedDisposition;
    var notesCacheRef = (0, react_1.useRef)({});
    var selectedDispositionType = (0, react_hook_form_1.useWatch)({ control: methods.control, name: 'type' });
    var savedNoteForCurrentDispositionType = methods.getValues('type') === (savedDisposition === null || savedDisposition === void 0 ? void 0 : savedDisposition.type) ? savedDisposition === null || savedDisposition === void 0 ? void 0 : savedDisposition.note : '';
    (0, react_1.useEffect)(function () {
        notesCacheRef.current[selectedDispositionType] =
            notesCacheRef.current[selectedDispositionType] ||
                savedNoteForCurrentDispositionType ||
                (0, utils_1.getDefaultNote)(selectedDispositionType);
        methods.resetField('note', {
            defaultValue: notesCacheRef.current[selectedDispositionType],
            keepTouched: true,
        });
    }, [methods, savedNoteForCurrentDispositionType, selectedDispositionType]);
    var setNoteCache = (0, react_1.useCallback)(function (note) {
        return (notesCacheRef.current[methods.getValues('type')] = note);
    }, [methods]);
    var withNote = (0, react_1.useCallback)(function (values) {
        var _a;
        return (0, utils_2.mapFormToDisposition)(__assign(__assign({}, values), { note: (_a = notesCacheRef.current[values.type]) !== null && _a !== void 0 ? _a : '' }));
    }, []);
    return { setNoteCache: setNoteCache, withNote: withNote };
};
exports.useDispositionMultipleNotes = useDispositionMultipleNotes;
//# sourceMappingURL=useDispositionMultipleNotes.js.map