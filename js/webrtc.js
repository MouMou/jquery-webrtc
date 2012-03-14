


/** 
	TODO :
	- settings :
				signalling server						-> default : http://
				STUN/TURN config						-> default : NONE
				url parameter 							-> default : room
				onChannelMessage & sendMessage function -> default : 
				local & remote 							-> default : #localVideo & #remoteVideo
				status bar 								-> default : #status

 */

(function($){
	$.webRtc = function(elem, options) {
		var  self = this;
		self.$elem = $(elem);
		self.elem = elem;

		self.init = function() {
			console.log("Initializing");
			self.options = $.extend( {}, $.fn.createWebrtc.options, options );

		    self.localVideo = self.$elem.find(self.options.localVideo);
		    self.remoteVideo = self.$elem.find(self.options.remoteVideo);
		    self.connection = null;
		    self.pc = null;
		    self.openChannel();
		    self.getUserMedia();
		};

		self.openChannel = function() {
			self.connection = new WebSocket(self.options.signallingServer);

			// When the connection is open, send some data to the server
			self.connection.onopen = self.onChannelOpened;

			// Log errors
			self.connection.onerror = function (error) {
			console.log('WebSocket Error ' + error);
			}
			// Log messages from the server
			self.connection.onmessage = self.onChannelMessage;

			self.connection.onclose = self.onChannelClosed;

			$(window).unload(function(){ self.connection.close(); self.connection = null });
		};

		self.getUserMedia = function() {
			try { 
				navigator.webkitGetUserMedia(self.options.mediaParameters, self.onUserMediaSuccess,self.onUserMediaError);
				console.log("Requested access to local media.");
			} catch (e) {
				console.log("getUserMedia error.");
			}
		};

		self.onUserMediaSuccess = function(stream) {

		    console.log("User has granted access to local media.");
		    var url = webkitURL.createObjectURL(stream);
		    self.localVideo.css("opacity", "1");
		    self.localVideo.attr("src", url);
		    self.localStream = stream;
		    if (self.guest) self.maybeStart();    
		};

		self.onUserMediaError = function(error) {
		    console.log("Failed to get access to local media. Error code was " + error.code);
		    alert("Failed to get access to local media. Error code was " + error.code + ".");    
		};

		self.maybeStart = function() {
		    if (!self.started && self.localStream && self.channelReady) {      
		        console.log("Creating PeerConnection.");
		        self.createPeerConnection();  
		        console.log("Adding local stream.");      
		        self.pc.addStream(self.localStream);
		        self.started = true;
		    }
		};

		self.createPeerConnection = function() {
		    self.pc = new webkitPeerConnection(self.options.serverStunTurn, self.onSignalingMessage);
		    self.pc.onconnecting = self.onSessionConnecting;
		    self.pc.onopen = self.onSessionOpened;
		    self.pc.onaddstream = self.onRemoteStreamAdded;
		    self.pc.onremovestream = self.onRemoteStreamRemoved;  
		};

		self.onSignalingMessage = function(message) {
		    //console.log("onSignalingMessage " + message);
		    self.sendMessage("SDP", message);
		};

		self.onHangup = function() {
		    console.log("Hanging up.");
		    self.localVideo.css("opacity", "0");    
		    self.remoteVideo.css("opacity", "0");    
		    self.pc.close();
		    self.pc = null;
		    self.connection.close();
		};

		self.onChannelOpened = function() { 
		    console.log('Channel opened.');
		    self.channelReady = true;
		    self.setGuest();
		    if (self.guest) self.maybeStart();
		};

		self.setGuest = function() {
			var urlParameters = getUrlVars();
			if(urlParameters[self.options.urlParameters]) {
		      self.room = urlParameters[self.options.urlParameters];
		      self.sendMessage("INVITE", self.room)
		      self.guest =1;
		    }
		    else{
		      self.sendMessage("GETROOM")
		      self.guest =0;
		    }
		}

		function getUrlVars()
		{
		    var vars = [], hash;
		    var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
		    for(var i = 0; i < hashes.length; i++)
		    {
		        hash = hashes[i].split('=');
		        vars.push(hash[0]);
		        vars[hash[0]] = hash[1];
		    }
		    return vars;
		}

		self.sendMessage = function(type, mess) {
			if(!mess) mess = "";
			var message = JSON.stringify({"type" : type, "value" : mess});
			self.connection.send(message);
		};

		self.onChannelMessage = function(message) {

		    self.message = JSON.parse(message.data);
		    console.log('S->C: ' + self.message["value"]);

		    switch(self.message["type"]) {
		      case "GETROOM" :
		        self.room = self.message["value"];
		        console.log(self.room);
		      break;
		      case "SDP" :
		        if (self.message["value"].indexOf("\"ERROR\"", 0) == -1) {
		          if (!self.guest && !self.started) self.maybeStart();
		          self.pc.processSignalingMessage(self.message["value"]);
		        }
		      break;
		    }
		};

		self.onChannelBye = function() {
		    console.log('Session terminated.');    
		    self.remoteVideo.css("opacity", "0");
		    //self.remoteVideo.attr("src",null);
		    self.guest = 0;
		    self.started = false;
		};

		self.onChannelError = function() {    
		    console.log('Channel error.');
		};

		self.onChannelClosed = function() {    
		    console.log('Channel closed.');
		};

		self.onSessionConnecting = function(message) {      
		    console.log("Session connecting.");
		};

		self.onSessionOpened = function(message) {      
		    console.log("Session opened.");
		};


		self.onRemoteStreamAdded = function(event) {   
		    console.log("Remote stream added.");
		    var url = webkitURL.createObjectURL(event.stream);
		    self.remoteVideo.css("opacity", "1");
		    self.remoteVideo.attr("src",url);
		};

		self.onRemoteStreamRemoved = function(event) {   
		    console.log("Remote stream removed.");
		};

		self.init();

		return self;
	};


	$.fn.createWebrtc = function( options ) {
		return this.each(function() {
			(new $.webRtc(this, options));
		});
	};

	$.fn.createWebrtc.options = {
		localVideo: '#localVideo',
		remoteVideo: '#remoteVideo',
		status: '#status',
		signallingServer: 'ws://localhost:8080',
		serverStunTurn: 'NONE',
		urlParameters : 'room',
		mediaParameters: 'audio,video'
	};
})(jQuery);