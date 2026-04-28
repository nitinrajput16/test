let roomId = document.body.dataset.room || window.WHITEBOARD_ROOM;
if (!roomId) {
  throw new Error('Whiteboard requires a room id (data-room attribute or window.WHITEBOARD_ROOM).');
}

if (document.body) {
  document.body.dataset.room = roomId;
}
window.WHITEBOARD_ROOM = roomId;

const socket = window.socket || io({ transports: ['websocket', 'polling'] });
window.socket = socket;
socket.emit('join-room', roomId);

const canvas = document.getElementById('whiteboardCanvas');
const overlay = document.getElementById('whiteboardOverlay');
const textInputWrapper = document.getElementById('textInputWrapper');
const textInput = document.getElementById('wbTextInput');
const ctx = canvas.getContext('2d', { desynchronized: true, alpha: false });
const octx = overlay.getContext('2d');
const canvasContainer = canvas.parentElement;

let resizeObserver = null;
let lastContainerSize = { width: 0, height: 0 };
let pendingResizeFrame = 0;

const state = {
  tool: 'pen',
  color: '#111111',
  size: 4,
  drawing: false,
  lastPoint: null,
  emitMeta: null,
  emitBuffer: [], // point buffer for event-based emits
  selectionBox: null, // { x1, y1, x2, y2 }
  selectedItems: [],
  isDraggingSelection: false,
  selectionDragStart: null
};
// model holds committed objects in drawing order
state.model = [];
state.currentStrokeId = null;
state.undoStack = [];
state.redoStack = [];

function isSelectionTool(tool = state.tool) {
  return tool === 'select' || tool === 'pointer';
}

function selectionAllowsMarquee(tool = state.tool) {
  return tool === 'select';
}

function cloneModel(model) {
  try {
    return JSON.parse(JSON.stringify(model || []));
  } catch (err) {
    console.warn('whiteboard: failed to clone model', err);
    return [];
  }
}

function emitBoardSnapshot(targetRoomId = roomId) {
  if (!socket || !targetRoomId) return;
  socket.emit('whiteboard:overwrite', { roomId: targetRoomId, board: cloneModel(state.model) });
}

function requestBoardSync(targetRoomId = roomId) {
  if (!socket || !targetRoomId) return;
  socket.emit('whiteboard:request-sync', { roomId: targetRoomId });
}

function pushHistory() {
  try {
    state.undoStack.push(JSON.parse(JSON.stringify(state.model || [])));
    // cap history to 50 entries
    if (state.undoStack.length > 50) state.undoStack.shift();
    // clear redo on new action
    state.redoStack.length = 0;
  } catch (e) {
    console.warn('History push failed', e);
  }
}

function undo() {
  if (!state.undoStack.length) return;
  // save current to redo
  state.redoStack.push(JSON.parse(JSON.stringify(state.model || [])));
  const prev = state.undoStack.pop();
  state.model = prev || [];
  redrawAll();
  // broadcast full model
  socket.emit('whiteboard:draw', { roomId, stroke: { model: state.model } });
  emitBoardSnapshot();
}

function redo() {
  if (!state.redoStack.length) return;
  state.undoStack.push(JSON.parse(JSON.stringify(state.model || [])));
  const next = state.redoStack.pop();
  state.model = next || [];
  redrawAll();
  socket.emit('whiteboard:draw', { roomId, stroke: { model: state.model } });
  emitBoardSnapshot();
}

let renderQueue = [];
let renderRAF = 0;

function scheduleRender(stroke) {
  renderQueue.push(stroke);
  if (!renderRAF) renderRAF = requestAnimationFrame(flushRenderQueue);
}

function flushRenderQueue() {
  renderRAF = 0;
  while (renderQueue.length) drawStroke(renderQueue.shift());
}

