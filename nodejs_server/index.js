var WebSocketServer = require('websocket').server;
var http = require('http');

var server = http.createServer(function(request, response) {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});
server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

var connections = new Array();

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
  // put logic here to detect whether the specified origin is allowed.
  return true;
}

wsServer.on('request', function(request) {
    if (!originIsAllowed(request.origin)) {
      // Make sure we only accept requests from an allowed origin
      request.reject();
      console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
      return;
    }
    var guest = false;
	var room = '';
    var connection = request.accept(null, request.origin);

    console.log((new Date()) + ' Connection accepted.');

    connection.on('message', function(message) {
        message = JSON.parse(message.utf8Data);
        console.log(message);
        switch(message["type"]) {
            case "INVITE" :
                guest = true;
                room = message["value"];
                connections[room].push(connection);

            break;
            case "GETROOM" :
                room = Math.floor(Math.random()*1000001).toString();
                message = JSON.stringify({'type' : 'GETROOM', 'value': room});
                connection.send(message);
                connections.push(room);
                connections[room] = new Array();
                connections[room].push(connection);
            break;
            case "SDP" :
                connections[room].forEach(function(destination) {
                    if(destination != connection) {
                        message = JSON.stringify({'type' : 'SDP', 'value': message["value"]});
                        destination.send(message);
                    }
                });
            break;
            case "SLIDE" :
                connections[room].forEach(function(destination) {
                    if(destination != connection) {
                        message = JSON.stringify({'type' : 'SLIDE', 'value': message["value"]});
                        destination.send(message);
                    }
                });
            break;
            case "NEWMESSAGE" :
                messages[room].push(message["value"]);
                connections[room].forEach(function(destination) {
                    if(destination != connection) {
                        message = JSON.stringify({'type' : 'NEWMESSAGE', 'value': JSON.stringify(message["value"])});
                        destination.send(message);
                    }
                });
            break;
        }
    });

    connection.on('close', function(reasonCode, description) {
        console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
    });
})