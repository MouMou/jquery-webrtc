////////////////////////////
// Plugin jQuery - webRTC //
////////////////////////////

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

			// Variables Declaration //
			var self = this;
			self.elem = elem;
			self.$elem = $( elem );

			// Plugin's options //
			self.options = $.extend( {}, $.fn.createWebrtc.options, options );

			self.localVideo = self.video("localVideo");
			self.remoteVideo = self.video("remoteVideo");
			self.$elem.find(self.options.local).append(self.localVideo);
			self.$elem.find(self.options.remote).append(self.remoteVideo);

		    self.connection = null;
		    self.pc = null;
		    self.openChannel();
		    self.getUserMedia();

		    console.log("Initializing");

		},

		video: function(idVideo) {

			return $('<video></video>')
						
				.attr({	
					width: "100%",
					height: "100%",
					id: idVideo,
					autoplay: "autoplay"
				})
				
				.css({
					opacity: "0",
					"-webkit-transition-property": "opacity", 
					"-webkit-transition-duration": "2s"
				});

		},

		resetStatus: function() {

			// Variables Declaration //
			var self = this;

			if (!self.guest) {
		        self.setStatus("Waiting for someone to join: <a href=\""+window.location.href+"?"+self.options.urlParameters+"="+self.room+"\">"+window.location.href+"?"+self.options.urlParameters+"="+self.room+"</a>");
			} else { 
        		self.setStatus("Initializing...");
        	}

		},

		setStatus: function(state) {

			// Variables Declaration //
			var self = this;

		    $(self.options.status).html(state);

		},

		openChannel: function() {

			// Variables Declaration //
			var self = this;
			self.connection = new WebSocket(self.options.signallingServer);

			self.connection.onopen = function() {
				self.onChannelOpened();
			}

			self.connection.onerror = function (error) {
				console.log('WebSocket Error ' + error);
			}

			self.connection.onmessage = function() {
				self.onChannelMessage();
			}

			self.connection.onclose = function() {
				self.onChannelClosed();
			}

			$(window).unload(function(){ self.connection.close(); self.connection = null });

		},

		getUserMedia: function() {

			// Variables Declaration //
			var self = this;
			var mediaSuccess = function(stream) {
				self.onUserMediaSuccess(stream);
			};
			var mediaError = function(error) {
				self.onUserMediaError(error);
			};

			try { 
				navigator.webkitGetUserMedia(self.options.mediaParameters,mediaSuccess,mediaError);
				console.log("Requested access to local media.");
			} catch (e) {
				console.log("getUserMedia error.");
			}

		},

		onUserMediaSuccess: function(stream) {

			// Variables Declaration //
			var self = this;
			var url = webkitURL.createObjectURL(stream);
		    
		    self.localVideo.css("opacity", "1");
		    self.localVideo.attr("src", url);
		    self.localStream = stream;

		    if (self.guest) self.maybeStart();  

		    console.log("User has granted access to local media.");

		},

		onUserMediaError: function(error) {

		    console.log("Failed to get access to local media. Error code was " + error.code);
		    alert("Failed to get access to local media. Error code was " + error.code + "."); 

		},

		maybeStart: function() {

			// Variables Declaration //
			var self = this;

		    if (!self.started && self.localStream && self.channelReady) {  
		    	self.setStatus("Connecting...");    
		        
		        self.createPeerConnection();  
		        console.log("Creating PeerConnection.");

		            
		        self.pc.addStream(self.localStream);
		        console.log("Adding local stream.");  

		        self.started = true;
		    }

		},

		createPeerConnection: function() {

			// Variables Declaration //
			var self = this;
			var signalMessage = function(message) {
				self.onSignalingMessage(message);
			};

			if(typeof webkitPeerConnection === 'function')
		    	self.pc = new webkitPeerConnection(self.options.serverStunTurn, signalMessage);
		    else
		    	self.pc = new webkitDeprecatedPeerConnection(self.options.serverStunTurn, signalMessage);

		    self.pc.onconnecting = function() {
		    	self.onSessionConnecting();
		    };

		    self.pc.onopen = function() {
		    	self.onSessionOpened();
		    };

		    self.pc.onaddstream = function() {
		    	self.onRemoteStreamAdded();
		    };

		    self.pc.onremovestream = function() {
		    	self.onRemoteStreamRemoved;  
		    };

		},

		onSignalingMessage: function(message) {

			// Variables Declaration //
			var self = this;

		    self.sendMessage("SDP", message);

		},

		onHangup: function() {

			// Variables Declaration //
			var self = this;

		    self.localVideo.css("opacity", "0");    
		    self.remoteVideo.css("opacity", "0"); 

		    self.pc.close();
		    self.pc = null;
		    self.connection.close();

		    self.setStatus("You have left the call."); 

		    console.log("Hanging up.");

		},

		onChannelOpened: function() {

			// Variables Declaration //
			var self = this; 

		    self.channelReady = true;
		    self.setGuest();
		    if (self.guest) self.maybeStart();

		    console.log('Channel opened.');

		},

		setGuest: function() {

			// Variables Declaration //
			var self = this;
			var urlParameters = self.getUrlVars();

			if(urlParameters[self.options.urlParameters]) {
			    self.room = urlParameters[self.options.urlParameters];
			    self.sendMessage("INVITE", self.room)
			    self.guest =1;
		    } else {
			    self.sendMessage("GETROOM")
			    self.guest =0;
		    }

		},

		getUrlVars: function() {

			// Variables Declaration //
		    var vars = [], hash;
		    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');

		    for(var i = 0; i < hashes.length; i++) {
		        hash = hashes[i].split('=');
		        vars.push(hash[0]);
		        vars[hash[0]] = hash[1];
		    }

		    return vars;

		},

		sendMessage: function(type, mess) {

			// Variables Declaration //
			var self = this;

			if(!mess) mess = "";
			var message = JSON.stringify({"type" : type, "value" : mess});
			self.connection.send(message);

		},

		onChannelMessage: function() {

			// Variables Declaration //
			var self = this;

		    self.message = JSON.parse(event.data);

		    switch(self.message["type"]) {
			    
			    case "GETROOM" :
			        self.room = self.message["value"];
			        self.resetStatus();
			     	break;

			    case "SDP" :
			        if (self.message["value"].indexOf("\"ERROR\"", 0) == -1) {
				        if (!self.guest && !self.started) self.maybeStart();
				            self.pc.processSignalingMessage(self.message["value"]);
			        }
			        break;

			    case "BYE" :
			        self.onChannelBye();
			        break;
		    }

		},

		onChannelBye: function() {

			// Variables Declaration //
			var self = this;

		    self.remoteVideo.css("opacity", "0");
		    //self.remoteVideo.attr("src",null);
		    self.guest = 0;
		    self.started = false;

		    self.setStatus("Your partner have left the call.");

		    console.log('Session terminated.'); 

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

		onRemoteStreamAdded: function() {

			// Variables Declaration //
			var self = this; 
		    var url = webkitURL.createObjectURL(event.stream);

		    self.remoteVideo.css("opacity", "1");
		    self.remoteVideo.attr("src",url);

		    self.setStatus("Is currently in video conference.<br><button id=\"hangup\">Hang Up</button>");

		    $('#hangup').on('click', self.onHangup);

		    console.log("Remote stream added.");

		},

		onRemoteStreamRemoved: function(event) {   

		    console.log("Remote stream removed.");

		}

	};

	$.fn.createWebrtc = function( options ) {

		return this.each(function() {
			var webrtc = Object.create( Webrtc );
			webrtc.init( options, this );
			$.data( this, 'webrtc', webrtc );
		});

	};

	$.fn.createWebrtc.options = {

		local: '#local',
		remote: '#remote',
		status: '#status',
		signallingServer: 'ws://localhost:8080',
		serverStunTurn: 'NONE',
		urlParameters : 'room',
		mediaParameters: 'audio,video'

	};

})( jQuery, window, document );