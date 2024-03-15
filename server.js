const express = require('express');

const app = express();

app.use(express.json({ limit: '25mb' }));

const hostname = "0.0.0.0";
const port = 8080;
app.listen(port, hostname, () => {
  console.log(`Server is running on ${hostname}:${port}.`);
});


app.use('/', express.static('./'));
app.use('/', express.static('build'));
app.use('/', express.static('example'));
app.use('/', express.static('node_modules/pdfjs-dist/build'));