function drawStroke(stroke) {
  const pts = stroke.points || [];
  if (!pts.length) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = stroke.color || '#111';
  ctx.fillStyle = ctx.strokeStyle;
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    ctx.lineWidth = stroke.size * normalizePressure(curr.pressure);
    ctx.beginPath();
    ctx.moveTo(prev.x, prev.y);
    ctx.lineTo(curr.x, curr.y);
    ctx.stroke();
  }
  if (pts.length === 1) {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x, p.y, (stroke.size * normalizePressure(p.pressure)) / 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawShapeOn(ctxTarget, shape) {
  // shape: { type, x1,y1,x2,y2, color, size }
  if (!shape || !shape.type) return;
  ctxTarget.save();
  ctxTarget.strokeStyle = shape.color || '#111';
  ctxTarget.fillStyle = shape.color || '#111';
  ctxTarget.lineWidth = shape.size || 2;
  ctxTarget.lineCap = 'round';
  ctxTarget.lineJoin = 'round';
  const x1 = shape.x1, y1 = shape.y1, x2 = shape.x2, y2 = shape.y2;
  if (shape.type === 'line') {
    ctxTarget.beginPath();
    ctxTarget.moveTo(x1, y1);
    ctxTarget.lineTo(x2, y2);
    ctxTarget.stroke();
  } else if (shape.type === 'rect') {
    const rx = Math.min(x1, x2), ry = Math.min(y1, y2);
    const rw = Math.abs(x2 - x1), rh = Math.abs(y2 - y1);
    ctxTarget.strokeRect(rx, ry, rw, rh);
  } else if (shape.type === 'ellipse') {
    const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2;
    const rx = Math.abs((x2 - x1) / 2), ry = Math.abs((y2 - y1) / 2);
    ctxTarget.beginPath();
    ctxTarget.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
    ctxTarget.stroke();
  }
  ctxTarget.restore();
}

function drawTextOn(ctxTarget, txt) {
  // txt: { x, y, text, color, size }
  if (!txt || !txt.text) return;
  ctxTarget.save();
  ctxTarget.fillStyle = txt.color || '#111';
  const fontSize = (txt.size && Number(txt.size)) || 16;
  ctxTarget.font = `${fontSize}px sans-serif`;
  ctxTarget.textBaseline = 'top';
  ctxTarget.fillText(txt.text, txt.x, txt.y);
  ctxTarget.restore();
}

function genId() {
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

function addModelItem(item) {
  state.model.push(item);
  return state.model.length - 1;
}

function redrawAll() {
  // clear canvas without emitting, but preserve current selection overlay/state
  clearCanvas(true, { preserveSelection: true });
  for (let it of state.model) {
    if (!it) continue;
    if (it.type === 'stroke') {
      drawStroke(it);
    } else if (it.type === 'shape') {
      drawShapeOn(ctx, it.shape);
    } else if (it.type === 'text') {
      drawTextOn(ctx, it.text);
    }
  }
}

function bboxOf(item) {
  if (!item) return null;
  if (item.type === 'text') {
    const t = item.text;
    const fontSize = (t.size && Number(t.size)) || 16;
    ctx.save();
    ctx.font = `${fontSize}px sans-serif`;
    const w = ctx.measureText(t.text).width;
    ctx.restore();
    return { x: t.x, y: t.y, w: w, h: fontSize };
  }
  if (item.type === 'shape') {
    const s = item.shape;
    const x = Math.min(s.x1, s.x2);
    const y = Math.min(s.y1, s.y2);
    return { x, y, w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) };
  }
  if (item.type === 'stroke') {
    const pts = item.points || [];
    if (!pts.length) return null;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    pts.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    });
    const pad = (item.size || 4) * 1.5;
    return { x: minX - pad, y: minY - pad, w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 };
  }
  return null;
}

function drawSelectionBox(bounds) {
  octx.save();
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const ratio = window.devicePixelRatio || 1;
  octx.scale(ratio, ratio);
  if (!bounds) {
    octx.restore();
    return;
  }
  const { x, y, w, h } = bounds;
  octx.strokeStyle = '#0088ff';
  octx.setLineDash([6, 4]);
  octx.lineWidth = 1.5;
  octx.strokeRect(x, y, w, h);
  octx.fillStyle = 'rgba(0, 136, 255, 0.08)';
  octx.fillRect(x, y, w, h);
  octx.restore();
}

