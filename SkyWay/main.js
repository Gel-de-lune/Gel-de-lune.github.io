var API_KEY = '5c4a8074-a5dc-4579-9d4f-6d405f281302';

var peer;
var inputs = [];
var outputs = [];
var users = [];
var mediaStream;
var selected_input;
var selected_conn;
var selected_output;
var audioctx;



window.onload = function() {
  editUserName();
  
  if (navigator.requestMIDIAccess) {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  }

  initUserMedia();

  peer = new Peer({key: API_KEY, debug: 1});
  setPeerCallbacks(peer);
  
};

function editUserName() {
  var username = localStorage.getItem("username");
  var defaultname;
  if (username === null) {
    var date = new Date();
    defaultname = "Liz" + date.getTime();
  } else {
    defaultname = username;
  }
  username = prompt("Please enter your name", defaultname);
  if(username === null) username = "ANONIMOUS";
  else localStorage.setItem("username", username);
  var span = document.getElementById("user-name");
  span.innerHTML = username;
}

/* MIDI functions */

function onMIDISuccess(midiAccess) {
  console.log("onMIDISuccess");
  midiAccess.onstatechange = onStateChange;
  createUserMIDIInputs(midiAccess);
  createUserMIDIOutputs(midiAccess);
}

function onMIDIFailure(msg) {
  console.log("onMIDIFailure");
  console.log("Error: " + msg );
}

function onStateChange(event) {
  console.log("onStateChange");
  
  createUserMIDIInputs(event.target);
  createUserMIDIOutputs(event.target);
  // Notify changing user device.
  // for (var key in conns) {
  //   var conn = conns[key];
  //   sendMetadata(conn);
  // }
}

function createUserMIDIInputs(midiAccess) {
  var select = document.getElementById("user-devices");
  while (select.options.length !== 0) {
    select.remove(0);
  }
  for (var value of midiAccess.inputs.values()) {
    if (value.state === "connected") {
      var option = document.createElement("option");
      option.innerHTML = value.name;
      option.value = value.id;
      inputs[value.id] = value;
      select.appendChild(option);
    }
  }
  select.onchange = function() {onChangeDevice(select); };
}

function createUserMIDIOutputs(midiAccess) {
  while (outputs.pop()) {}
  for (var value of midiAccess.outputs.values()) {
    if (value.state === "connected") {
      outputs[value.name] = value;
    }
  }  
}

function onChangeDevice(select) {
  console.log("onChangeDevice");
  if (select.options.length !== 0) {
    var option = select.options[select.selectedIndex];
    var input = inputs[option.value];
    if (input.onmidimessage === null) {
      input.onmidimessage = onMIDImessage;
    }
  }
}

function onMIDImessage(event) {
  console.log("onMIDImessage");
  selected_conn.send(event.data);
}

/* UserMedia function */
function initUserMedia() {
  if (util.browser === 'Chrome') {
  navigator.webkitGetUserMedia(
    {'audio':
      {'mandatory':
        {
          'googEchoCancellation':'false',
          'googAutoGainControl':'false',
          'googNoiseSuppression':'false',
          'googHighpassFilter':'false'
        }
      }
    },
    onGetUserMediaSuccess,
    onGetUserMediaFailure
  );
  }
  
  if (window.AudioContext) {
    audioctx = new AudioContext();
  } else if (window.webkitAudioContext) {
    audioctx = new webkitAudioContext();
  } else if (window.mozAudioContext) {
  } else if (window.oAudioContext) {
  } else if (window.msAudioContext) {
  }
}

function onGetUserMediaSuccess(stream) {
  console.log("onGetUserMediaSuccess");
  mediaStream = stream;
}

function onGetUserMediaFailure(error) {
  console.log("onGetUserMediaFailure");
  console.log(error.name + ":" + error.message);
}

/* RTC functions */
function onListAllPeers(list) {
  for (var key in list) {
    var id = list[key];
    if (peer.id !== id) {
      var conn = peer.connect(id);
      setConnCallbacks(conn);
    }
  }
}

