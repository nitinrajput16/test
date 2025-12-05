// audioChat.js
// WebRTC audio chat using Socket.IO for signaling (offer/answer/ICE). P2P only.
(function (global) {
  function initAudioChat({ socket, roomIdProvider, ui }) {
    const peers = new Map(); // peerId -> RTCPeerConnection
    const audioEls = new Map(); // peerId -> <audio>
    let localStream = null;
    let micMuted = false;

    const RTC_CFG = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    function getRoomId() {
      return typeof roomIdProvider === 'function' ? roomIdProvider() : roomIdProvider;
    }

    function status(msg) {
      if (ui && ui.statusEl) ui.statusEl.textContent = msg;
    }
    function setEnableLabel(on) {
      if (ui && ui.enableBtn) ui.enableBtn.textContent = on ? 'Disable Voice' : 'Enable Voice';
    }
    function setMuteLabel(muted) {
      if (ui && ui.muteBtn) ui.muteBtn.textContent = muted ? 'Unmute' : 'Mute';
    }

    async function ensureLocalStream() {
      if (localStream) return localStream;
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        micMuted = false;
        setMuteLabel(false);
        status('Mic enabled');
        return localStream;
      } catch (err) {
        status('Mic permission denied');
        throw err;
      }
    }

    function setMicEnabled(on) {
      if (!localStream) return;
      localStream.getAudioTracks().forEach(t => { t.enabled = on; });
      micMuted = !on;
      setMuteLabel(micMuted);
      status(on ? 'Mic on' : 'Mic muted');
      // notify UI about local mute state
      try { window.dispatchEvent(new CustomEvent('voice:local-muted', { detail: { muted: !on } })); } catch (e) { /* ignore */ }
      // inform peers (via server) about our mute status so UI can update
      try {
        socket.emit('voice-mute-status', { roomId: getRoomId(), muted: micMuted });
      } catch (e) { /* ignore */ }
    }

    function destroyPeer(peerId) {
      const pc = peers.get(peerId);
      if (pc) {
        pc.getSenders().forEach(s => pc.removeTrack(s));
        pc.close();
      }
      peers.delete(peerId);
      const audio = audioEls.get(peerId);
      if (audio) {
        audio.srcObject = null;
        audio.remove();
      }
      audioEls.delete(peerId);
      // Dispatch UI event for peer removal
      try { window.dispatchEvent(new CustomEvent('voice:peer-left', { detail: { peerId } })); } catch (e) { /* ignore */ }
    }

    function attachRemoteAudio(peerId, stream) {
      let el = audioEls.get(peerId);
      if (!el) {
        el = document.createElement('audio');
        el.autoplay = true;
        el.playsInline = true;
        el.dataset.peerId = peerId;
        if (ui && ui.containerEl) ui.containerEl.appendChild(el);
        audioEls.set(peerId, el);
      }
      el.srcObject = stream;
      // Dispatch event so UI can update (peer has an active audio stream)
      try { window.dispatchEvent(new CustomEvent('voice:peer-audio', { detail: { peerId } })); } catch (e) { /* ignore */ }
    }

    function createPeer(peerId, isInitiator) {
      if (peers.has(peerId)) return peers.get(peerId);
      const pc = new RTCPeerConnection(RTC_CFG);
      peers.set(peerId, pc);

      if (localStream) {
        localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
      }

      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('voice-ice', { roomId: getRoomId(), to: peerId, candidate: e.candidate });
        }
      };

      pc.ontrack = (e) => {
        const [remoteStream] = e.streams;
        if (remoteStream) attachRemoteAudio(peerId, remoteStream);
      };

      pc.onconnectionstatechange = () => {
        if (['failed', 'disconnected', 'closed'].includes(pc.connectionState)) {
          destroyPeer(peerId);
        }
      };

      if (isInitiator) {
        pc.createOffer()
          .then(offer => pc.setLocalDescription(offer))
          .then(() => {
            socket.emit('voice-offer', { roomId: getRoomId(), to: peerId, offer: pc.localDescription });
          })
          .catch(err => status('Offer error: ' + err.message));
      }

      // notify UI a peer was created (offer/answer flow may still be pending)
      try { window.dispatchEvent(new CustomEvent('voice:peer-created', { detail: { peerId } })); } catch (e) { /* ignore */ }

      return pc;
    }

    // --- Signaling ---
    socket.on('voice-peer-joined', async ({ peerId }) => {
      try {
        await ensureLocalStream();
        createPeer(peerId, true); // initiator creates offer
      } catch (err) {
        status('Voice join err: ' + err.message);
      }
    });

    socket.on('voice-offer', async ({ from, offer }) => {
      try {
        await ensureLocalStream();
        const pc = createPeer(from, false);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('voice-answer', { roomId: getRoomId(), to: from, answer });
      } catch (err) {
        status('Offer handle err: ' + err.message);
      }
    });

    socket.on('voice-answer', async ({ from, answer }) => {
      const pc = peers.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (err) {
        status('Answer err: ' + err.message);
      }
    });

    socket.on('voice-ice', async ({ from, candidate }) => {
      const pc = peers.get(from);
      if (!pc) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('ICE add failed', err);
      }
    });

    socket.on('voice-peer-left', ({ peerId }) => {
      destroyPeer(peerId);
    });

    // remote peer mute updates
    socket.on('voice-mute-status', ({ peerId, muted }) => {
      try { window.dispatchEvent(new CustomEvent('voice:peer-muted', { detail: { peerId, muted } })); } catch (e) { /* ignore */ }
    });

    async function enableVoice() {
      if (localStream) {
        disableVoice();
        return;
      }
      await ensureLocalStream();
      setMicEnabled(true);
      setEnableLabel(true);
      status('Voice enabled');
      socket.emit('voice-join', { roomId: getRoomId() });
      try { window.dispatchEvent(new CustomEvent('voice:enabled', { detail: { enabled: true } })); } catch (e) { /* ignore */ }
    }

    function disableVoice() {
      peers.forEach((_pc, pid) => destroyPeer(pid));
      if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
        localStream = null;
      }
      socket.emit('voice-leave', { roomId: getRoomId() });
      try { window.dispatchEvent(new CustomEvent('voice:disabled', { detail: { enabled: false } })); } catch (e) { /* ignore */ }
      setEnableLabel(false);
      status('Voice disabled');
    }

    function toggleMute() {
      setMicEnabled(micMuted); // flip
    }

    // wire UI
    if (ui && ui.enableBtn) ui.enableBtn.addEventListener('click', () => enableVoice().catch(err => status(err.message)));
    if (ui && ui.muteBtn) ui.muteBtn.addEventListener('click', toggleMute);

    return { enableVoice, disableVoice, toggleMute, peers };
  }

  global.AudioChat = { init: initAudioChat };
})(window);
