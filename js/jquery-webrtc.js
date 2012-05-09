////////////////////////////
// Plugin jQuery - webRTC //
////////////////////////////


/**
 * Build the prototype
 * Verify that the function "create" doesn't exist
 */
if ( typeof Object.create !== 'function' ) {
	Object.create = function( obj ) {
		function F() {};
		F.prototype = obj;
		return new F();
	};
}

(function( $, window, document, undefined ) {

	var Webrtc = {

		/**
		 * The first function to be launched
		 * @param {string} options : plugin's options
		 * @param {object} elem
		 * @return {void}
		 */
		init: function( options, elem ) {

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

		/**
		 * Create the video tag
		 * @param {string} idVideo : id of the video tag
		 * @return {object} : video tag
		 */
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

		/**
		 * Allow to reset the status
		 * @return {void}
		 */
		resetStatus: function() {

			var self = this;

			// if you aren't the guest it provides you a link to invite someone in the status
			if (!self.guest) {
		        self.setStatus("Waiting for someone to join: <a href=\""+window.location.href+"?"+self.options.urlParameters+"="+self.room+"\">"+window.location.href+"?"+self.options.urlParameters+"="+self.room+"</a>");
			} else { 
        		self.setStatus("Initializing...");
        	}

		},

		/**
		 * Set the status
		 * @param {string} state : string to be placed in the status
		 */
		setStatus: function(state) {

			var self = this;

		    $(self.options.status).html(state);

		},

		/**
		 * Declare the socket (websocket) and open it
		 * Declare the event attached to the socket
		 * @return {void}
		 */
		openChannel: function() {

			var self = this;
			self.connection = new WebSocket(self.options.signallingServer);

			self.connection.onopen = function() {
				self.onChannelOpened();
			}

			self.connection.onerror = function (error) {
				console.log("WebSocket Error " + error);
			}

			self.connection.onmessage = function() {
				self.onChannelMessage();
			}

			self.connection.onclose = function() {
				self.onChannelClosed();
			}

			$(window).unload(function(){ self.connection.close(); self.connection = null });

		},

		/**
		 * Get the media (audio or video) of the user
		 * @return {void}
		 */
		getUserMedia: function() {

			var self = this;
			var mediaSuccess = function(stream) {
				self.onUserMediaSuccess(stream);
			};
			var mediaError = function(error) {
				self.onUserMediaError(error);
			};

			try {
		      navigator.webkitGetUserMedia({audio:self.options.mediaParametersAudio, video:self.options.mediaParametersVideo}, mediaSuccess, mediaError);
		      console.log("Requested access to local media with new syntax.");
		    } catch (e) {
		      try {

		      	var mediaParam = new Array();

		      	if(self.options.mediaParametersVideo) mediaParam.push("video");
		      	if(self.options.mediaParametersAudio) mediaParam.push("audio");

		      	mediaParam = mediaParam.join(",");

		        navigator.webkitGetUserMedia(mediaParam, mediaSuccess, mediaError);
		        console.log("Requested access to local media with old syntax.");
		      } catch (e) {
		        alert("webkitGetUserMedia() failed. Is the MediaStream flag enabled in about:flags?");
		        console.log("webkitGetUserMedia failed with exception: " + e.message);
		      }
		    }

		},

		/**
		 * Callback function for getUserMedia() on success getting the media
		 * Create an url for the current stream
		 * @param  {object} stream : contains the video and/or audio streams
		 * @return {void}
		 */
		onUserMediaSuccess: function(stream) {

			var self = this;
			var url = webkitURL.createObjectURL(stream);
		    
		    self.localVideo.css("opacity", "1");
		    self.localVideo.attr("src", url);
		    self.localStream = stream;

		    if (self.guest) self.maybeStart();  

		    console.log("User has granted access to local media.");

		},

		/**
		 * Callback function for getUserMedia() on fail getting the media
		 * @param  {string} error : informations about the error
		 * @return {void}
		 */
		onUserMediaError: function(error) {

		    console.log("Failed to get access to local media. Error code was " + error.code);
		    alert("Failed to get access to local media. Error code was " + error.code + "."); 

		},

		/**
		 * Verify all parameters, start the peer connection and add the stream to this peer connection
		 * @return {void}
		 */
		maybeStart: function() {

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

		/**
		 * Set parameter for creating a peer connection and add a callback function for messagin by peer connection
		 * @return {void}
		 */
		createPeerConnection: function() {

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

		/**
		 * Function called by the peerConnection method for the signaling process between clients
		 * @param  {string} message : generated by the peerConnection API to send SDP message
		 * @return {void}
		 */
		onSignalingMessage: function(message) {

			var self = this;

		    self.sendMessage("SDP", message);

		},

		/**
		 * Call when the user click on the "Hang Up" button
		 * Close the peerconnection and tells to the websocket server you're leaving
		 * @return {void}
		 */
		onHangup: function() {

			var self = this;

		    self.localVideo.css("opacity", "0");    
		    self.remoteVideo.css("opacity", "0"); 

		    self.pc.close();
		    self.pc = null;
		    self.connection.close();

		    self.setStatus("You have left the call."); 

		    console.log("Hanging up.");

		},

		/**
		 * Called when the channel with the server is opened
		 * If you're the guest the connection is establishing by calling maybeStart()
		 * @return {void}
		 */
		onChannelOpened: function() {

			var self = this; 

		    self.channelReady = true;
		    self.setGuest();

		    if (self.guest) self.maybeStart();

		    console.log("Channel opened.");

		},

		/**
		 * Determines if the user is a guest or not
		 * @return {void}
		 */
		setGuest: function() {

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

		/**
		 * Get the url parameters
		 * @return {array} : url parameters 
		 */
		getUrlVars: function() {

		    var vars = [], hash;
		    var hashes = window.location.href.slice(window.location.href.indexOf("?") + 1).split("&");

		    for(var i = 0; i < hashes.length; i++) {
		        hash = hashes[i].split("=");
		        vars.push(hash[0]);
		        vars[hash[0]] = hash[1];
		    }

		    return vars;

		},

		/**
		 * Send a message to the server
		 * @param {string} : message's type
		 * @param {string} : message to be send
		 * @return {void}
		 */
		sendMessage: function(type, mess) {

			var self = this;

			if(!mess) mess = "";
				var message = JSON.stringify({"type" : type, "value" : mess});
			
			self.connection.send(message);

		},

		/**
		 * Called when the client receive a message from the websocket server
		 * @return {void}
		 */
		onChannelMessage: function() {

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

		/**
		 * Called when the other client is leaving
		 * @return {void}
		 */
		onChannelBye: function() {

			var self = this;

		    self.remoteVideo.css("opacity", "0");
		    //self.remoteVideo.attr("src",null);
		    self.guest = 0;
		    self.started = false;

		    self.setStatus("Your partner have left the call.");

		    console.log("Session terminated."); 

		},

		/**
		 * log the error
		 * @return {void}
		 */
		onChannelError: function() { 

		    console.log("Channel error.");

		},

		/**
		 * log that the channel is closed
		 * @return {void}
		 */
		onChannelClosed: function() {    

		    console.log("Channel closed.");

		},

		/**
		 * Called when the peer connection is connecting 
		 * @return {void}
		 */
		onSessionConnecting: function() {  

		    console.log("Session connecting.");

		},

		/**
		 * Called when the session between clients is established
		 * @return {void}
		 */
		onSessionOpened: function() {    

		    console.log("Session opened.");

		},

		/**
		 * Get the remote stream and add it to the page with an url
		 * @return {void}
		 */
		onRemoteStreamAdded: function() {

			var self = this; 
		    var url = webkitURL.createObjectURL(event.stream);

		    self.remoteVideo.css("opacity", "1");
		    self.remoteVideo.attr("src",url);

		    self.setStatus("Is currently in video conference.<br><button id=\"hangup\">Hang Up</button>");

		    $('#hangup').on('click', self.onHangup);

		    console.log("Remote stream added.");

		},

		/**
		 * Called when the remote stream has been removed
		 * @param  {event} : event given by the browser
		 * @return {void}
		 */
		onRemoteStreamRemoved: function(event) {   

		    console.log("Remote stream removed.");

		}

	};

	/**
	 * Plugin's constructor
	 * @param {options} : Plugin's options
	 * @return {object}
	 */
	$.fn.createWebrtc = function( options ) {

		return this.each(function() {
			var webrtc = Object.create( Webrtc );
			webrtc.init( options, this );
			$.data( this, "webrtc", webrtc );
		});

	};

	/**
	 * Plugin's default options
	 */
	$.fn.createWebrtc.options = {

		local: "#local",
		remote: "#remote",
		status: "#status",
		signallingServer: "ws://localhost:8080",
		serverStunTurn: "NONE",
		urlParameters : "room",
		mediaParametersAudio: true,
		mediaParametersVideo: true

	};

})( jQuery, window, document );