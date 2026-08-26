
# Document Viewer
## PDF and DOCX viewer for Vanilla JavaScript and React applications

![license](https://img.shields.io/npm/l/document-viewer-ts)
![npm](https://img.shields.io/npm/v/document-viewer-ts)
![npm bundle size](https://img.shields.io/bundlephobia/minzip/document-viewer-ts)

### Installation
Requires peer dependency `pdfjs-dist` (v6 or later):

```
npm install pdfjs-dist
```

Install the package:

```
npm install document-viewer-ts
```

### Serving the worker and the wasm decoders

Copy the pdf.js worker to a served location, and copy `pdfjs-dist/wasm` **into a
`wasm/` directory beside it**. The viewer derives pdf.js's `wasmUrl` from the
`workerSrc` you pass in; pdf.js's own default is page-relative and 404s on any
nested route, which takes down JBIG2/JPEG2000 image decoding along with it.

`webpack.config.ts`
```
import CopyPlugin from "copy-webpack-plugin";

...

const config = {
  ...
  plugins: [
    ...
    new CopyPlugin({
      patterns: [
        {
          from: "PATH/TO/NODE_MODULES/pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          to: "PATH/TO/WORKER/pdf.worker.min.mjs"
        },
        {
          from: "PATH/TO/NODE_MODULES/pdfjs-dist/wasm",
          to: "PATH/TO/WORKER/wasm"
        }
      ]
    })
  ]
}

...

```

#### With HTML and Vanilla JS

Call the init script in the root of your JS application using the path to your worker file.

`index.js`
```
import { init } from 'document-viewer-ts'

init("PATH/TO/WORKER/pdf.worker.min.mjs");
```

Wherever you want to include a document viewer in the HTML, include a `<div />` with `class="viewer-container"` and `id` being some unique key (on the page) and `data-document-url` being the url of the document you want to display. Also make sure you're importing `styles.css` from the package in your HTML head.

`index.html`
```
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <script src="./index.js"></script>
    <link rel="stylesheet" href="../node_modules/document-viewer-ts/styles/styles.css"></link>
  </head>
  <body>
    <div class="viewer-container" id="doc-1" data-document-url="https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"></div>
  </body>
</html>
```

### With React

Import the `Viewer` component and call it with the proper `documentId`, `documentUrl`, and `workerSrc` props. Also make sure to import `styles.css` in your app.

`index.jsx`
```
import React from 'react'
import { Viewer } from 'document-viewer-ts'
export default () =>
  <Viewer
    documentId="doc-1"
    documentUrl="https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf"
    workerSrc="PATH/TO/WORKER/pdf.worker.min.mjs"
  />
```

`renderDocument` returns a teardown function, and the React `Viewer` calls it on
unmount: it cancels any in-flight page render, removes the resize listener and
destroys the pdf.js document and its worker.