function getSelectionBounds(selBox) {
  if (!selBox) return null;
  const minX = Math.min(selBox.x1, selBox.x2);
  const minY = Math.min(selBox.y1, selBox.y2);
  const maxX = Math.max(selBox.x1, selBox.x2);
  const maxY = Math.max(selBox.y1, selBox.y2);
  return {
    x: minX,
    y: minY,
    w: Math.max(0, maxX - minX),
    h: Math.max(0, maxY - minY)
  };
}

function boxesIntersect(a, b) {
  if (!a || !b) return false;
  return !(a.x > b.x + b.w ||
           a.x + a.w < b.x ||
           a.y > b.y + b.h ||
           a.y + a.h < b.y);
}

function pointInBounds(point, bounds) {
  if (!point || !bounds) return false;
  return point.x >= bounds.x && point.x <= bounds.x + bounds.w &&
         point.y >= bounds.y && point.y <= bounds.y + bounds.h;
}

function getItemsInSelection(selBox) {
  const bounds = getSelectionBounds(selBox);
  if (!bounds) return [];
  const items = [];
  state.model.forEach((item, index) => {
    const box = bboxOf(item);
    if (box && boxesIntersect(box, bounds)) {
      items.push({ item, index });
    }
  });
  return items;
}

function moveSelectedItems(dx, dy) {
  if (!state.selectedItems || !state.selectedItems.length) return;
  state.selectedItems.forEach(({ item }) => {
    if (!item) return;
    if (item.type === 'stroke') {
      item.points.forEach(pt => { pt.x += dx; pt.y += dy; });
    } else if (item.type === 'shape') {
      item.shape.x1 += dx;
      item.shape.x2 += dx;
      item.shape.y1 += dy;
      item.shape.y2 += dy;
    } else if (item.type === 'text') {
      item.text.x += dx;
      item.text.y += dy;
    }
  });
  if (state.selectionBox) {
    state.selectionBox.x1 += dx;
    state.selectionBox.x2 += dx;
    state.selectionBox.y1 += dy;
    state.selectionBox.y2 += dy;
  }
  redrawAll();
  drawSelectionBox(getSelectionBounds(state.selectionBox));
  window.dispatchEvent(new CustomEvent('whiteboard:selected-items-moved'));
}

function selectionBoundsFromItems(items) {
  if (!items || !items.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  items.forEach(({ item }) => {
    const box = bboxOf(item);
    if (!box) return;
    minX = Math.min(minX, box.x);
    minY = Math.min(minY, box.y);
    maxX = Math.max(maxX, box.x + box.w);
    maxY = Math.max(maxY, box.y + box.h);
  });
  if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) return null;
  return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}

function normalizePressure(value) {
  if (typeof value !== 'number' || !isFinite(value)) return 1;
  const clamped = Math.min(1, Math.max(0.25, value));
  return clamped * 1.2;
}

function getEventClientPoint(evt) {
  if (typeof evt.clientX === 'number' && typeof evt.clientY === 'number') {
    return { clientX: evt.clientX, clientY: evt.clientY, pressure: evt.pressure };
  }
  const touch = (evt.touches && evt.touches[0]) || (evt.changedTouches && evt.changedTouches[0]);
  if (touch) {
    return { clientX: touch.clientX, clientY: touch.clientY, pressure: touch.force || touch.pressure };
  }
  return { clientX: 0, clientY: 0, pressure: 1 };
}

function pointerToCanvas(evt) {
  const rect = canvas.getBoundingClientRect();
  const point = getEventClientPoint(evt);
  return {
    x: (point.clientX - rect.left),
    y: (point.clientY - rect.top),
    pressure: point.pressure && point.pressure > 0 ? point.pressure : 1
  };
}

