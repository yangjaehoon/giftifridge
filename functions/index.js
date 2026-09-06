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

// The scheduled sweep permanently deletes accounts and their data. Ship it in
// dry-run first: it logs every account it *would* delete (and the gifticon
// count) without touching anything, so a few weeks of logs can confirm no
// actively-used account is being caught before this is flipped to false and
// redeployed. onGifticonDeleted below is NOT gated by this — reversible image
// cleanup runs live immediately.
const CLEANUP_DRY_RUN = true;

const imagePath = (gifticonId) => `gifticons/${gifticonId}.jpg`;

async function deleteImage(gifticonId) {
  try {
    await getStorage().bucket().file(imagePath(gifticonId)).delete({ ignoreNotFound: true });
    return true;
  } catch (err) {
    logger.warn('image delete failed', { gifticonId, error: String(err) });
    return false;
  }
}

/**
 * A gifticon's photo in Storage is keyed by its doc id. Deleting it here — not
 * only in the client's deleteGifticon — makes the image cleanup reliable for an
 * in-app delete whose best-effort client Storage call failed (offline /
 * transient). The scheduled sweep deletes its images inline rather than leaning
 * on this fan-out.
 */
exports.onGifticonDeleted = onDocumentDeleted(
  { document: 'gifticons/{gifticonId}', region: REGION },
  (event) => deleteImage(event.params.gifticonId),
);

const DOC_BATCH_LIMIT = 400;
const IMAGE_DELETE_CONCURRENCY = 20;

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return results;
}

/**
 * Deletes every gifticon owned by `uid` and its Storage image. Images are
 * removed inline first so the sweep's success doesn't depend on hundreds of
 * onGifticonDeleted deliveries landing; that trigger still fires per
 * batch-deleted doc, but finds the object already gone (ignoreNotFound). In
 * dry-run mode nothing is deleted — the count is returned for the log.
 * Returns { gifticons, imagesDeleted }.
 */
async function deleteOwnedGifticons(db, uid, dryRun) {
  const snap = await db.collection('gifticons').where('ownerId', '==', uid).get();
  const ids = snap.docs.map((doc) => doc.id);
  if (dryRun) return { gifticons: ids.length, imagesDeleted: 0 };

  const outcomes = await mapWithConcurrency(ids, IMAGE_DELETE_CONCURRENCY, deleteImage);
  const imagesDeleted = outcomes.filter(Boolean).length;

  for (let i = 0; i < snap.docs.length; i += DOC_BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of snap.docs.slice(i, i + DOC_BATCH_LIMIT)) batch.delete(doc.ref);
    await batch.commit();
  }
  return { gifticons: ids.length, imagesDeleted };
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
    let eligible = 0;
    let deletedUsers = 0;
    let deletedGifticons = 0;
    let deletedImages = 0;
    let pageToken;

    do {
      const page = await auth.listUsers(1000, pageToken);
      pageToken = page.pageToken;
      for (const user of page.users) {
        scanned += 1;
        if (!isEligibleForCleanup(user, now, MAX_IDLE_MS)) continue;
        eligible += 1;
        try {
          const { gifticons, imagesDeleted } = await deleteOwnedGifticons(
            db,
            user.uid,
            CLEANUP_DRY_RUN,
          );
          deletedGifticons += gifticons;
          deletedImages += imagesDeleted;
          if (CLEANUP_DRY_RUN) {
            logger.info('cleanup dry-run: would delete', { uid: user.uid, gifticons });
          } else {
            await auth.deleteUser(user.uid);
            deletedUsers += 1;
          }
        } catch (err) {
          logger.error('cleanupInactiveAnonymousUsers: user cleanup failed', {
            uid: user.uid,
            error: String(err),
          });
        }
      }
    } while (pageToken);

    logger.info('cleanupInactiveAnonymousUsers: done', {
      dryRun: CLEANUP_DRY_RUN,
      scanned,
      eligible,
      deletedUsers,
      deletedGifticons,
      deletedImages,
    });
  },
);
