// Each account gets its own Socket.io room so we never broadcast across tenants.
function roomForAccount(accountID) {
  return `account:${accountID}`;
}

module.exports = { roomForAccount };