function beginStroke(evt) {
  evt.preventDefault();
  try {
    if (typeof evt.pointerId === 'number' && canvas.setPointerCapture) {
      canvas.setPointerCapture(evt.pointerId);
    }
  } catch (_) {}
  const p = pointerToCanvas(evt);
  // Select/pointer tools support marquee selection and drag
  if (isSelectionTool()) {
    const bounds = getSelectionBounds(state.selectionBox);
    const hasSelection = state.selectedItems && state.selectedItems.length;
    if (hasSelection && bounds && pointInBounds(p, bounds)) {
      pushHistory();
      state.isDraggingSelection = true;
      state.selectionDragStart = p;
      state.drawing = true;
      return;
    }
    if (!selectionAllowsMarquee()) {
      state.drawing = false;
      return;
    }
    state.selectionBox = { x1: p.x, y1: p.y, x2: p.x, y2: p.y };
    state.selectedItems = [];
    state.isDraggingSelection = false;
    state.selectionDragStart = null;
    state.drawing = true;
    drawSelectionBox(getSelectionBounds(state.selectionBox));
    return;
  }
  // Text tool opens input and does not start a stroke
  if (state.tool === 'text') {
    pushHistory();
    showTextInputAt(p.x, p.y);
    return;
  }
  // For any drawing/mutation actions, snapshot history now
  if (['pen','eraser','line','rect','ellipse'].includes(state.tool)) pushHistory();
  state.drawing = true;
  state.lastPoint = p;
  state.emitBuffer = [p];
  state.emitMeta = {
    color: state.tool === 'eraser' ? '#ffffff' : state.color,
    size: state.size,
    tool: state.tool,
    id: null
  };

  // shape tools use overlay for preview
  if (state.tool === 'line' || state.tool === 'rect' || state.tool === 'ellipse') {
    state.shapeStart = p;
    clearOverlay();
    return;
  }

  // freeform pen/eraser: render a single point immediately
  // create a new stroke model and mark id
  const sid = genId();
  state.currentStrokeId = sid;
  state.emitMeta.id = sid;
  const localStroke = { type: 'stroke', id: sid, color: state.emitMeta.color, size: state.emitMeta.size, points: [p] };
  addModelItem(localStroke);
  scheduleRender({ color: state.emitMeta.color, size: state.emitMeta.size, points: [p] });
  // small immediate emit to let others see start quickly
  emitStrokeChunk(false);
}

function moveStroke(evt) {
  if (!state.drawing && !isSelectionTool()) return;
  const p = pointerToCanvas(evt);

  if (isSelectionTool() && state.drawing) {
    if (state.isDraggingSelection && state.selectionDragStart) {
      const dx = p.x - state.selectionDragStart.x;
      const dy = p.y - state.selectionDragStart.y;
      if (dx || dy) {
        moveSelectedItems(dx, dy);
        state.selectionDragStart = p;
      }
      return;
    }
    if (selectionAllowsMarquee() && state.selectionBox) {
      state.selectionBox.x2 = p.x;
      state.selectionBox.y2 = p.y;
      drawSelectionBox(getSelectionBounds(state.selectionBox));
    }
    return;
  }

  // shape preview on overlay
  if (state.tool === 'line' || state.tool === 'rect' || state.tool === 'ellipse') {
    clearOverlay();
    drawShapeOn(octx, { type: state.tool, x1: state.shapeStart.x, y1: state.shapeStart.y, x2: p.x, y2: p.y, color: state.color, size: state.size });
    return;
  }

  // freeform: append point, render segment and emit in chunks
  state.emitBuffer.push(p);
  // append to current local stroke model
  const cur = state.model.length ? state.model[state.model.length - 1] : null;
  if (cur && cur.type === 'stroke' && cur.id === state.currentStrokeId) {
    cur.points.push(p);
  }
  scheduleRender({ color: state.emitMeta.color, size: state.emitMeta.size, points: [state.lastPoint || p, p] });
  if (state.emitBuffer.length >= EMIT_CHUNK) emitStrokeChunk(false);
  state.lastPoint = p;
}


function clearOverlay() {
  if (!octx) return;
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.clearRect(0, 0, overlay.width, overlay.height);
  const ratio = window.devicePixelRatio || 1;
  octx.scale(ratio, ratio);
}

