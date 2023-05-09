const fs = require('fs');
const { updateDataGTFS } = require('./update/gtfs-rt.js');

const testConfig = JSON.parse(fs.readFileSync('./configs/metra.json'));

updateDataGTFS(testConfig)
  .then((data) => {
    fs.writeFileSync('./test.json', JSON.stringify(data, null, 2));
  })