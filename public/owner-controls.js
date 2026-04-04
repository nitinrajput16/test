// owner-controls.js
// Handles Room Owner features: read-only mode, kick, block

(function () {
    // Track owner state
    window.isRoomOwner = false;
    window.roomOwnerId = null;
    window.roomReadOnly = false;
    window.roomCanEdit = true;
    window.roomEditGrants = Object.create(null);

    const userMetaById = new Map();

    const ownerControlsCard = document.getElementById('ownerControlsCard');
    const readonlyToggleContainer = document.getElementById('readonlyToggleContainer');
    const readonlyToggle = document.getElementById('readonlyToggle');
    const usersList = document.getElementById('usersList');

    // Create read-only indicator
    const readonlyIndicator = document.createElement('div');
    readonlyIndicator.className = 'readonly-indicator';
    readonlyIndicator.innerHTML = '<i class="fa-solid fa-lock"></i> Read-Only Mode - You do not have edit permission';
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

    function getMyUserId() {
        return window.myServerUserId
            || (window.user && (window.user.username || window.user._id || window.user.id))
            || (window.socket && window.socket.id)
            || null;
    }

    function normalizeRoomEditGrants(editGrants) {
        const next = Object.create(null);
        if (Array.isArray(editGrants)) {
            editGrants.forEach((uid) => {
                if (uid) next[uid] = true;
            });
        }
        window.roomEditGrants = next;
    }

    function setUserGrantState(userId, granted) {
        if (!userId) return;
        if (!window.roomEditGrants || typeof window.roomEditGrants !== 'object') {
            window.roomEditGrants = Object.create(null);
        }
        if (granted) {
            window.roomEditGrants[userId] = true;
        } else {
            delete window.roomEditGrants[userId];
        }
    }

    function isUserGranted(userId) {
        return !!(userId && window.roomEditGrants && window.roomEditGrants[userId]);
    }

    function isUserGrantedByMeta(user) {
        if (!user || !window.roomEditGrants) return false;
        const candidates = [user.id, user.username, user._id, user.socketId, user.socket].filter(Boolean);
        return candidates.some((key) => !!window.roomEditGrants[key]);
    }

    function getUserId(user) {
        return user && (user.id || user.username || user._id || user.socketId || user.socket) || null;
    }

    function applyEditorPermissionState() {
        const canEdit = !window.roomReadOnly || window.isRoomOwner || !!window.roomCanEdit;
        setEditorReadOnly(!canEdit);
    }

    function refreshAugmentedUserItems() {
        if (!usersList) return;
        userMetaById.forEach((user) => augmentUserItem(user));
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
            window.roomCanEdit = data.canEdit !== false;
            normalizeRoomEditGrants(data.editGrants);

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

            applyEditorPermissionState();
            refreshAugmentedUserItems();

            // Update read-only indicator
            updateReadOnlyIndicator();
        });

        // Listen for settings updates
        socket.on('room-settings-update', (data) => {
            console.log('[Owner] Settings update:', data);
            
            // Update the global state from server
            window.roomReadOnly = data.settings?.readOnly || false;
            
            if (readonlyToggle) {
                readonlyToggle.checked = window.roomReadOnly;
            }

            applyEditorPermissionState();
            refreshAugmentedUserItems();

            updateReadOnlyIndicator();
        });

        socket.on('room-user-permission-update', (data) => {
            if (!data || !data.userId) return;
            if (Array.isArray(data.editGrants)) {
                normalizeRoomEditGrants(data.editGrants);
            } else {
                setUserGrantState(data.userId, data.canEdit);
            }

            const myId = getMyUserId();
            if (myId && myId === data.userId && typeof data.effectiveCanEdit === 'boolean') {
                window.roomCanEdit = data.effectiveCanEdit;
            } else if (myId && myId === data.userId) {
                window.roomCanEdit = isUserGranted(myId);
            }

            if (myId) {
                // Keep local effective state aligned with latest room settings and grant map.
                window.roomCanEdit = !window.roomReadOnly || window.isRoomOwner || isUserGranted(myId);
            }

            const existing = userMetaById.get(data.userId) || { id: data.userId };
            existing.canEdit = !!data.effectiveCanEdit;
            userMetaById.set(data.userId, existing);

            applyEditorPermissionState();
            refreshAugmentedUserItems();
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
            const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
            const myId = getMyUserId();
            if (myId) {
                window.roomCanEdit = isUserGranted(myId);
            } else {
                window.roomCanEdit = false;
            }
            applyEditorPermissionState();
            updateReadOnlyIndicator();
            if (roomId) {
                socket.emit('ot-request-state', { roomId });
            }
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
            list.forEach((u) => {
                const userId = getUserId(u);
                if (userId) userMetaById.set(userId, u);
                augmentUserItem(u);
            });
        });
    }

    function updateReadOnlyIndicator() {
        const canEdit = !window.roomReadOnly || window.isRoomOwner || !!window.roomCanEdit;
        if (window.roomReadOnly && !canEdit) {
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
        if (uid) item = usersList.querySelector(`.user-item[data-user-id="${uid}"]`) || usersList.querySelector(`.user-item[data-socket-id="${uid}"]`) || usersList.querySelector(`.user-item[data-peer-id="${uid}"]`);
        // fallback: try to match by name/email
        if (!item && user.name) {
            const items = usersList.querySelectorAll('.user-item');
            for (const it of items) {
                const label = it.querySelector('span');
                if (label && label.textContent === user.name) { item = it; break; }
            }
        }
        if (!item) return; // nothing to augment yet

        // Rebuild owner-augmented actions to avoid stale duplicates.
        item.querySelectorAll('.owner-augmented').forEach((node) => node.remove());

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
        const targetUserId = getUserId(user);
        const myUserId = getMyUserId();
        const targetIsOwner = !!(user.isOwner || user.socketId === window.roomOwnerId || user.id === window.roomOwnerId || user._id === window.roomOwnerId);
        if (window.isRoomOwner && targetUserId && targetUserId !== myUserId && !targetIsOwner) {
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
            kickOption.addEventListener('click', () => { dropdown.classList.remove('open'); kickUser(targetUserId); });
            dropdown.appendChild(kickOption);

            const blockOption = document.createElement('div');
            blockOption.className = 'menu-option block';
            blockOption.innerHTML = '<i class="fa-solid fa-ban"></i> Block';
            blockOption.addEventListener('click', () => { dropdown.classList.remove('open'); blockUser(targetUserId); });
            dropdown.appendChild(blockOption);

            const granted = isUserGranted(targetUserId) || isUserGrantedByMeta(user);
            const grantOption = document.createElement('div');
            grantOption.className = 'menu-option';
            if (granted) {
                grantOption.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Revoke edit';
                grantOption.addEventListener('click', () => {
                    dropdown.classList.remove('open');
                    revokeEdit(targetUserId);
                });
            } else {
                grantOption.innerHTML = '<i class="fa-solid fa-pen"></i> Grant edit';
                grantOption.addEventListener('click', () => {
                    dropdown.classList.remove('open');
                    grantEdit(targetUserId);
                });
            }
            dropdown.appendChild(grantOption);

            menuContainer.appendChild(menuBtn);
            menuContainer.appendChild(dropdown);
            actions.appendChild(menuContainer);
        }

        // Owner badge: show a small crown/Owner pill next to the name
        const label = item.querySelector('span');
        const existingBadge = item.querySelector('.owner-badge');
        const isOwner = targetIsOwner;
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

        const existingEditBadge = item.querySelector('.edit-access-badge');
        const hasEditAccess = !!(user.canEdit || isOwner || isUserGranted(targetUserId));
        if (!isOwner && hasEditAccess && window.roomReadOnly && !existingEditBadge) {
            const editBadge = document.createElement('span');
            editBadge.className = 'edit-access-badge';
            editBadge.title = 'Can edit in read-only mode';
            editBadge.innerHTML = ' Editor';
            if (label && label.parentNode) label.parentNode.insertBefore(editBadge, label.nextSibling);
            else item.insertBefore(editBadge, item.firstChild);
        } else if (existingEditBadge && (!window.roomReadOnly || isOwner || !hasEditAccess)) {
            existingEditBadge.remove();
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

    function grantEdit(targetUserId) {
        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (!roomId || !window.socket || !targetUserId) return;
        window.socket.emit('room-grant-edit', { roomId, targetUserId });
    }

    function revokeEdit(targetUserId) {
        const roomId = window.currentRoom || window.WHITEBOARD_ROOM;
        if (!roomId || !window.socket || !targetUserId) return;
        window.socket.emit('room-revoke-edit', { roomId, targetUserId });
    }

    initOwnerControls();
})();
