const fetch = require("node-fetch");
const GtfsRealtimeBindings = require("gtfs-realtime-bindings");

const regexes = {
  'nyct_subway': /[0-9]{6}_[0-9A-Z]..[NS]/g,
}

//.env
require("dotenv").config();

const processHeaders = (headers) => {
  const processedHeaders = {};

  Object.keys(headers).forEach((header) => {
    if (headers[header].startsWith('env.')) {
      const envVar = headers[header].split('env.')[1];
      processedHeaders[header] = process.env[envVar];
    } else {
      processedHeaders[header] = headers[header];
    }
  });

  return processedHeaders;
};

const updateData = async (config) => {
  let vehicles = {};
  let stations = {};
  let parentStations = {};

  //collect all data from endpoints into one array
  console.log(`Fetching data from ${config.name} endpoints`)
  const trackingData = await Promise.all(
    config.endpoints.map(async (endpoint) => {
      console.log(`Fetching data from ${endpoint}`)
      const response = await fetch(endpoint, {
        headers: processHeaders(config.headers),
      });
      const buf = await response.arrayBuffer();
      const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(
        new Uint8Array(buf)
      );
      return feed;
    })
  );

  console.log(`Fetching data for ${config.name} from Piemadd GTFS endpoints`)
  const gtfsRoutesReq = await fetch(`https://gtfs.piemadd.com/data/${config.scheduleName}/routes.json`);
  const gtfsRoutes = await gtfsRoutesReq.json();

  const gtfsStopsReq = await fetch(`https://gtfs.piemadd.com/data/${config.scheduleName}/stops.json`);
  const gtfsStops = await gtfsStopsReq.json();

  console.log(`Flattening and filtering ${config.name} data`)
  const flattenedTrackingData = trackingData.map((feed) => feed.entity).flat();
  const filteredTrackingData = flattenedTrackingData.filter((entity) => entity.tripUpdate);

  console.log('Filling in station data');
  Object.values(gtfsStops).forEach((station) => {
    stations[station.stopID] = {
      stationID: station.stopID,
      name: station.stopName,
      latitude: station.stopLat,
      longitude: station.stopLon,
      parent: station.parentStation ? station.parentStation.replace('place_', '') : station.stopID.replace('place_', ''),
      upcomingTrains: [],
    };
  })

  console.log('Updating tracking data for', config.name);
  filteredTrackingData.forEach((entity, i) => {
    let routeID = '';

    Object.values(gtfsRoutes).forEach((route) => {
      //math regex from config.tripIDMath
      route.routeTrips.forEach((trip) => {
        const actualTripID = trip.match(regexes[config.scheduleName] ?? /[\s\S]*/g);
        if (actualTripID && actualTripID[0] && actualTripID[0] === entity.tripUpdate.trip.tripId) {
          routeID = route.routeID;
          return;
        }
      })
    });

    if (routeID === '') return;

    vehicles[entity.tripUpdate.trip.tripId] = {
      routeID: routeID,
      tripID: entity.tripUpdate.trip.tripId,
      routeShortName: gtfsRoutes[routeID].routeShortName ? gtfsRoutes[routeID].routeShortName.split('-')[0] : gtfsRoutes[routeID].routeLongName,
      routeLongName: gtfsRoutes[routeID].routeLongName,
      routeColor: gtfsRoutes[routeID].routeColor,
      routeTextColor: gtfsRoutes[routeID].routeTextColor,
      stops: entity.tripUpdate.stopTimeUpdate.map((stop) => {

        if (!stop.departure) stop.departure = stop.arrival;
        if (!stop.arrival) stop.arrival = stop.departure;

        return {
          stopID: stop.stopId,
          stopSequence: stop.stopSequence ?? null,
          arr: stop.arrival ? stop.arrival.time : null,
          dep: stop.departure ? stop.departure.time : null,
          delay: stop.departure ? stop.departure.delay : null,
        }
      }),
      finalStop : entity.tripUpdate.stopTimeUpdate[entity.tripUpdate.stopTimeUpdate.length - 1],
    }

    //console.log(vehicles[entity.tripUpdate.trip.tripId].stops[0].untilArrival)

    vehicles[entity.tripUpdate.trip.tripId].stops.forEach((stop) => {
      if (stations[stop.stopID]) {
        stations[stop.stopID].upcomingTrains.push({
          routeID: vehicles[entity.tripUpdate.trip.tripId].routeID,
          tripID: vehicles[entity.tripUpdate.trip.tripId].tripID,
          routeShortName: vehicles[entity.tripUpdate.trip.tripId].routeShortName,
          routeLongName: vehicles[entity.tripUpdate.trip.tripId].routeLongName,
          routeColor: vehicles[entity.tripUpdate.trip.tripId].routeColor,
          routeTextColor: vehicles[entity.tripUpdate.trip.tripId].routeTextColor,
          arr: stop.arr,
          dep: stop.dep,
          delay: stop.delay,
        });
      } else {
        console.log('no stop for:', stop.stopID)
      }
    })
  });

  console.log('Moving data to parent stations')
  Object.values(stations).forEach((station) => {
    if (!parentStations[station.parent]) {
      parentStations[station.parent] = {
        stationID: station.parent,
        name: station.name,
        latitude: station.latitude,
        longitude: station.longitude,
        upcomingTrains: [],
      }
    }

    parentStations[station.parent].upcomingTrains = parentStations[station.parent].upcomingTrains.concat(station.upcomingTrains);
  })

  return {
    vehicles: vehicles,
    stations: parentStations
  }
};

exports.updateDataGTFS = updateData;