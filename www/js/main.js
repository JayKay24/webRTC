/***
 * Excerpted from "Programming WebRTC",
 * published by The Pragmatic Bookshelf.
 * Copyrights apply to this code. It may not be used to create training material,
 * courses, books, articles, and the like. Contact us if you are in doubt.
 * We make no guarantees that this code is fit for any purpose.
 * Visit https://pragprog.com/titles/ksrtc for more book information.
***/
'use strict';

/**
 * Classes
 */
class VideoFX {
  constructor() {
    this.filters = ['grayscale', 'sepia', 'noir', 'psychedelic', 'none'];
  }

  cycleFilter() {
    const filter = this.filters.shift();
    this.filters.push(filter);
    return filter;
  }
}

/**
 *  Global Variables: $self and $peer
 */
const $self = {
  rtcConfig: null,
  isPolite: false,
  isMakingOffer: false,
  isIgnoringOffer: false,
  isSettingRemoteAnswerPending: false,
  mediaConstraints: { audio: true, video: true },
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {
    audio: false,
  },
};

const $peer = {
  connection: new RTCPeerConnection($self.rtcConfig),
  mediaStream: new MediaStream(),
  mediaTracks: {},
  features: {},
};

/**
 *  Signaling-Channel Setup
 */
const namespace = prepareNamespace(window.location.hash, true);
const sc = io.connect('/' + namespace, { autoConnect: false });

registerScCallbacks();

/**
 * =========================================================================
 *  Begin Application-Specific Code
 * =========================================================================
 */



/**
 *  User-Interface Setup
 */
document.querySelector('#header h1')
  .innerText = 'Welcome to Room #' + namespace;

document.querySelector('#call-button')
  .addEventListener('click', handleCallButton);

document.querySelector('#self')
  .addEventListener('click', handleSelfVideo);

document.querySelector('#chat-form')
  .addEventListener('submit', handleMessageForm);

/**
 *  User-Media Setup
 */
requestUserMedia($self.mediaConstraints);
$self.filters = new VideoFX();
$self.messageQueue = [];

/**
 *  User-Interface Functions and Callbacks
 */
function handleCallButton(event) {
  const callButton = event.target;
  if (callButton.className === 'join') {
    console.log('Joining the call...')
    callButton.className = 'leave';
    callButton.innerText = 'Leave Call';
    joinCall();
  } else {
    console.log('Leaving the call...');
    callButton.className = 'join';
    callButton.innerText = 'Join Call';
    leaveCall();
  }
}

function joinCall() {
  sc.open();
}

function leaveCall() {
  sc.close();
  resetPeer($peer);
}

function handleSelfVideo(event) {
  if ($peer.connection.connectionState !== 'connected') return;
  const filter = `filter-${$self.filters.cycleFilter()}`;
  const fdc = $peer.connection.createDataChannel(filter);
  fdc.onclose = function() {
    console.log(`Remote peer has closed the ${filter} data channel`);
  };
  event.target.className = filter;
}

function appendMessage(sender, log_element, message) {
  const log = document.querySelector(log_element);
  const li = document.createElement('li');
  li.className = sender;
  li.innerText = message.text;
  li.dataset.timestamp = message.timestamp;
  log.appendChild(li);
  if (log.scrollTo) {
    log.scrollTo({
      top: log.scrollHeight,
      behavior: 'smooth'
    });
  } else {
    log.scrollTop = log.scrollHeight;
  }
}

function handleMessageForm(event) {
  event.preventDefault();
  const input = document.querySelector('#chat-msg');
  const message = {};
  message.text = input.value
  message.timestamp = Date.now();
  if (message.text === '') return;

  appendMessage('self', '#chat-log', message);
  sendOrQueueMessage($peer, message);
  input.value = '';
}

function queueMessage(message, push = true) {
  if (push) {
    $self.messageQueue.push(message); // queue at the end
  } else {
    $self.messageQueue.unshift(message); // queue at the start
  }
}

function sendOrQueueMessage(peer, message, push = true) {
  const chatChannel = peer.chatChannel;
  if (!chatChannel || chatChannel.readyState !== 'open') {
    queueMessage(message, push);
    return;
  }
  try {
    chatChannel.send(JSON.stringify(message));
  } catch (e) {
    console.error('Error sending message:', e);
    queueMessage(message, push);
  }
}

/**
 *  User-Media Functions
 */
async function requestUserMedia(media_constraints) {
  $self.media = await navigator.mediaDevices
    .getUserMedia(media_constraints);
  
  // Hold onto audio- & video-track references
  $self.mediaTracks.audio = $self.media.getAudioTracks()[0];
  $self.mediaTracks.video = $self.media.getVideoTracks()[0];

  // Mute the audio if `$self.features.audio` evaluates to `false`
  $self.mediaTracks.audio.enabled = !!$self.features.audio;

  // Add audio & video tracks to mediaStream
  $self.mediaStream.addTrack($self.mediaTracks.audio);
  $self.mediaStream.addTrack($self.mediaTracks.video);

  displayStream($self.mediaStream, '#self');
}

function displayStream(stream, selector) {
  document.querySelector(selector).srcObject = stream;
}

function addStreamingMedia(peer) {
  const tracksList = Object.keys($self.mediaTracks);
  for(let track of tracksList) {
    peer.connection.addTrack($self.mediaTracks[track]);
  }
}

/**
 * User-Media & Data-Channel Functions
 */