function showTextInputAt(x, y) {
  // x,y are canvas-local coordinates (CSS pixels). Position wrapper and focus input.
  const rect = canvas.getBoundingClientRect();
  // account for page scroll (getBoundingClientRect is viewport-relative)
  const left = rect.left + x + (window.scrollX || window.pageXOffset || 0);
  const top = rect.top + y + (window.scrollY || window.pageYOffset || 0);
  textInputWrapper.style.left = left + 'px';
  textInputWrapper.style.top = top + 'px';
  textInputWrapper.style.display = 'block';
  textInput.value = '';
  textInput.focus();
  // store where to place text on commit
  state.pendingTextPos = { x, y };
}

function hideTextInput() {
  textInputWrapper.style.display = 'none';
  state.pendingTextPos = null;
  state.editingId = null;
}

// handle Enter/Escape on text input
textInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    const v = textInput.value.trim();
    if (v) {
      if (state.editingId) {
        // update existing text model
        const idx = state.model.findIndex(m => m.type === 'text' && m.id === state.editingId);
        if (idx >= 0) {
          state.model[idx].text.text = v;
          // redraw and emit update
          redrawAll();
          socket.emit('whiteboard:draw', { roomId, stroke: { id: state.editingId, text: state.model[idx].text } });
          emitBoardSnapshot();
        }
        state.editingId = null;
      } else if (state.pendingTextPos) {
        const pos = state.pendingTextPos;
        const txt = { x: pos.x, y: pos.y, text: v, color: state.color, size: Math.max(12, state.size * 3) };
        // create model entry
        const tid = genId();
        const modelText = { type: 'text', id: tid, text: txt };
        addModelItem(modelText);
        // draw locally
        drawTextOn(ctx, txt);
        // emit text object with id
        socket.emit('whiteboard:draw', { roomId, stroke: { id: tid, text: txt } });
        emitBoardSnapshot();
      }
    }
    hideTextInput();
  } else if (e.key === 'Escape') {
    hideTextInput();
  }
});

function endStroke(evt) {
  if (!state.drawing) return;
  evt.preventDefault();
  if (typeof evt.pointerId === 'number') {
    try { canvas.releasePointerCapture(evt.pointerId); } catch (_e) {}
  }
  const point = pointerToCanvas(evt);

  // If current tool is a shape, commit shape from shapeStart -> point
  if (state.tool === 'line' || state.tool === 'rect' || state.tool === 'ellipse') {
    if (state.shapeStart) {
      const shape = { type: state.tool, x1: state.shapeStart.x, y1: state.shapeStart.y, x2: point.x, y2: point.y, color: state.color, size: state.size };
        // create model entry with id and emit
        const sid = genId();
        const modelShape = { type: 'shape', id: sid, shape };
        // push history already done at drag start; add model item now
        addModelItem(modelShape);
      // draw locally and emit full shape with id
      drawShapeOn(ctx, shape);
      socket.emit('whiteboard:draw', { roomId, stroke: { id: sid, shape } });
      emitBoardSnapshot();
      state.shapeStart = null;
      clearOverlay();
    }
    state.drawing = false;
    return;
  }

  // finalize selection/pointer actions
  if (isSelectionTool()) {
    if (state.isDraggingSelection) {
      state.isDraggingSelection = false;
      state.selectionDragStart = null;
      drawSelectionBox(getSelectionBounds(state.selectionBox));
      state.drawing = false;
      emitBoardSnapshot();
      return;
    }

    if (selectionAllowsMarquee() && state.selectionBox) {
      const selected = getItemsInSelection(state.selectionBox);
      state.selectedItems = selected;
      if (selected.length) {
        state.selectionBox = selectionBoundsFromItems(selected) || state.selectionBox;
        drawSelectionBox(getSelectionBounds(state.selectionBox));
      } else {
        state.selectionBox = null;
        clearOverlay();
      }
    } else if (state.selectionBox) {
      drawSelectionBox(getSelectionBounds(state.selectionBox));
    }
    state.drawing = false;
    return;
  }

  // freeform drawing finalization
  state.emitBuffer.push(point);
  // append to the current local stroke model
  const cur2 = state.model.length ? state.model[state.model.length - 1] : null;
  if (cur2 && cur2.type === 'stroke' && cur2.id === state.currentStrokeId) {
    cur2.points.push(point);
  }
  scheduleRender({ color: state.emitMeta.color, size: state.emitMeta.size, points: [state.lastPoint || point, point] });
  // finalize: emit remaining points and mark end
  emitStrokeChunk(true);
  state.lastPoint = null;
  state.currentStrokeId = null;
  state.drawing = false;
  emitBoardSnapshot();
}

