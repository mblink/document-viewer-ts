import { GlobalWorkerOptions, PDFDocumentProxy, PDFPageProxy, PageViewport, getDocument, renderTextLayer } from 'pdfjs-dist';
import { TextContent } from 'pdfjs-dist/types/src/display/api';

const DEFAULT_URL = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/examples/learning/helloworld.pdf';
export interface ViewerWindow extends Window {
  viewerState: {
    [key: string]: {
      pageBreaks: number[];
      canvasElements: HTMLCanvasElement[];
    };
  };
}

const chevronLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
</svg>`;

const chevronRight = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
</svg>`;

const plusSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"><g xmlns="http://www.w3.org/2000/svg" fill="#fff">
<polygon opacity=".85" enable-background="new" points="9 8 9 6 8 6 8 8 6 8 6 9 8 9 8 11 9 11 9 9 11 9 11 8"/>
<path d="m16.742 15.501l-2.742-2.743h-0.643l-0.684-0.683c0.827-0.962 1.327-2.209 1.327-3.575 0-3.038-2.463-5.5-5.5-5.5s-5.5 2.462-5.5 5.5 2.463 5.5 5.5 5.5c1.367 0 2.613-0.501 3.576-1.327l0.684 0.683v0.644l2.742 2.742c0.342 0.343 0.896 0.344 1.24 0.001 0.344-0.345 0.344-0.898 0-1.242zm-8.242-3.301c-2.044 0-3.7-1.657-3.7-3.7s1.656-3.7 3.7-3.7c2.043 0 3.699 1.657 3.699 3.7s-1.656 3.7-3.699 3.7z"/>
</g></svg>`;

const minusSvg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="16" height="16"><g xmlns="http://www.w3.org/2000/svg" fill="#fff">
<path d="m16.742 15.501l-2.742-2.743h-0.643l-0.684-0.684c0.827-0.961 1.327-2.208 1.327-3.574 0-3.037-2.463-5.5-5.5-5.5s-5.5 2.463-5.5 5.5 2.463 5.5 5.5 5.5c1.367 0 2.613-0.502 3.576-1.326l0.684 0.682v0.644l2.742 2.742c0.342 0.343 0.896 0.344 1.24 0.001 0.344-0.345 0.344-0.898 0-1.242zm-8.242-3.301c-2.044 0-3.7-1.657-3.7-3.7s1.656-3.7 3.7-3.7c2.043 0 3.699 1.657 3.699 3.7s-1.656 3.7-3.699 3.7z"/>
<polygon opacity=".85" enable-background="new" points="9 8 8 8 6 8 6 9 8 9 9 9 11 9 11 8"/>
</g></svg>`;

const vw = window as unknown as ViewerWindow;
vw.viewerState = {};

const pdfScale = 10;
const zoomedWidth = '100%';
const defaultWidth = '80%';

const recalculatePDFPageBreaks = (documentId: string) => {
  (vw.viewerState[documentId] || { pageBreaks: [] }).pageBreaks =
    (vw.viewerState[documentId]?.canvasElements || []).reduce(
      (acc: number[], curr: HTMLCanvasElement) => {
        const breakPoint = (acc[(acc.length || 0) - 1] || - (curr.offsetHeight / 2 + 16)) + curr.offsetHeight + 32;
        return [...acc, breakPoint];
      },
      []
    );
};

const scalePDF = (
  textLayerDiv: HTMLDivElement,
  textContent: TextContent,
  pdfPage: PDFPageProxy,
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
  documentId: string,
) => {
  textLayerDiv.innerHTML = '';
  const scale =  pdfScale * (canvas.offsetWidth / viewport.width);
  const vs = pdfPage.getViewport({ scale });
  textLayerDiv.style.width = `${vs.width}px`;
  textLayerDiv.style.height = `${vs.height}px`;
  renderTextLayer({
    textContent,
    container: textLayerDiv as unknown as DocumentFragment,
    viewport: vs
  });
  recalculatePDFPageBreaks(documentId);
};