function addChatChannel(peer) {
  peer.chatChannel = peer.connection.createDataChannel('text chat', { negotiated: true, id: 100 });
  peer.chatChannel.onmessage = function(event) {
    const message = JSON.parse(event.data);
    if (!message.id) {
      // prepare a response and append an incoming message
      const response = {
        id: message.timestamp,
        timestamp: Date.now()
      };
      sendOrQueueMessage(peer, response);
      appendMessage('peer', '#chat-log', message);
    } else {
      // Handle an incoming response
      handleResponse(message);
    }
    
  }
  peer.chatChannel.onclose = function() {
    console.log('Chat channel closed.');
  }
  peer.chatChannel.onopen = function() {
    console.log('Chat channel opened');
    while ($self.messageQueue.length > 0 && $peer.chatChannel.readyState === 'open') {
      console.log('Attempting to send a message from the queue...');
      // get the message at the front of the queue
      let message = $self.messageQueue.shift();
      sendOrQueueMessage(peer, message, false);
    }
  };
}

function handleResponse(response) {
  const sent_item = document.querySelector(`#chat-log *[data-timestamp="${response.id}"]`);
  const classes = ['received'];
  if (response.timestamp - response.id > 1000) {
    classes.push('delayed');
  }
  sent_item.classList.add(...classes);
}

/**
 *  Call Features & Reset Functions
 */
function establishCallFeatures(peer) {
  registerRtcCallbacks(peer);
  addChatChannel(peer);
  addStreamingMedia(peer);
}

function resetPeer(peer) {
  displayStream(null, '#peer');
  peer.connection.close();
  peer.connection = new RTCPeerConnection($self.rtcConfig);
  peer.mediaStream = new MediaStream();
  peer.mediaTracks = {};
  peer.features = {};
}

/**
 *  WebRTC Functions and Callbacks
 */
function registerRtcCallbacks(peer) {
  peer.connection.onconnectionstatechange = handleRtcConnectionStateChange;
  peer.connection.ondatachannel = handleRtcDataChannel;
  peer.connection.onnegotiationneeded = handleRtcConnectionNegotiation;
  peer.connection.onicecandidate = handleRtcIceCandidate;
  peer.connection.ontrack = handleRtcPeerTrack;
}

function handleRtcPeerTrack({ track }) {
  console.log(`Handle incoming ${track.kind} track...`);
  $peer.mediaTracks[track.kind] = track;
  $peer.mediaStream.addTrack(track);
  displayStream($peer.mediaStream, '#peer');
}

function handleRtcConnectionStateChange() {
  const connectionState = $peer.connection.connectionState;
  console.log(`The connection state is now ${connectionState}`);
  document.querySelector('body').className = connectionState;
}

function handleRtcDataChannel({ channel }) {
  const label = channel.label;
  console.log(`Data channel added for ${label}`);
  if (label.startsWith('filter-')) {
    document.querySelector('#peer').className = label;
    channel.onopen = function() {
      channel.close();
    };
  } else {
    console.log(`Opened ${channel.label} channel with an ID of ${channel.id}`)
  }
}


/**
 * =========================================================================
 *  End Application-Specific Code
 * =========================================================================
 */



/**
 *  Reusable WebRTC Functions and Callbacks
 */
async function handleRtcConnectionNegotiation() {
  $self.isMakingOffer = true;
  console.log('Attempting to make an offer...');
  await $peer.connection.setLocalDescription();
  sc.emit('signal', { description: $peer.connection.localDescription });
  $self.isMakingOffer = false;
}

async function handleRtcIceCandidate({ candidate }) {
  console.log('Attempting to handle an ICE candidate...');
  sc.emit('signal', { candidate });
}


/**
 *  Signaling-Channel Functions and Callbacks
 */
function registerScCallbacks() {
  sc.on('connect', handleScConnect);
  sc.on('connected peer', handleScConnectedPeer);
  sc.on('disconnected peer', handleScDisconnectedPeer);
  sc.on('signal', handleScSignal);
}

function handleScConnect() {
  console.log('Successfully connected to the signalling server!');
  establishCallFeatures($peer);
}

function handleScConnectedPeer() {
  $self.isPolite = true;
}

function handleScDisconnectedPeer() {
  resetPeer($peer);
  establishCallFeatures($peer);
}

async function handleScSignal({ description, candidate }) {
  if (description) {
    const readyForOffer = !$self.isMakingOffer && 
      ($peer.connection.signalingState === 'stable' ||
        $self.isSettingRemoteAnswerPending
      );
    const offerCollision = description.type === 'offer' && !readyForOffer;
    $self.isIgnoringOffer = !$self.isPolite && offerCollision;

    if ($self.isIgnoringOffer) return;

    $self.isSettingRemoteAnswerPending = description.type === 'answer';
    await $peer.connection.setRemoteDescription(description);
    $self.isSettingRemoteAnswerPending = false;

    if (description.type === 'offer') {
      await $peer.connection.setLocalDescription();
      sc.emit('signal', { description: $peer.connection.localDescription });
    }
  } else if (candidate) {
    try {
      await $peer.connection.addIceCandidate(candidate);
    } catch (e) {
      // Log error unless $self is ignoring offers
      // and candidate is not an empty string
      if (!$self.isIgnoringOffer && candidate.candidate.length > 1) {
        console.error('Unable to add ICE candidate for peer: ', e);
      }
    }
  }
}


/**
 *  Utility Functions
 */
function prepareNamespace(hash, set_location) {
  let ns = hash.replace(/^#/, '');
  if (/^[0-9]{7}$/.test(ns)) {
    console.log();
    return ns;
  }

  ns = Math.random().toString().substring(2, 9);
  console.log('Created new namespace', ns);
  if (set_location) window.location.hash = ns;
  return ns;
}