const HyperExpress = require('hyper-express');
const webserver = new HyperExpress.Server();
const fs = require('fs');
const { updateDataGTFS } = require('./update/gtfs-rt.js');

// HIGH PERFORMANCE IN MEMORY DATABASE
let dataStore = {};

const configFiles = fs.readdirSync('./configs');

configFiles.forEach((configFile) => {
  const config = JSON.parse(fs.readFileSync(`./configs/${configFile}`));

  updateDataGTFS(config)
    .then((data) => {
      dataStore[config.scheduleName] = {
        full: data,
        stations: data.stations,
        vehicles: data.vehicles,
        keys: {
          stations: Object.keys(data.stations),
          vehicles: Object.keys(data.vehicles),
        }
      }
    })

  setInterval(() => {
    updateDataGTFS(config)
      .then((data) => {
        dataStore[config.scheduleName] = {
          full: data,
          stations: data.stations,
          vehicles: data.vehicles,
          keys: {
            stations: Object.keys(data.stations),
            vehicles: Object.keys(data.vehicles),
          }
        }
      })
  }, config.frequency);
});

webserver.get('/', (request, response) => {
  response.json(dataStore);
})

webserver.get('/:agency', (request, response) => {
  const agency = request.params.agency;

  if (dataStore[agency]) {
    response.json(dataStore[agency].full);
  } else {
    response.send('Agency not found');
  }
})

webserver.get('/:agency/stations', (request, response) => {
  const agency = request.params.agency;

  if (dataStore[agency]) {
    response.json(dataStore[agency].stations);
  } else {
    response.send('Agency not found');
  }
})

webserver.get('/:agency/vehicles', (request, response) => {
  const agency = request.params.agency;

  if (dataStore[agency]) {
    response.json(dataStore[agency].vehicles);
  } else {
    response.send('Agency not found');
  }
})

webserver.get('/:agency/vehicles/:vehicle', (request, response) => {
  const agency = request.params.agency;
  const vehicle = request.params.vehicle;

  if (dataStore[agency]) {
    if (dataStore[agency].keys.vehicles.includes(vehicle)) {
      response.json(dataStore[agency].vehicles[vehicle]);
    } else {
      response.send('Vehicle not found');
    }
  } else {
    response.send('Agency not found');
  }
})

webserver.get('/:agency/stations/:station', (request, response) => {
  const agency = request.params.agency;
  const station = request.params.station;

  if (dataStore[agency]) {
    if (dataStore[agency].keys.stations.includes(station)) {
      response.json(dataStore[agency].stations[station]);
    } else {
      response.send('Station not found');
    }
  } else {
    response.send('Agency not found');
  }
})

webserver.get('/:agency/keys', (request, response) => {
  const agency = request.params.agency;

  if (dataStore[agency]) {
    response.json(dataStore[agency].keys);
  } else {
    response.send('Agency not found');
  }
})


webserver.listen(3000)
  .then((socket) => console.log('Webserver started on port 3000'))
  .catch((error) => console.log('Failed to start webserver on port 3000'));