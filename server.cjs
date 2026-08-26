const express = require('express');
const path = require('path');

const app = express();

app.use(express.json({ limit: '25mb' }));

const hostname = '0.0.0.0';
const port = 8080;
app.listen(port, hostname, () => {
  console.log(`Server is running on ${hostname}:${port}.`);
});

app.use('/', express.static('./'));
app.use('/', express.static('build'));
app.use('/', express.static('example'));
app.use('/', express.static('node_modules/pdfjs-dist/legacy/build'));
// The viewer derives `wasmUrl` from `workerSrc`, so the decoders and their
// no-wasm JS fallbacks must sit next to the worker.
app.use('/wasm', express.static(path.join('node_modules', 'pdfjs-dist', 'wasm')));
