// webapp dependencies
var express = require('express'),
    contentAnalysisApp = express(),
    http = require('http').Server(contentAnalysisApp),
    httpPort = process.env.PORT || 3034,
    io = require('socket.io')(http);

// serves the static files
contentAnalysisApp.use(express.static('www'));
contentAnalysisApp.use(express.static('node_modules/socket-io-ng-service/libs'));
contentAnalysisApp.use(express.static('node_modules/ui-router-menu-service/libs'));
contentAnalysisApp.use(express.static('node_modules/angular'));
contentAnalysisApp.use(express.static('node_modules/angular-ui-router/release'));

// starts the web aplication server on the configured HTTP port
http.listen(httpPort, function() {
    console.log('listening on *:' + httpPort + '\nctrl+c to stop the app');
});

// shuts the application down on low-level errors
function shutdown() {
    console.log('web-content-analysis is shutting down...');
    process.exit(1);
};
process.on('SIGINT', shutdown).on('SIGTERM', shutdown);

// handles a websocket connection
io.sockets.on('connection', require('./api/socket')(require('./scrapping/scrapping')));
