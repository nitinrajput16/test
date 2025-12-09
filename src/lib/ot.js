function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function cloneOp(op) {
  if (!op) return null;
  return op.type === 'insert'
    ? { type: 'insert', pos: op.pos, text: op.text || '', clientVersion: op.clientVersion || 0, userId: op.userId }
    : { type: 'delete', pos: op.pos, length: op.length || 0, clientVersion: op.clientVersion || 0, userId: op.userId };
}

function applyToDoc(doc, op) {
  if (!op) return doc;
  if (op.type === 'insert') {
    const pos = clamp(op.pos, 0, doc.length);
    return doc.slice(0, pos) + (op.text || '') + doc.slice(pos);
  }
  const start = clamp(op.pos, 0, doc.length);
  const end = clamp(op.pos + op.length, 0, doc.length);
  return doc.slice(0, start) + doc.slice(end);
}

function transformInsertInsert(op, against) {
  const result = cloneOp(op);
  if (against.pos < result.pos || (against.pos === result.pos && (against.userId || '') < (result.userId || ''))) {
    result.pos += (against.text || '').length;
  }
  return result;
}

function transformInsertDelete(op, against) {
  const result = cloneOp(op);
  const delStart = against.pos;
  const delEnd = against.pos + against.length;
  if (result.pos <= delStart) {
    return result;
  }
  if (result.pos >= delEnd) {
    result.pos -= against.length;
    return result;
  }
  result.pos = delStart;
  return result;
}

function transformDeleteInsert(op, against) {
  const result = cloneOp(op);
  if (against.pos >= result.pos + result.length) {
    return result;
  }
  if (against.pos <= result.pos) {
    result.pos += (against.text || '').length;
    return result;
  }
  // Insert happened inside the delete range -> expand delete to cover it
  result.length += (against.text || '').length;
  return result;
}

function transformDeleteDelete(op, against) {
  const result = cloneOp(op);
  const opStart = result.pos;
  const opEnd = result.pos + result.length;
  const againstStart = against.pos;
  const againstEnd = against.pos + against.length;

  if (opEnd <= againstStart) {
    return result;
  }
  if (opStart >= againstEnd) {
    result.pos -= against.length;
    return result;
  }

  const overlapStart = Math.max(opStart, againstStart);
  const overlapEnd = Math.min(opEnd, againstEnd);
  const overlap = overlapEnd - overlapStart;

  result.length -= overlap;
  if (opStart >= againstStart) {
    result.pos -= Math.min(against.length, opStart - againstStart);
  }
  if (result.length < 0) result.length = 0;
  return result;
}

function transform(op, against) {
  if (!op || !against || op === against) return cloneOp(op);
  if (against.type === 'insert') {
    if (op.type === 'insert') return transformInsertInsert(op, against);
    return transformDeleteInsert(op, against);
  }
  if (op.type === 'insert') return transformInsertDelete(op, against);
  return transformDeleteDelete(op, against);
}

function adjustCursor(cursor, op, userId) {
  if (!op) return cursor;
  let pos = cursor;
  if (op.type === 'insert') {
    if (op.pos < pos || (op.pos === pos && op.userId === userId)) {
      pos += (op.text || '').length;
    }
  } else {
    if (op.pos < pos) {
      const delta = Math.min(op.length, pos - op.pos);
      pos -= delta;
    }
  }
  return pos < 0 ? 0 : pos;
}

function createRoomState(initialDoc = '') {
  return {
    serverDoc: initialDoc,
    serverVersion: 0,
    history: [],
    syncSeq: 0
  };
}

function applyServerOperation(state, incoming) {
  if (!state || !incoming) return null;
  let op = cloneOp(incoming);
  for (let version = incoming.clientVersion; version < state.serverVersion; version += 1) {
    const hist = state.history[version];
    if (hist) {
      op = transform(op, hist);
    }
  }
  state.serverDoc = applyToDoc(state.serverDoc, op);
  state.history[state.serverVersion] = op;
  state.serverVersion += 1;
  return { ...op, clientVersion: state.serverVersion };
}

module.exports = {
  applyToDoc,
  transform,
  adjustCursor,
  createRoomState,
  applyServerOperation
};
