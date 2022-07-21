import { GlobalWorkerOptions, PDFDocumentProxy, PDFPageProxy, PageViewport, getDocument, renderTextLayer } from 'pdfjs-dist';
import { TextContent } from 'pdfjs-dist/types/src/display/api';

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

const handleError = (containerDiv: Element) =>(err: unknown) => {
  const errorDiv = document.createElement('div');
  errorDiv.textContent = `There was an error fetching your document. Please try again later. Error: ${err}`;
  containerDiv.append(errorDiv);
};

const pdfScale = 10;
const zoomedWidth = '100%';
const defaultWidth = '80%';

const scaleTextLayer = async (
  textLayerDiv: HTMLDivElement,
  textContent: TextContent,
  pdfPage: PDFPageProxy,
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
) => {
  textLayerDiv.innerHTML = '';
  const textLayerFragment = document.createDocumentFragment();
  const scale =  pdfScale * (canvas.offsetWidth / viewport.width);
  const vs = pdfPage.getViewport({ scale });
  textLayerDiv.style.width = `${vs.width}px`;
  textLayerDiv.style.height = `${vs.height}px`;
  await renderTextLayer({
    textContent,
    container: textLayerFragment,
    viewport: vs
  }).promise;
  textLayerDiv.appendChild(textLayerFragment);
};

export const renderPDF = async (containerDiv: Element, documentUrl: string) => {
  const documentId = containerDiv.id;

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvasContainer';
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'viewerControls';
  const fullPageNumberDiv = document.createElement('div');
  fullPageNumberDiv.className = 'pageNumber';
  const pageNumberInput = document.createElement('input');
  pageNumberInput.className = 'pageNumberInput';
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

  try {
    const pdfDocument: PDFDocumentProxy = await loadingTask.promise;

    const isValidPage = (page: number) => page <= pdfDocument.numPages && page > 0;

    // initial viewer setup
    pageNumberInput.value = '1';
    pageDiv.textContent = 'Page ';
    outOfDiv.textContent = '/';
    pageCountDiv.textContent = `${pdfDocument.numPages}`;
    fullPageNumberDiv.appendChild(pageDiv);
    fullPageNumberDiv.appendChild(pageNumberInput);
    fullPageNumberDiv.appendChild(outOfDiv);
    fullPageNumberDiv.appendChild(pageCountDiv);

    // page container setup
    const pageContainer = document.createElement('div');
    pageContainer.className = 'pageContainer';
    pageContainer.style.width = defaultWidth;
    canvasContainer.appendChild(pageContainer);
    const canvas = document.createElement('canvas');
    canvas.className ='pdfViewerCanvas';
    canvas.id = `${documentId}-canvas`;
    pageContainer.appendChild(canvas);

    // text layer setup
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'textLayer';
    pageContainer.appendChild(textLayerDiv);

    nextButton.innerHTML = chevronRight;
    prevButton.innerHTML = chevronLeft;

    zoomButton.innerHTML = plusSvg;

    containerDiv.appendChild(controlsDiv);
    controlsDiv.appendChild(prevButton);
    controlsDiv.appendChild(fullPageNumberDiv);
    controlsDiv.appendChild(nextButton);
    controlsDiv.appendChild(zoomButton);
    containerDiv.appendChild(canvasContainer);

    const displayPage = async (page: number) => {
      pageNumberInput.value = `${page}`;
      const pdfPage = await pdfDocument.getPage(page);
      const viewport = pdfPage.getViewport({ scale: pdfScale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width = '100%';
      const ctx = canvas.getContext('2d');
      await pdfPage.render({
        canvasContext: ctx || {},
        viewport,
      });
      const textContent = await pdfPage.getTextContent();
      scaleTextLayer(
        textLayerDiv,
        textContent,
        pdfPage,
        canvas,
        viewport,
      );
      zoomButton.onclick = () => {
        if (pageContainer.style.width === defaultWidth) {
          pageContainer.style.width = zoomedWidth;
          zoomButton.innerHTML = minusSvg;
        } else {
          pageContainer.style.width = defaultWidth;
          zoomButton.innerHTML = plusSvg;
        }
        scaleTextLayer(
          textLayerDiv,
          textContent,
          pdfPage,
          canvas,
          viewport,
        );
      };
    };

    const skipPage = (direction: number) => () => {
      const pageNumber = parseInt(pageNumberInput.value || '1');
      const nextPageNumber = pageNumber + direction;
      if (isValidPage(nextPageNumber)) {
        displayPage(nextPageNumber);
      }
    };
    nextButton.onclick = skipPage(1);
    prevButton.onclick = skipPage(-1);

    pageNumberInput.onchange = () => {
      const pageNumber = Math.max(Math.min(parseInt(pageNumberInput.value), pdfDocument.numPages), 1);
      displayPage(pageNumber);
    };

    pageNumberInput.addEventListener('click', (e) => e.stopPropagation());

    containerDiv.addEventListener('keydown', (e) => {
      e.stopPropagation();
      switch((e as KeyboardEvent).key) {
        case('ArrowLeft'):
          skipPage(-1)();
          return;
        case('ArrowRight'):
          skipPage(1)();
          return;
        default:
          return;
      }
    });

    containerDiv.addEventListener('click', () => {
      (containerDiv as HTMLDivElement).focus();
    });

    containerDiv.setAttribute('tabIndex', '1');

    (containerDiv as HTMLDivElement).focus();

    await displayPage(1);
  } catch(err) {
    handleError(containerDiv)(err);
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

const renderTxt = (containerDiv: Element, documentUrl: string) => {
  const embed = document.createElement('embed');
  embed.className = 'txtEmbed';
  embed.setAttribute('src', documentUrl);
  containerDiv.appendChild(embed);
};

export const renderDocument = (containerDiv: Element) => {
  try {
    const documentUrl = containerDiv.getAttribute('data-document-url');
    if (!documentUrl) throw new Error('No document url specified');
    const splitOnPeriods = documentUrl.split('.');
    const extension = splitOnPeriods[(splitOnPeriods.length - 1)]?.split('?')[0];
    switch(extension) {
      case 'pdf':
        renderPDF(containerDiv, documentUrl);
        return;
      case 'doc': case 'docx': case 'ppt': case 'pptx': case 'xls': case 'xlsx': case 'xlt': case 'xlsm': case 'xlw': case 'pps': case 'ppxs': case 'ppsm': case 'sldx': case 'sldm':
        renderDocx(containerDiv, documentUrl);
        return;
      case 'txt':
        renderTxt(containerDiv, documentUrl);
        return;
      default:
        throw new Error('This file type is not supported for viewing in a web browser. Please click the “Download” button to view this document.');
    }
  } catch(err) {
    handleError(containerDiv)(err);
  }
};

const loadDocuments = () => {
  const containerDivs = document.getElementsByClassName('viewerContainer');
  Array.from(containerDivs).forEach(renderDocument);
};

export const init = (workerSrc: string) => {
  GlobalWorkerOptions.workerSrc = workerSrc;
  loadDocuments();
  window.addEventListener('load', loadDocuments);
};