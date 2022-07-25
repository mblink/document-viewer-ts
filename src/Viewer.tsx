import React, { useEffect, useRef } from 'react';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { renderDocument } from './base';

type ViewerProps = {
  documentId: string;
  documentUrl: string;
  workerSrc: string;
};

export const Viewer: React.FC<ViewerProps> = (props: ViewerProps) => {
  GlobalWorkerOptions.workerSrc = props.workerSrc;
  const viewerContainer = useRef<HTMLDivElement>(null);
  useEffect(() => { viewerContainer.current && renderDocument(viewerContainer.current); }, []);
  return <div
    ref={viewerContainer}
    className="viewer-container"
    id={props.documentId}
    data-document-url={props.documentUrl}
  />;
};