// Event-based emit: send stroke chunks immediately on user events.
// Chunk size keeps messages small while avoiding per-pointer spam.
const EMIT_CHUNK = 50;
function emitStrokeChunk(end = false) {
  if (!state.emitMeta || !state.emitBuffer.length) return;
  // splice up to EMIT_CHUNK points; if end is true, send all
  const pts = end ? state.emitBuffer.splice(0) : state.emitBuffer.splice(0, EMIT_CHUNK);
  const stroke = {
    color: state.emitMeta.color,
    size: state.emitMeta.size,
    tool: state.emitMeta.tool,
    id: state.emitMeta.id || null,
    points: pts,
    end: end && state.emitBuffer.length === 0
  };
  socket.emit('whiteboard:draw', { roomId, stroke });
  if (stroke.end) state.emitMeta = null;
}

function clearCanvas(localOnly = false, options = {}) {
  const { preserveSelection = false } = options;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();
  clearOverlay();
  if (!preserveSelection) {
    state.selectionBox = null;
    state.selectedItems = [];
    state.isDraggingSelection = false;
    state.selectionDragStart = null;
  } else if (state.selectionBox) {
    drawSelectionBox(getSelectionBounds(state.selectionBox));
  }
  if (!localOnly) {
    socket.emit('whiteboard:clear', { roomId });
  }
}

function resizeCanvas(preserve = true, forcedWidth, forcedHeight) {
  const ratio = window.devicePixelRatio || 1;
  const parent = canvas.parentElement;
  if (!parent) return;
  const width = typeof forcedWidth === 'number' ? forcedWidth : parent.clientWidth;
  const height = typeof forcedHeight === 'number' ? forcedHeight : parent.clientHeight;
  if (!width || !height) {
    // Canvas is collapsed; schedule a retry once layout settles
    if (!pendingResizeFrame) {
      pendingResizeFrame = requestAnimationFrame(() => {
        pendingResizeFrame = 0;
        resizeCanvas(true);
      });
    }
    return;
  }
  let snapshot = null;
  if (preserve) {
    snapshot = document.createElement('canvas');
    snapshot.width = canvas.width;
    snapshot.height = canvas.height;
    snapshot.getContext('2d').drawImage(canvas, 0, 0);
  }
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  overlay.width = Math.round(width * ratio);
  overlay.height = Math.round(height * ratio);
  overlay.style.width = width + 'px';
  overlay.style.height = height + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(ratio, ratio);
  octx.setTransform(1, 0, 0, 1, 0, 0);
  octx.scale(ratio, ratio);
  if (snapshot) {
    ctx.drawImage(snapshot, 0, 0, snapshot.width, snapshot.height, 0, 0, canvas.width / ratio, canvas.height / ratio);
  } else {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  // clear overlay to avoid stale previews after resize
  clearOverlay();
  lastContainerSize = { width, height };
}

function bindToolbar() {
  const toolButtons = document.querySelectorAll('.tool-btn');
  toolButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      toolButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.tool = btn.dataset.tool;
    });
  });

  const sizeInput = document.getElementById('brushSize');
  const sizeLabel = document.getElementById('brushSizeValue');
  sizeInput.addEventListener('input', () => {
    state.size = Number(sizeInput.value) || 1;
    sizeLabel.textContent = `${state.size}px`;
  });
  state.size = Number(sizeInput.value) || state.size;
  sizeLabel.textContent = `${state.size}px`;

  const swatches = document.querySelectorAll('.color-swatch');
  const customColor = document.getElementById('customColor');
  function selectColor(hex, updateCustom = true) {
    swatches.forEach(s => s.classList.toggle('active', s.dataset.color === hex));
    if (updateCustom) customColor.value = hex;
    state.color = hex;
    if (state.tool === 'eraser') {
      document.querySelector('[data-tool="pen"]').click();
    }
  }
  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => selectColor(swatch.dataset.color));
  });
  customColor.addEventListener('input', () => selectColor(customColor.value, false));
  selectColor(state.color);

  document.getElementById('clearBoard').addEventListener('click', () => {
    pushHistory();
    state.model = [];
    state.selectedItems = [];
    state.selectionBox = null;
    state.isDraggingSelection = false;
    state.selectionDragStart = null;
    clearCanvas();
    emitBoardSnapshot();
  });
  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.addEventListener('click', undo);
  if (redoBtn) redoBtn.addEventListener('click', redo);
  // keyboard shortcuts
  window.addEventListener('keydown', (e) => {
    const mac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const mod = mac ? e.metaKey : e.ctrlKey;
    if (mod && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo(); else undo();
    } else if (mod && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
      e.preventDefault();
      redo();
    }
  });
}

