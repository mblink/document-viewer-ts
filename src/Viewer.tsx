import React, { useEffect, useRef } from 'react';
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { renderDocument } from './base';

export const Viewer: React.FC<{
  documentId: string;
  documentUrl: string;
  workerSrc: string;}
> = (props: {
  documentId: string;
  documentUrl: string;
  workerSrc: string;
}) => {
  GlobalWorkerOptions.workerSrc = props.workerSrc;
  const viewerContainer = useRef<HTMLDivElement>(null);
  useEffect(() => { viewerContainer.current && renderDocument(viewerContainer.current); }, []);
  return <div
    ref={viewerContainer}
    className="viewerContainer"
    id={props.documentId}
    data-document-url={props.documentUrl}
  />;
};