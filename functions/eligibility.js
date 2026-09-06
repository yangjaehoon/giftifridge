'use strict';

// 180 days with no sign of life. The app opens quietly refresh the anonymous
// user's ID token, so an installed app that gets opened even once every few
// months keeps its account alive; this only catches accounts whose app was
// uninstalled or had its data cleared. Users are told about this on first
// launch (see useFirstRunNotice).
const MAX_IDLE_MS = 180 * 24 * 60 * 60 * 1000;

// An anonymous Firebase Auth user has no linked sign-in providers. A user who
// linked an email / Google / Apple account is never cleaned up here — their
// data is recoverable, so keeping or deleting it is their choice.
function isAnonymous(userRecord) {
  return (userRecord.providerData || []).length === 0;
}

// Most recent sign of life. lastRefreshTime moves whenever the SDK refreshes
// the ID token (which happens on app open), so it's the best "is this app
// still installed" signal; fall back to the last explicit sign-in, then to
// account creation.
function lastActiveMs(userRecord) {
  const meta = userRecord.metadata || {};
  const stamp = meta.lastRefreshTime || meta.lastSignInTime || meta.creationTime;
  const ms = stamp ? Date.parse(stamp) : NaN;
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * True when this account is an abandoned anonymous one that the scheduled
 * cleanup should delete (along with everything it owns).
 */
function isEligibleForCleanup(userRecord, nowMs, maxIdleMs = MAX_IDLE_MS) {
  if (userRecord.disabled) return false;
  if (!isAnonymous(userRecord)) return false;
  const last = lastActiveMs(userRecord);
  if (!last) return false;
  return nowMs - last >= maxIdleMs;
}

module.exports = { MAX_IDLE_MS, isAnonymous, lastActiveMs, isEligibleForCleanup };
