// A "session" represents one user's open live-chat thread with the admin
// group. It can optionally carry a `talent` reference (id + name) when the
// session was opened from a talent card's "Ajukan Order" button, so admins
// see straight away which talent the user is interested in.

function beginSession(store, from, context = {}) {
  const id = String(from.id);
  store.data.sessions[id] = {
    userId: from.id,
    username: from.username || null,
    firstName: from.first_name || null,
    status: "open",
    startedAt: new Date().toISOString(),
    closedAt: null,
    talentId: context.talentId || null,
    talentName: context.talentName || null,
  };
  return store.save();
}

function getSession(store, userId) {
  return store.data.sessions[String(userId)] || null;
}

function isSessionOpen(store, userId) {
  const s = getSession(store, userId);
  return !!s && s.status === "open";
}

function closeSession(store, userId) {
  const id = String(userId);
  const s = store.data.sessions[id];
  if (s) {
    s.status = "closed";
    s.closedAt = new Date().toISOString();
  }
  return store.save();
}

// Remember which group message corresponds to which user, so an admin's
// reply (a Telegram "reply to message") can be routed back correctly.
function indexGroupMessage(store, groupMessageId, userId) {
  store.data.groupMessageIndex[String(groupMessageId)] = userId;
  return store.save();
}

function resolveUserFromGroupMessage(store, groupMessageId) {
  return store.data.groupMessageIndex[String(groupMessageId)] || null;
}

module.exports = {
  beginSession,
  getSession,
  isSessionOpen,
  closeSession,
  indexGroupMessage,
  resolveUserFromGroupMessage,
};
