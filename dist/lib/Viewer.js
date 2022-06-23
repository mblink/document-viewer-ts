"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Viewer = void 0;
const react_1 = require("react");
const pdfjs_dist_1 = require("pdfjs-dist");
const base_1 = require("./base");
const Viewer = (props) => {
    pdfjs_dist_1.GlobalWorkerOptions.workerSrc = props.workerSrc;
    const viewerContainer = (0, react_1.useRef)(null);
    (0, react_1.useEffect)(() => { viewerContainer.current && (0, base_1.renderDocument)(viewerContainer.current); }, []);
    return react_1.default.createElement("div", { ref: viewerContainer, className: "viewerContainer", id: props.documentId, "data-document-url": props.documentUrl });
};
exports.Viewer = Viewer;
//# sourceMappingURL=Viewer.js.map