export const renderPDF = async (containerDiv: Element, documentUrl: string) => {
  const documentId = containerDiv.id;
  vw.viewerState[documentId] = {
    pageBreaks: [],
    canvasElements: [],
  };

  const getPageId = (pageNumber: number) => `${documentId}-page-${pageNumber}`;

  const getPage = (scrollTop: number) => Math.min(
    (vw.viewerState[documentId]?.pageBreaks.filter(b => b < scrollTop).length || 0) + 1,
    vw.viewerState[documentId]?.pageBreaks.length || Infinity
  );

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvasContainer';
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'viewerControls';
  const fullPageNumberDiv = document.createElement('div');
  fullPageNumberDiv.className = 'pageNumber';
  const pageNumberDiv = document.createElement('div');
  pageNumberDiv.className = 'pageNumberRaw';
  const pageDiv = document.createElement('div');
  const outOfDiv = document.createElement('div');
  const pageCountDiv = document.createElement('div');
  const nextButton = document.createElement('button');
  nextButton.className = 'nextButton';
  const prevButton = document.createElement('button');
  prevButton.className = 'prevButton';
  const zoomButton = document.createElement('button');
  zoomButton.className = 'zoomButton';
  const loadingTask = getDocument(documentUrl);

  // handle updating page number on scroll
  canvasContainer.onscroll = () => {
    const pageNumber = getPage(canvasContainer.scrollTop);
    pageNumberDiv.textContent = `${pageNumber}`;
    if (!controlsDiv.style.opacity) {
      controlsDiv.style.opacity = '1';
      setTimeout(() => controlsDiv.removeAttribute('style'), 1000);
    }
  };

  try {
    const pdfDocument: PDFDocumentProxy = await loadingTask.promise;

    // initial viewer setup
    pageNumberDiv.textContent = '1';
    pageDiv.textContent = 'Page ';
    outOfDiv.textContent = '/';
    pageCountDiv.textContent = `${pdfDocument.numPages}`;
    fullPageNumberDiv.appendChild(pageDiv);
    fullPageNumberDiv.appendChild(pageNumberDiv);
    fullPageNumberDiv.appendChild(outOfDiv);
    fullPageNumberDiv.appendChild(pageCountDiv);

    nextButton.onclick = () => {
      const pageNumber = parseInt(pageNumberDiv.textContent || '1');
      if (pageNumber < pdfDocument.numPages) {
        const nextPage = getPageId(pageNumber + 1);
        canvasContainer.scrollTo({ top: (document.getElementById(nextPage)?.parentElement as HTMLElement).offsetTop });
        pageNumberDiv.textContent = `${pageNumber + 1}`;
      }
    };
    prevButton.onclick = () => {
      const pageNumber = parseInt(pageNumberDiv.textContent || '1');
      if (pageNumber > 1) {
        const prevPage = getPageId(pageNumber - 1);
        canvasContainer.scrollTo({ top: (document.getElementById(prevPage)?.parentElement as HTMLElement).offsetTop });
        pageNumberDiv.textContent = `${pageNumber - 1}`;
      }
    };
    nextButton.innerHTML = chevronRight;
    prevButton.innerHTML = chevronLeft;

    zoomButton.innerHTML = plusSvg;
    containerDiv.appendChild(controlsDiv);
    controlsDiv.appendChild(prevButton);
    controlsDiv.appendChild(fullPageNumberDiv);
    controlsDiv.appendChild(nextButton);
    controlsDiv.appendChild(zoomButton);
    containerDiv.appendChild(canvasContainer);
    const pages = [...Array(pdfDocument.numPages).keys()];

    // load each page synchronously so that they appear in order
    while (pages.length) {
      const page = pages.shift();
      if (page !== undefined) {
        // render the PDF page
        const pageContainer = document.createElement('div');
        pageContainer.className = 'pageContainer';
        pageContainer.style.width = defaultWidth;
        canvasContainer.appendChild(pageContainer);
        const pdfPage = await pdfDocument.getPage(page + 1);
        const viewport = pdfPage.getViewport({ scale: pdfScale });
        const canvas = document.createElement('canvas');
        canvas.className ='pdfViewerCanvas';
        canvas.id = getPageId(page + 1);
        pageContainer.appendChild(canvas);
        vw.viewerState[documentId]?.canvasElements.push(canvas);
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        const ctx = canvas.getContext('2d');
        await pdfPage.render({
          canvasContext: ctx || {},
          viewport,
        });

        // initial setup for page breakpoints
        const breakPoint =
          (vw.viewerState[documentId]?.pageBreaks[(vw.viewerState[documentId]?.pageBreaks.length || 0) - 1] || - (canvas.offsetHeight / 2 + 16)) + canvas.offsetHeight + 32;
        vw.viewerState[documentId]?.pageBreaks.push(breakPoint);

        // render text layer for selection purposes
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        const textContent = await pdfPage.getTextContent();
        pageContainer.appendChild(textLayerDiv);
        scalePDF(
          textLayerDiv,
          textContent,
          pdfPage,
          canvas,
          viewport,
          documentId
        );

        // handle zoom in/out
        zoomButton.addEventListener('click', () => {
          if (pageContainer.style.width === defaultWidth) {
            pageContainer.style.width = zoomedWidth;
            zoomButton.innerHTML = minusSvg;
          } else {
            pageContainer.style.width = defaultWidth;
            zoomButton.innerHTML = plusSvg;
          }
          scalePDF(
            textLayerDiv,
            textContent,
            pdfPage,
            canvas,
            viewport,
            documentId
          );
        });

        // make sure text selection layer and page breaks resize dynamically
        window.addEventListener('resize', () => {
          scalePDF(
            textLayerDiv,
            textContent,
            pdfPage,
            canvas,
            viewport,
            documentId
          );
        });
      }
    }
    return;
  } catch(err) {
    const errorDiv = document.createElement('div');
    errorDiv.textContent = `There was an error fetching your document. Please try again later. Error: ${err}`;
    containerDiv.append(errorDiv);
    return err;
  }
};

const renderDocx = (containerDiv: Element, documentUrl: string) => {
  const microsoftViewer = document.createElement('iframe');
  microsoftViewer.width = '100%';
  microsoftViewer.height='100%';
  microsoftViewer.setAttribute('frameborder', '0');
  const params = new URLSearchParams({ src: documentUrl });
  microsoftViewer.setAttribute('src', `https://view.officeapps.live.com/op/embed.aspx?${params.toString()}`);
  containerDiv.appendChild(microsoftViewer);
};

export const renderDocument = (containerDiv: Element) => {
  const documentUrl = containerDiv.getAttribute('data-document-url') || DEFAULT_URL;
  const splitOnPeriods = documentUrl.split('.');
  const extension = splitOnPeriods[(splitOnPeriods.length - 1)]?.split('?')[0];
  if (extension === 'pdf') {
    renderPDF(containerDiv, documentUrl);
  } else if (extension === 'doc' || extension === 'docx') {
    renderDocx(containerDiv, documentUrl);
  }
};

const loadDocuments = () => {
  const containerDivs = document.getElementsByClassName('viewerContainer');
  Array.from(containerDivs).forEach(renderDocument);
};

export const init = (workerSrc: string) => {
  // The workerSrc property shall be specified.
  GlobalWorkerOptions.workerSrc = workerSrc;
  loadDocuments();
  window.addEventListener('load', loadDocuments);
};