//
//
// Peter Elespuru
//
// Initially intended to serve some webm files for online viewing/usage without a Kinect, but
// haven't gotten around to that yet... hooks are in here though...
// 

var sys = require('util');
var fs = require('fs');
var util = require('util');
var express = require('express');
var websocketserver = require('websocket').server;
var websocketclient = require('websocket').client;
var http = require('http');

var port = process.argv[2];
var file = process.argv[3];
var sendingAddress = process.argv[4];
var port2 = process.argv[5]
var app = express.createServer();

//
// make sure passed args are sufficient to kick it off
//
if (process.argv.length != 6) {
	console.log('ERROR  : missing command line arguments:' + ' http_port webm_file data_socket data_port');
	console.log('EXAMPLE: node content_server.js 9001 /home/foo/file.webm ws://127.0.0.1:9000 9898');
	process.exit();
}

//
// Fire up the bridge to the data server so that node can 
// serve up everything from a single point. This isn't working just yet...
// for now the two WS servers have to run separately, which works, come back to
// this later after shaders are done and working, they're more important...
//

// client prerequisites
var wsClient = new websocketclient();

wsClient.on('connectFailed', function(error) {
    console.log('Connect Error: ' + error.toString());
});

wsClient.on('connect', function(connection) {
	
    connection.on('error', function(error) {
        console.log("Connection Error: " + error.toString());
    });
	
    connection.on('close', function() {
        console.log('Connection Closed');
    });
	
    connection.on('message', function(message) {
		console.log('forwarding');
    });
});

// server prerequisites
var wsHttpServer = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

wsHttpServer.listen(port2, function() {
	console.log('web socket underlying server is listening on port ' + port2);
});

// socket server
var wsServer = new websocketserver({
	httpServer: wsHttpServer,
	keepalive: true,
	autoAcceptConnections: false
});

//
// white/black list connections
//
function originIsAllowed(origin) {
	// blanket whitelist for now
	return true;
}

console.log("WebSocket handler going up...");

wsServer.on('request', function(request) {
	
	var connection;

	// limit active connections
	if (wsServer.connections.length > 100) {
		console.log("too many connections, rejected new connection attempt");
		request.reject();
		return;
	}

    if (!originIsAllowed(request.origin)) {
        console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
        request.reject();
        return;
    }
  
	connection = request.accept(null, request.origin);
	console.log("connected:    " + connection.remoteAddress + "\x07");
  
	connection.on('message', function(message) {
		console.log('moo');
	});
  
	return connection.on('close', function(reasonCode, description) {
		return console.log("disconnected: " + connection.remoteAddress);
	});
  
});

//
// add a handler for video requests so they can be streamed
//
console.log("Video stream handler going up...");
app.get('/video/', function(req, res) {
	
	//console.log(util.inspect(req.headers, showHidden=false, depth=0));
	var stat = fs.statSync(file);
	if (!stat.isFile()) { return; }

	var start = 0;
	var end = 0;
	var range = req.header('Range');
  
	if (range != null) {
		start = parseInt(range.slice(range.indexOf('bytes=')+6, range.indexOf('-')));
		end = parseInt(range.slice(range.indexOf('-')+1, range.length));
	}
  
	if (isNaN(end) || end == 0) { end = stat.size-1; }
	if (start > end) { return; }

	//console.log('Browser requested bytes from ' + start + ' to ' + end + ' of file ' + file);
	//var date = new Date();
	res.writeHead(206, { 
		// NOTE: a partial http response
		// 'Date':date.toUTCString(),
		'Connection':'close',
		'Cache-Control':'private',
		'Content-Type':'video/webm',
		'Content-Length':end - start,
		'Content-Range':'bytes '+start+'-'+end+'/'+stat.size,
		// 'Accept-Ranges':'bytes',
		// 'Server':'CustomStreamer/0.0.1',
		'Transfer-Encoding':'chunked'
	});

	var stream = fs.createReadStream(file, { flags: 'r', start: start, end: end});
	stream.pipe(res);
  
});

//
// add a handler for everything else (non-streaming-video, other static web content)
//
//app.use(express.static(__dirname));
console.log("HTTP handler going up...");
app.use(express.static('client'));

//
// listen on the specified port
//	
app.listen(port);
console.log("Content server up and listening on: " + port);

//
// spit out any exceptions
//
process.on('uncaughtException', function(err) {
	console.log(err);
});
