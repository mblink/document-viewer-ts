import React, { useEffect, useRef } from 'react';
import { renderDocument } from './base';

type ViewerProps = {
  documentId: string;
  documentUrl: string;
  workerSrc: string;
};

export const Viewer: React.FC<ViewerProps> = (props: ViewerProps) => {
  const viewerContainer = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = viewerContainer.current;
    if (!container) return;
    const destroy = renderDocument(props.workerSrc)(container);

    return () => {
      destroy();
      container.replaceChildren();
    };
  }, [props.workerSrc, props.documentUrl, props.documentId]);

  return <div
    ref={viewerContainer}
    className="viewer-container"
    id={props.documentId}
    data-document-url={props.documentUrl}
  />;
};
