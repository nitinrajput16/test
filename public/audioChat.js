// audioChat.js
// WebRTC audio chat using Socket.IO for signaling (offer/answer/ICE). P2P only.
(function (global) {
  function initAudioChat({ socket, roomIdProvider, ui }) {
    const peers = new Map(); // peerId -> RTCPeerConnection
    const audioEls = new Map(); // peerId -> <audio>
    const remoteMutePref = new Map(); // peerId -> muted (local preference)
    const analysers = new Map(); // peerId -> { analyser, source }
    const vadState = new Map(); // peerId -> { speaking, speakCount, silenceCount }
    let audioCtx = null;
    let localStream = null;
    let micMuted = false;

    const RTC_CFG = {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    };

    const getRoomId = () => typeof roomIdProvider === 'function' ? roomIdProvider() : roomIdProvider;
    const status = (msg) => ui?.statusEl && (ui.statusEl.textContent = msg);
    const setEnableLabel = (on) => ui?.enableBtn && (ui.enableBtn.textContent = on ? 'Disable Voice' : 'Enable Voice');
    const setMuteLabel = (muted) => ui?.muteBtn && (ui.muteBtn.textContent = muted ? 'Unmute' : 'Mute');

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
      localStream.getAudioTracks().forEach(t => t.enabled = on);
      micMuted = !on;
      setMuteLabel(micMuted);
      status(on ? 'Mic on' : 'Mic muted');
      try {
        window.dispatchEvent(new CustomEvent('voice:local-muted', { detail: { muted: !on } }));
        socket.emit('voice-mute-status', { roomId: getRoomId(), muted: micMuted });
      } catch (e) {}
    }

    function destroyPeer(peerId) {
      const pc = peers.get(peerId);
      if (pc) { pc.getSenders().forEach(s => pc.removeTrack(s)); pc.close(); }
      peers.delete(peerId);
      const audio = audioEls.get(peerId);
      if (audio) { audio.srcObject = null; audio.remove(); }
      audioEls.delete(peerId);
      remoteMutePref.delete(peerId);
      const a = analysers.get(peerId);
      if (a) { try { a.source?.disconnect(); a.analyser?.disconnect(); } catch (e) {} }
      analysers.delete(peerId);
      vadState.delete(peerId);
      try { window.dispatchEvent(new CustomEvent('voice:peer-left', { detail: { peerId } })); } catch (e) {}
    }

    function startVADLoop(peerId, token) {
      const entry = analysers.get(peerId);
      if (!entry) return;
      const myToken = token || entry.token;
      const analyser = entry.analyser;
      const bufferLen = analyser.fftSize;
      const data = new Uint8Array(bufferLen);

      const threshold = 20; 
      const minSpeakFrames = 2; 
      const silenceFramesToStop = 8; 

      function step() {
        const latest = analysers.get(peerId);
        if (!latest || (myToken && latest.token !== myToken)) {
          return;
        }
        try {
          analyser.getByteTimeDomainData(data);
        } catch (e) {
          return;
        }
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length);
        const level = rms * 255;

        const state = vadState.get(peerId) || { speaking: false, speakCount: 0, silenceCount: 0 };
        if (level > threshold) {
          state.speakCount++;
          state.silenceCount = 0;
        } else {
          state.silenceCount++;
          state.speakCount = 0;
        }

        if (!state.speaking && state.speakCount >= minSpeakFrames) {
          state.speaking = true;
          try { window.dispatchEvent(new CustomEvent('voice:peer-speaking', { detail: { peerId } })); } catch (e) {}
        } else if (state.speaking && state.silenceCount >= silenceFramesToStop) {
          state.speaking = false;
          try { window.dispatchEvent(new CustomEvent('voice:peer-stopped', { detail: { peerId } })); } catch (e) {}
        }

        vadState.set(peerId, state);
        requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }

    function setRemoteMuted(peerId, muted) {
      remoteMutePref.set(peerId, !!muted);
      const audio = audioEls.get(peerId);
      if (audio) audio.muted = !!muted;
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
      // Setup analyser for voice activity detection (VAD)
      try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const src = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.3;
        src.connect(analyser);
        const token = Symbol('vad-loop');
        analysers.set(peerId, { analyser, source: src, token });
        vadState.set(peerId, { speaking: false, speakCount: 0, silenceCount: 0 });
        startVADLoop(peerId, token);
      } catch (e) {
        // AudioContext may fail in some browsers or when autoplay blocked
        console.warn('VAD init failed for', peerId, e);
      }
      try {
        const muted = !!remoteMutePref.get(peerId);
        el.muted = muted;
      } catch (e) { /* ignore */ }
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

      try { window.dispatchEvent(new CustomEvent('voice:peer-created', { detail: { peerId } })); } catch (e) { /* ignore */ }

      return pc;
    }

    // --- Signaling ---
    socket.on('voice-peer-joined', async ({ peerId }) => {
      try {
        await ensureLocalStream();
        createPeer(peerId, true); 
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
      setMicEnabled(micMuted); 
    }

    if (ui && ui.enableBtn) ui.enableBtn.addEventListener('click', () => enableVoice().catch(err => status(err.message)));
    if (ui && ui.muteBtn) ui.muteBtn.addEventListener('click', toggleMute);

    return { enableVoice, disableVoice, toggleMute, peers, setRemoteMuted, setMicEnabled };
  }

  global.AudioChat = { init: initAudioChat };
})(window);
