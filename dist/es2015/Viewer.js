import React, { useEffect, useRef } from 'react';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { renderDocument } from './base';
export const Viewer = (props) => {
    GlobalWorkerOptions.workerSrc = props.workerSrc;
    const viewerContainer = useRef(null);
    useEffect(() => { viewerContainer.current && renderDocument(viewerContainer.current); }, []);
    return React.createElement("div", { ref: viewerContainer, className: "viewerContainer", id: props.documentId, "data-document-url": props.documentUrl });
};
//# sourceMappingURL=Viewer.js.map