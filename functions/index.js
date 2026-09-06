'use strict';

const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { getAuth } = require('firebase-admin/auth');
const { onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');

const { isEligibleForCleanup, MAX_IDLE_MS } = require('./eligibility');

initializeApp();

// The Firestore database is in asia-northeast3, so the Firestore trigger must
// run there too; the scheduled job is pinned to the same region for locality.
const REGION = 'asia-northeast3';

const imagePath = (gifticonId) => `gifticons/${gifticonId}.jpg`;

/**
 * A gifticon's photo in Storage is keyed by its doc id. Deleting it here —
 * rather than only in the client's deleteGifticon — means the image is cleaned
 * up on every delete path: an in-app delete whose best-effort client Storage
 * call failed (offline / transient), and the scheduled cleanup below, which
 * deletes docs with no client around to run the Storage call.
 */
exports.onGifticonDeleted = onDocumentDeleted(
  { document: 'gifticons/{gifticonId}', region: REGION },
  async (event) => {
    const { gifticonId } = event.params;
    try {
      await getStorage().bucket().file(imagePath(gifticonId)).delete({ ignoreNotFound: true });
    } catch (err) {
      logger.warn('onGifticonDeleted: image delete failed', {
        gifticonId,
        error: String(err),
      });
    }
  },
);

const BATCH_LIMIT = 400;

async function deleteOwnedGifticons(db, uid) {
  const snap = await db.collection('gifticons').where('ownerId', '==', uid).get();
  for (let i = 0; i < snap.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    // Each delete fires onGifticonDeleted, which removes the Storage image.
    for (const doc of snap.docs.slice(i, i + BATCH_LIMIT)) batch.delete(doc.ref);
    await batch.commit();
  }
  return snap.size;
}

/**
 * The app signs users in anonymously and never forces a login, so a user who
 * uninstalls (or clears app data) without deleting their gifticons first
 * leaves an anonymous account whose docs and images can never be reached
 * again. Once a week, delete anonymous accounts with no sign of life for 180
 * days, and everything they own. Linked (email / Google / Apple) accounts are
 * never touched. The 180-day rule is disclosed on first launch.
 */
exports.cleanupInactiveAnonymousUsers = onSchedule(
  { schedule: 'every monday 03:00', timeZone: 'Asia/Seoul', region: REGION },
  async () => {
    const db = getFirestore();
    const auth = getAuth();
    const now = Date.now();

    let scanned = 0;
    let deletedUsers = 0;
    let deletedGifticons = 0;
    let pageToken;

    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;
      for (const user of page.users) {
        scanned += 1;
        if (!isEligibleForCleanup(user, now, MAX_IDLE_MS)) continue;
        try {
          deletedGifticons += await deleteOwnedGifticons(db, user.uid);
          await auth.deleteUser(user.uid);
          deletedUsers += 1;
        } catch (err) {
          logger.error('cleanupInactiveAnonymousUsers: user cleanup failed', {
            uid: user.uid,
            error: String(err),
          });
        }
      }
    } while (pageToken);

    logger.info('cleanupInactiveAnonymousUsers: done', {
      scanned,
      deletedUsers,
      deletedGifticons,
    });
  },
);
