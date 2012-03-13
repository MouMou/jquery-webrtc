// Utility
if ( typeof Object.create !== 'function' ) {
	Object.create = function( obj ) {
		function F() {};
		F.prototype = obj;
		return new F();
	};
}

(function( $, window, document, undefined ) {
	var Webrtc = {
		init: function( options, elem ) {
			var self = this;

			self.elem = elem;
			self.$elem = $( elem );

			/*self.search = ( typeof options === 'string' )
				? options
				: options.search;*/

			self.options = $.extend( {}, $.fn.createWebtc.options, options );

			console.log("Initializing");

		    self.localVideo = $("#localVideo");
		    self.remoteVideo = $("#remoteVideo");
		    
		    self.openChannel();
		    selfgetUserMedia();
		},

		openChannel: function() {
			var self = this;

			self.connection = new WebSocket('ws://localhost:8080/');

			// When the connection is open, send some data to the server
			connection.onopen = self.onChannelOpened;

			// Log errors
			connection.onerror = function (error) {
			console.log('WebSocket Error ' + error);
			}
			// Log messages from the server
			connection.onmessage = self.onChannelMessage;

			connection.onclose = self.onChannelClosed;
		},

		getUserMedia: function() {
			var self = this;
			try { 
				navigator.webkitGetUserMedia("video,audio", self.onUserMediaSuccess, self.onUserMediaError);
				console.log("Requested access to local media.");
			} catch (e) {
				console.log("getUserMedia error.");
			}
		},

		onUserMediaSuccess: function(stream) {
			var self = this;

		    console.log("User has granted access to local media.");
		    var url = webkitURL.createObjectURL(stream);
		    self.localVideo.css("opacity", "1");
		    self.localVideo.attr("src", url);
		    self.localStream = stream;
		    if (self.guest) self.maybeStart();    
		},

		onUserMediaError: function(error) {
		    console.log("Failed to get access to local media. Error code was " + error.code);
		    alert("Failed to get access to local media. Error code was " + error.code + ".");    
		},

		maybeStart: function() {
			var self = this;

		    if (!self.started && self.localStream && self.channelReady) {      
		        console.log("Creating PeerConnection.");
		        createPeerConnection();  
		        console.log("Adding local stream.");      
		        self.pc.addStream(localStream);
		        self.started = true;
		    }
		},

		createPeerConnection: function() {
			var self = this;

		    self.pc = new webkitPeerConnection("NONE", self.onSignalingMessage);
		    self.pc.onconnecting = self.onSessionConnecting;
		    self.pc.onopen = self.onSessionOpened;
		    self.pc.onaddstream = self.onRemoteStreamAdded;
		    self.pc.onremovestream = self.onRemoteStreamRemoved;  
		},

		onSignalingMessage: function(message) {
		    console.log("onSignalingMessage " + message);
		    this.message = JSON.stringify({"type" : "SDP", "value" : message})
		    this.connection.send(this.message);
		},

		onHangup: function() {
		    var self = this;

		    console.log("Hanging up.");
		    self.localVideo.css("opacity", "0");    
		    self.remoteVideo.css("opacity", "0");    
		    self.pc.close();
		    self.pc = null;
		    self.connection.close();
		},

		onChannelOpened: function() {    
		    var self = this;

		    console.log('Channel opened.');
		    self.channelReady = true;
		    if(location.search.substring(1,5) == "room") {
		      self.room = location.search.substring(6);
		      self.message = JSON.stringify({"type" : "INVITE", "value" : room});
		      console.log(self.message);
		      connection.send(self.message);
		      self.guest =1;
		    }
		    else{
		      self.message = JSON.stringify({"type" : "GETROOM", "value" : ""});
		      self.console.log(self.message);
		      self.connection.send(self.message);
		      self.guest =0;
		    }
		    if (self.guest) self.maybeStart();
		},

		onChannelMessage = function(message) {
		    var self = this;

		    self.message = JSON.parse(message.data);
		    console.log('S->C: ' + self.message["value"]);

		    switch(self.message["type"]) {
		      case "GETROOM" :
		        self.room = self.message["value"];
		        console.log(self.room);
		        self.guest = 0;
		      break;
		      case "SDP" :
		        if (self.message["value"].indexOf("\"ERROR\"", 0) == -1) {
		          if (!self.guest && !self.started) self.maybeStart();
		          self.pc.processSignalingMessage(self.message["value"]);
		        }
		      break;
		    }
		},

		onChannelBye: function() {
			var self = this;

		    console.log('Session terminated.');    
		    self.remoteVideo.css("opacity", "0");
		    //self.remoteVideo.attr("src",null);
		    self.guest = 0;
		    self.started = false;
		},

		onChannelError: function() {    
		    console.log('Channel error.');
		},

		onChannelClosed: function() {    
		    console.log('Channel closed.');
		},

		onSessionConnecting: function(message) {      
		    console.log("Session connecting.");
		},

		onSessionOpened: function(message) {      
		    console.log("Session opened.");
		},


		onRemoteStreamAdded: function(event) {   
		    console.log("Remote stream added.");
		    var url = webkitURL.createObjectURL(event.stream);
		    this.remoteVideo.css("opacity", "1");
		    this.remoteVideo.attr("src",url);
		},

		onRemoteStreamRemoved: function(event) {   
		    console.log("Remote stream removed.");
		}
	};

	$.fn.createWebrtc = function( options ) {
		return this.each(function() {
			var webrtc = Object.create( Webrtc );
			
			webrtc.init( options, this );
		});
	};

	/*$.fn.createWebrtc.options = {
		search: '@tutspremium',
		wrapEachWith: '<li></li>',
		limit: 10,
		refresh: null,
		onComplete: null,
		transition: 'fadeToggle'
	};*/

})( jQuery, window, document );
