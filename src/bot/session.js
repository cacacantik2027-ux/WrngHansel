// A "session" represents one user's open live-chat thread with the admin
// group. It is intentionally NOT tied to a specific talent's identity —
// bookings for a specific talent go through the structured booking form
// instead, so no chat is ever opened by clicking a person's photo/price.

function beginSession(store, from) {
  const id = String(from.id);
  store.data.sessions[id] = {
    userId: from.id,
    username: from.username || null,
    firstName: from.first_name || null,
    status: "open",
    startedAt: new Date().toISOString(),
    closedAt: null,
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
