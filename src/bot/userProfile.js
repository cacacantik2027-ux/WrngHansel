function touchUser(store, from) {
  const id = String(from.id);
  const now = new Date().toISOString();
  const existing = store.data.users[id];
  store.data.users[id] = {
    id: from.id,
    username: from.username || null,
    firstName: from.first_name || null,
    lastName: from.last_name || null,
    firstSeenAt: existing ? existing.firstSeenAt : now,
    lastSeenAt: now,
    messageCount: existing ? existing.messageCount + 1 : 1,
  };
  store.save();
}

function userCount(store) {
  return Object.keys(store.data.users).length;
}

module.exports = { touchUser, userCount };
