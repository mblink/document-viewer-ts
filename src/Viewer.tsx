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
    viewerContainer.current && renderDocument(props.workerSrc)(viewerContainer.current);

    return () => {
      viewerContainer.current && viewerContainer.current.firstElementChild && viewerContainer.current.removeChild(viewerContainer.current.firstElementChild);
    };
  }, []);

  return <div
    ref={viewerContainer}
    className="viewer-container"
    id={props.documentId}
    data-document-url={props.documentUrl}
  />;
};