function setPeerCallbacks(peer) {
  peer.on(
    'open',
    function(id) {
      console.log("Peer on open.");
      peer.listAllPeers(onListAllPeers);
    }
  );
  
  peer.on(
    'connection',
    function(conn) {
      console.log('Peer on connection.');
      setConnCallbacks(conn);
    }
  );
  
  peer.on(
    'call',
    function(call) {
      console.log('Peer on call.');
      if (mediaStream !== undefined) {
        call.answer(mediaStream);
      } else {
        call.answer();
      }
      setCallCallbacks(call);
    }
  );
  
  peer.on(
    'close',
    function() {
      console.log('Peer on close.');
    }
  );
  
  peer.on(
    'error',
    function(error) {
      console.log('Peer on error.');
      console.log(error.message);
      // 'browser-incompatible'
      // 'invalid-id'
      // 'invalid-key'
      // 'unavailable-id'
      // 'ssl-unavailable'
      // 'server-disconnected'
      // 'server-error'
      // 'socket-error'
      // 'socket-closed'
    }
  );
}

function sendMetadata(conn) {
  var username = localStorage.getItem("username");
  if (username === null) username = "ANONIMOUS";
  
  var data =
  { "metadata" : 
    {
      'id' : conn.peer.id,
      'username' : username,
      'outputs' : Object.keys(outputs)
    }
  };
  
  conn.send(data);
}

function setConnCallbacks(conn) {
  conn.on(
    'open',
    function() {
      console.log('Conn on open.');
      sendMetadata(conn);
    }
  );
  
  conn.on(
    'data',
    function (data) {
      console.log('Conn on data.');
      if (typeof data === "string") {
        if (data === "open loopback") {
          var call = peer.call(conn.peer, mediaStream);
          setCallCallbacks(call);
        }
      }
      else if (typeof data === "object") {
        if (data.metadata !== undefined) {
          data.metadata.conn = conn;
          users.push(data.metadata);
          createUserList();
        } else if (data.target !== undefined) {
          selected_output = data.target;
        } else {
          var midi = new Uint8Array(data);
          outputs[selected_output].send(midi);
        }
      }
    }
  );
  
  conn.on(
    'error',
    function(error) {
      console.log('Conn on error.');
      console.log(error.message);
    }
  );
  
  conn.on(
    'close',
    function() {
      console.log('Conn on close.');
    }
  );
}

function setCallCallbacks(call) {
  call.on(
    'stream',
    function(stream) {
      console.log('Call on stream.');
      // var source = audioctx.createMediaStreamSource(stream);
      // source.connect(audioctx.destination);
      // source.start(0);
      // var audioTracks = stream.getAudioTracks();
      // window.stream = stream;
      var audio = document.getElementById("audio");
      // audio.srcObject = stream;
      audio.src = window.URL.createObjectURL(stream);
      audio.play();
    }
  );
  call.on(
    'error',
    function(error) {
      console.log('Call on error.');
    }
  );
  call.on(
    'close',
    function() {
      console.log('Call on close.');
    }
  );
}

function createUserList() {
  var select = document.getElementById("connected-users");
  while (select.options.length !== 0) {
    select.remove(0);
  }
  for (var key in users) {
    var option = document.createElement("option");
    option.innerHTML = users[key].username;
    option.value = key;
    select.appendChild(option);
  }
  select.onchange = function() { onChangeConnectedUsers(select); };
  onChangeConnectedUsers(select);
}

/* User Action */

function onChangeConnectedUsers(select) {
  console.log("onChangeConnectedUsers");
  var option = select.options[select.selectedIndex];
  var data = users[option.value];
  
  selected_conn = data.conn;
  createOutputsList(data.outputs);
}

function createOutputsList(outputs) {
  var select = document.getElementById("target-outputs");
  while (select.options.length !== 0) {
    select.remove(0);
  }
  for (var key in outputs) {
    var option = document.createElement("option");
    if (outputs[key] !== null) {
      option.innerHTML = outputs[key];
      option.value = outputs[key];
      select.appendChild(option);
    }
  }
  select.onchange = function() { onChangeTargetOutputs(select); };
  onChangeTargetOutputs(select);
}

function onChangeTargetOutputs(select) {
  if (select.options.length !== 0) {
    var selected_option = select.options[select.selectedIndex];
    selected_conn.send({'target' : selected_option.value});
  }
}

function onUserNameClick() {
  editUserName();
}

function onClickSpeakerIcon() {
  var select = document.getElementById("connected-users");
  var option = select.options[select.selectedIndex];
  var data = users[option.value];
  data.conn.send("open loopback");
  
  // var call = peer.call(data.conn.peer, mediaStream);
  // setCallCallbacks(call);
}