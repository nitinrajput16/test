// owner-controls.js
// Handles Room Owner features: read-only mode, kick, block

(function () {
    // Track owner state
    window.isRoomOwner = false;
    window.roomOwnerId = null;
    window.roomReadOnly = false;

    const ownerControlsCard = document.getElementById('ownerControlsCard');
    const readonlyToggleContainer = document.getElementById('readonlyToggleContainer');
    const readonlyToggle = document.getElementById('readonlyToggle');
    const usersList = document.getElementById('usersList');

    // Create read-only indicator
    const readonlyIndicator = document.createElement('div');
    readonlyIndicator.className = 'readonly-indicator';
    readonlyIndicator.textContent = '🔒 Read-Only Mode - Only the owner can edit';
    document.body.appendChild(readonlyIndicator);

    // Close any open dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.user-menu-container')) {
            document.querySelectorAll('.user-menu-dropdown.open').forEach(d => d.classList.remove('open'));
        }
    });

    function setEditorReadOnly(readOnly) {
        // Make Monaco editor read-only
        if (window.editor && typeof window.editor.updateOptions === 'function') {
            window.editor.updateOptions({ readOnly: readOnly });
        }
    }

    function initOwnerControls() {
        if (!window.socket) {
            setTimeout(initOwnerControls, 500);
            return;
        }

        const socket = window.socket;

        // Listen for owner info on join
        socket.on('room-owner', (data) => {
            window.isRoomOwner = data.isOwner;
            window.roomOwnerId = data.ownerId;
            window.roomReadOnly = data.settings?.readOnly || false;

            // Show/hide owner controls card
            if (ownerControlsCard) {
                ownerControlsCard.style.display = data.isOwner ? 'block' : 'none';
            }

            // Show/hide toggle slider beside run button (owner only)
            if (readonlyToggleContainer) {
                readonlyToggleContainer.style.display = data.isOwner ? 'flex' : 'none';
            }

            // Set toggle state
            if (readonlyToggle) {
                readonlyToggle.checked = window.roomReadOnly;
            }

            // Apply read-only to editor (non-owners only)
            if (!data.isOwner && window.roomReadOnly) {
                setEditorReadOnly(true);
            } else {
                setEditorReadOnly(false);
            }

            // Update read-only indicator
            updateReadOnlyIndicator();
        });

        // Listen for settings updates
        socket.on('room-settings-update', (data) => {
            // console.log('[Owner] Settings update:', data);
            
            if (readonlyToggle) {
                readonlyToggle.checked = window.roomReadOnly;
            }

            // Apply read-only to editor (non-owners only)
            if (!window.isRoomOwner && window.roomReadOnly) {
                setEditorReadOnly(true);
            } else {
                setEditorReadOnly(false);
            }

            updateReadOnlyIndicator();
        });

        // Listen for kick
        socket.on('room-kicked', (data) => {
            alert(data.message || 'You have been kicked from this room.');
            window.location.href = '/editor';
        });

        // Listen for block
        socket.on('room-blocked', (data) => {
            alert(data.message || 'You have been blocked from this room.');
            window.location.href = '/editor';
        });

        // Listen for read-only error
        socket.on('room-readonly-error', (data) => {
            console.warn('[Editor] Read-only:', data.message);
        });

        // Listen for general room errors
        socket.on('room-error', (data) => {
            alert(data.message || 'Room error occurred.');
        });

        // Bind toggle slider
        if (readonlyToggle) {
            readonlyToggle.addEventListener('change', () => {
                const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
                if (!roomId) return;
                socket.emit('room-settings', {
                    roomId,
                    readOnly: readonlyToggle.checked
                });
            });
        }

        // Listen for user list updates and augment existing entries (avoid re-rendering shared #usersList)
        socket.on('user-name', (users) => {
            // users may be array or single
            const list = Array.isArray(users) ? users : [users];
            list.forEach(u => augmentUserItem(u));
        });
    }

    function updateReadOnlyIndicator() {
        if (window.roomReadOnly && !window.isRoomOwner) {
            readonlyIndicator.classList.add('visible');
        } else {
            readonlyIndicator.classList.remove('visible');
        }
    }

    // Augment existing '.user-item' entries in shared users list with owner controls
    function augmentUserItem(user) {
        if (!usersList) return;
        // Determine matching selector: prefer socketId, fall back to username or id
        const uid = user.socketId || user.username || user.id || user._id || null;
        let item = null;
        if (uid) item = usersList.querySelector(`.user-item[data-socket-id="${uid}"]`) || usersList.querySelector(`.user-item[data-peer-id="${uid}"]`);
        // fallback: try to match by name/email
        if (!item && user.name) {
            const items = usersList.querySelectorAll('.user-item');
            for (const it of items) {
                const label = it.querySelector('span');
                if (label && label.textContent === user.name) { item = it; break; }
            }
        }
        if (!item) return; // nothing to augment yet

        // Avoid adding actions twice
        if (item.querySelector('.owner-augmented')) {
            // still update owner badge state below
        }

        const actions = document.createElement('div');
        actions.className = 'user-list-actions owner-augmented';

        // Mute button (for owner UI) - only if not self
        const mySocketId = (window.socket && window.socket.id) || null;
        if (user.socketId && user.socketId !== mySocketId) {
            const muteBtn = document.createElement('button');
            muteBtn.className = 'user-action-btn mute';
            muteBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
            muteBtn.title = 'Mute/Unmute user';
            muteBtn.dataset.userId = user.id || user.socketId;
            muteBtn.dataset.muted = 'false';
            muteBtn.addEventListener('click', () => {
                const isMuted = muteBtn.dataset.muted === 'true';
                muteBtn.dataset.muted = isMuted ? 'false' : 'true';
                muteBtn.innerHTML = isMuted
                    ? '<i class="fa-solid fa-volume-high"></i>'
                    : '<i class="fa-solid fa-volume-xmark"></i>';
                muteBtn.classList.toggle('muted', !isMuted);
                const audioEl = document.querySelector(`audio[data-peer-id="${user.socketId}"]`);
                if (audioEl) audioEl.muted = !isMuted;
            });
            actions.appendChild(muteBtn);
        }

        // 3-dot owner menu (only for owners and not for self)
        if (window.isRoomOwner && !user.isOwner) {
            const menuContainer = document.createElement('div');
            menuContainer.className = 'user-menu-container';

            const menuBtn = document.createElement('button');
            menuBtn.className = 'user-action-btn menu-btn';
            menuBtn.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
            menuBtn.title = 'More actions';

            const dropdown = document.createElement('div');
            dropdown.className = 'user-menu-dropdown';

            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('.user-menu-dropdown.open').forEach(d => { if (d !== dropdown) d.classList.remove('open'); });
                dropdown.classList.toggle('open');
            });

            const kickOption = document.createElement('div');
            kickOption.className = 'menu-option kick';
            kickOption.innerHTML = '<i class="fa-solid fa-user-minus"></i> Kick';
            kickOption.addEventListener('click', () => { dropdown.classList.remove('open'); kickUser(user.id || user.socketId); });
            dropdown.appendChild(kickOption);

            const blockOption = document.createElement('div');
            blockOption.className = 'menu-option block';
            blockOption.innerHTML = '<i class="fa-solid fa-ban"></i> Block';
            blockOption.addEventListener('click', () => { dropdown.classList.remove('open'); blockUser(user.id || user.socketId); });
            dropdown.appendChild(blockOption);

            menuContainer.appendChild(menuBtn);
            menuContainer.appendChild(dropdown);
            actions.appendChild(menuContainer);
        }

        // Owner badge: show a small crown/Owner pill next to the name
        const label = item.querySelector('span');
        const existingBadge = item.querySelector('.owner-badge');
        const isOwner = !!(user.isOwner || user.socketId === window.roomOwnerId || user.id === window.roomOwnerId || user._id === window.roomOwnerId);
        if (isOwner && !existingBadge) {
            const ownerBadge = document.createElement('span');
            ownerBadge.className = 'owner-badge';
            ownerBadge.title = 'Room owner';
            ownerBadge.innerHTML = ' Owner';
            if (label && label.parentNode) label.parentNode.insertBefore(ownerBadge, label.nextSibling);
            else item.insertBefore(ownerBadge, item.firstChild);
        } else if (!isOwner && existingBadge) {
            existingBadge.remove();
        }

        // Append actions to item (align right)
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.appendChild(actions);
    }

    function kickUser(targetUserId) {
        if (!confirm('Are you sure you want to kick this user?')) return;
        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (!roomId || !window.socket) return;
        window.socket.emit('room-kick', { roomId, targetUserId });
    }

    function blockUser(targetUserId) {
        if (!confirm('Are you sure you want to BLOCK this user? They will not be able to rejoin.')) return;
        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (!roomId || !window.socket) return;
        window.socket.emit('room-block', { roomId, targetUserId });
    }

    initOwnerControls();
})();