function bindCanvasEvents() {
  const supportsPointer = typeof window.PointerEvent !== 'undefined';
  const downHandler = (e) => beginStroke(e);
  const moveHandler = (e) => moveStroke(e);
  const upHandler = (e) => endStroke(e);

  if (supportsPointer) {
    canvas.addEventListener('pointerdown', downHandler);
    canvas.addEventListener('pointermove', moveHandler);
    window.addEventListener('pointerup', upHandler);
    canvas.addEventListener('pointerleave', upHandler);
    canvas.addEventListener('pointercancel', upHandler);
  } else {
    canvas.addEventListener('mousedown', downHandler);
    window.addEventListener('mousemove', moveHandler);
    window.addEventListener('mouseup', upHandler);
    canvas.addEventListener('mouseleave', upHandler);
    canvas.addEventListener('touchstart', downHandler, { passive: false });
    window.addEventListener('touchmove', moveHandler, { passive: false });
    window.addEventListener('touchend', upHandler, { passive: false });
    window.addEventListener('touchcancel', upHandler, { passive: false });
  }

  canvas.addEventListener('dblclick', (e) => {
    // double-click to edit text if present
    const p = pointerToCanvas(e);
    // find topmost text item
    for (let i = state.model.length - 1; i >= 0; i--) {
      const it = state.model[i];
      if (it && it.type === 'text') {
        const b = bboxOf(it);
        if (b && p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) {
          // push history before editing
          pushHistory();
          // fill input with existing text and mark pending edit
          state.pendingTextPos = { x: it.text.x, y: it.text.y };
          state.editingId = it.id;
          textInput.value = it.text.text;
          const rect = canvas.getBoundingClientRect();
          const left = rect.left + it.text.x + (window.scrollX || window.pageXOffset || 0);
          const top = rect.top + it.text.y + (window.scrollY || window.pageYOffset || 0);
          textInputWrapper.style.left = left + 'px';
          textInputWrapper.style.top = top + 'px';
          textInputWrapper.style.display = 'block';
          textInput.focus();
          return;
        }
      }
    }
  });
}

