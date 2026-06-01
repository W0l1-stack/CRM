const { subscriber } = require('../redis/client');
const { emitToAccount } = require('../socket/server');
const { channelForAccount } = require('./publisher');
const logger = require('../logger');

const PREFIX = 'lydia:events:';

// startEventSubscriber pattern-subscribes to every account event channel and
// relays each event to the matching Socket.io room. This is how new inbound
// messages (and Go-published events) reach connected browsers in real time.
function startEventSubscriber() {
  subscriber.psubscribe(`${PREFIX}*`, (err, count) => {
    if (err) {
      logger.error({ err: err.message }, 'event psubscribe failed');
      return;
    }
    logger.info({ channels: count }, 'subscribed to account event channels');
  });

  subscriber.on('pmessage', (_pattern, channel, message) => {
    const accountID = channel.slice(PREFIX.length);
    try {
      const event = JSON.parse(message);
      emitToAccount(accountID, event.type, event.data);
    } catch (err) {
      logger.error({ channel, err: err.message }, 'invalid event payload');
    }
  });
}

// reference channelForAccount so the publisher/subscriber stay a matched pair
void channelForAccount;

module.exports = { startEventSubscriber };
