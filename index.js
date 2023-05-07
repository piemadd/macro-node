const HyperExpress = require('hyper-express');
const webserver = new HyperExpress.Server();

webserver.get('/', (request, response) => {
  response.send('Hello World');
})

webserver.listen(3000)
  .then((socket) => console.log('Webserver started on port 3000'))
  .catch((error) => console.log('Failed to start webserver on port 3000'));