function bindSocketEvents() {
  socket.on('whiteboard:draw', (payload) => {
    const stroke = payload && (payload.stroke || payload);
    if (!stroke) return;
    // full model replacement
    if (stroke.model) {
      state.model = stroke.model || [];
      redrawAll();
      return;
    }
    // chunked free-form stroke parts
    if (Array.isArray(stroke.points) && stroke.points.length) {
      // find or create model stroke by id
      const sid = stroke.id || null;
      let modelStroke = null;
      if (sid) modelStroke = state.model.find(m => m.type === 'stroke' && m.id === sid);
      if (!modelStroke) {
        modelStroke = { type: 'stroke', id: sid || genId(), color: stroke.color || '#111', size: stroke.size || 4, points: [] };
        addModelItem(modelStroke);
      }
      // append points
      modelStroke.points = modelStroke.points.concat(stroke.points);
      // render the incoming points immediately
      const color = stroke.tool === 'eraser' ? '#ffffff' : stroke.color || modelStroke.color;
      scheduleRender({ color, size: stroke.size || modelStroke.size, points: stroke.points });
      return;
    }
    // shape object (create or replace)
    if (stroke.shape) {
      const sid = stroke.id || genId();
      let idx = state.model.findIndex(m => m.id === sid);
      const modelShape = { type: 'shape', id: sid, shape: stroke.shape };
      if (idx >= 0) state.model[idx] = modelShape; else addModelItem(modelShape);
      redrawAll();
      return;
    }
    // text object (create or update)
    if (stroke.text) {
      const sid = stroke.id || genId();
      let idx = state.model.findIndex(m => m.id === sid);
      const modelText = { type: 'text', id: sid, text: stroke.text };
      if (idx >= 0) state.model[idx] = modelText; else addModelItem(modelText);
      redrawAll();
      return;
    }
  });
  socket.on('whiteboard:clear', () => {
    state.model = [];
    state.selectedItems = [];
    state.selectionBox = null;
    state.isDraggingSelection = false;
    state.selectionDragStart = null;
    state.undoStack = [];
    state.redoStack = [];
    clearCanvas(true);
  });

  function applyRemoteBoard(board) {
    if (!Array.isArray(board)) return;
    state.model = board;
    state.selectedItems = [];
    state.selectionBox = null;
    state.isDraggingSelection = false;
    state.selectionDragStart = null;
    state.undoStack = [];
    state.redoStack = [];
    redrawAll();
    drawSelectionBox(null);
  }

  socket.on('whiteboard:overwrite', ({ board }) => applyRemoteBoard(board));
  socket.on('whiteboard:sync', ({ board }) => applyRemoteBoard(board));
}

function handleVisibilityCleanup() {
  window.addEventListener('beforeunload', () => {
    socket.emit('leave-room', roomId);
    if (resizeObserver) {
      try { resizeObserver.disconnect(); } catch (_) {}
    }
  });
}

function setupResizeObserver() {
  if (!canvasContainer || typeof ResizeObserver === 'undefined') {
    window.addEventListener('resize', () => {
      clearTimeout(init.resizeTimer);
      init.resizeTimer = setTimeout(() => resizeCanvas(true), 120);
    });
    return;
  }
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target !== canvasContainer) continue;
      const width = Math.round(entry.contentRect.width);
      const height = Math.round(entry.contentRect.height);
      if (!width || !height) {
        lastContainerSize = { width, height };
        continue;
      }
      if (width === lastContainerSize.width && height === lastContainerSize.height) return;
      lastContainerSize = { width, height };
      resizeCanvas(true, width, height);
      redrawAll();
    }
  });
  resizeObserver.observe(canvasContainer);
}

function init() {
  resizeCanvas(false);
  bindToolbar();
  bindCanvasEvents();
  bindSocketEvents();
  setupResizeObserver();
  requestBoardSync();
  handleVisibilityCleanup();
}

init();

const inlineWhiteboardApi = window.inlineWhiteboard || {};

inlineWhiteboardApi.refreshSize = function refreshSize() {
  resizeCanvas(true);
  redrawAll();
};

inlineWhiteboardApi.setRoom = function setRoom(newRoomId) {
  if (!newRoomId || newRoomId === roomId) return;
  const previousRoom = roomId;
  roomId = newRoomId;
  window.WHITEBOARD_ROOM = newRoomId;
  if (document.body) {
    document.body.dataset.room = newRoomId;
  }
  state.model = [];
  state.undoStack = [];
  state.redoStack = [];
  state.selectionBox = null;
  state.selectedItems = [];
  state.isDraggingSelection = false;
  state.selectionDragStart = null;
  hideTextInput();
  clearCanvas(true);
  if (socket && previousRoom && previousRoom !== newRoomId) {
    socket.emit('leave-room', previousRoom);
  }
  if (socket) {
    socket.emit('join-room', newRoomId);
    requestBoardSync(newRoomId);
  }
};

inlineWhiteboardApi.getRoom = function getRoom() {
  return roomId;
};

window.inlineWhiteboard = inlineWhiteboardApi;
