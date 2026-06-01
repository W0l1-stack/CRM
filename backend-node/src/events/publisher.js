const { redis } = require('../redis/client');

// Go->Node and Node-internal events flow over Redis on a per-account channel.
function channelForAccount(accountID) {
  return `lydia:events:${accountID}`;
}

// publishEvent fans an event out to all subscribers of an account (the Node
// event subscriber relays it to the account's Socket.io room).
async function publishEvent(accountID, type, data) {
  await redis.publish(channelForAccount(accountID), JSON.stringify({ type, data }));
}

module.exports = { publishEvent, channelForAccount };
