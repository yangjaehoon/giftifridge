'use strict';

// User-initiated account teardown, kept dependency-injected and free of the
// firebase-admin / firebase-functions requires (like ./eligibility) so it can be
// unit-tested with plain fakes. index.js supplies the real db / auth / storage
// handles and wraps this in the onCall entrypoint.

const DOC_BATCH_LIMIT = 400;
const IMAGE_DELETE_CONCURRENCY = 20;

// A gifticon's photo in Storage is keyed by its doc id (mirrors the client and
// onGifticonDeleted).
const imagePath = (gifticonId) => `gifticons/${gifticonId}.jpg`;

async function mapWithConcurrency(items, limit, fn) {
  const results = [];
  for (let i = 0; i < items.length; i += limit) {
    results.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return results;
}

// Deletes one Storage object, treating "already gone" as success. Returns
// whether an object was actually removed. Failures are reported through
// `onImageError` rather than a logger require so this module stays testable.
async function deleteImage(storage, gifticonId, onImageError) {
  try {
    await storage.bucket().file(imagePath(gifticonId)).delete({ ignoreNotFound: true });
    return true;
  } catch (err) {
    if (onImageError) onImageError(gifticonId, err);
    return false;
  }
}

async function deleteRefsInBatches(db, refs) {
  for (let i = 0; i < refs.length; i += DOC_BATCH_LIMIT) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + DOC_BATCH_LIMIT)) batch.delete(ref);
    await batch.commit();
  }
}

// Deletes every gifticon returned by `gifticonQuery` and its Storage image.
// Images go first and inline so success doesn't hinge on hundreds of
// onGifticonDeleted deliveries landing. Returns { gifticons, imagesDeleted }.
async function deleteGifticons(deps, gifticonQuery) {
  const { db, storage, onImageError } = deps;
  const docs = (await gifticonQuery.get()).docs;
  if (docs.length === 0) return { gifticons: 0, imagesDeleted: 0 };

  const outcomes = await mapWithConcurrency(docs, IMAGE_DELETE_CONCURRENCY, (doc) =>
    deleteImage(storage, doc.id, onImageError),
  );
  await deleteRefsInBatches(
    db,
    docs.map((doc) => doc.ref),
  );
  return { gifticons: docs.length, imagesDeleted: outcomes.filter(Boolean).length };
}

/**
 * Permanently deletes a user's account and everything it owns:
 *
 *  - every gifticon whose ownerId is this user (including ones shared into a
 *    space) and its Storage image;
 *  - every space this user *owns* — dissolved whole: all of its gifticons (any
 *    owner), all member docs, then the space doc, mirroring the client's
 *    deleteSpace;
 *  - this user's membership in spaces owned by someone else;
 *  - the Firebase Auth user (deleted last, so a mid-way failure leaves an
 *    account the user can retry with rather than orphaned data).
 *
 * Runs with Admin privileges, so Firestore rules don't apply and write order is
 * only a batching concern. Returns a summary for the caller's log.
 */
async function deleteAccount(deps, uid) {
  const { db, auth } = deps;

  const owned = await deleteGifticons(deps, db.collection('gifticons').where('ownerId', '==', uid));

  const ownedSpaces = (await db.collection('spaces').where('ownerId', '==', uid).get()).docs;
  let spaceGifticons = 0;
  let spaceImages = 0;
  for (const spaceDoc of ownedSpaces) {
    const inSpace = await deleteGifticons(
      deps,
      db.collection('gifticons').where('spaceId', '==', spaceDoc.id),
    );
    spaceGifticons += inSpace.gifticons;
    spaceImages += inSpace.imagesDeleted;

    const memberRefs = (await spaceDoc.ref.collection('members').get()).docs.map((d) => d.ref);
    await deleteRefsInBatches(db, memberRefs);
    await spaceDoc.ref.delete();
  }

  // Memberships in spaces owned by others. Some of these docs belong to spaces
  // just dissolved above; deleting an already-gone doc in a batch is a no-op, so
  // there's no need to filter them out.
  const memberships = (await db.collectionGroup('members').where('uid', '==', uid).get()).docs;
  await deleteRefsInBatches(
    db,
    memberships.map((d) => d.ref),
  );

  await auth.deleteUser(uid);

  return {
    uid,
    ownedGifticons: owned.gifticons,
    ownedImages: owned.imagesDeleted,
    spacesDissolved: ownedSpaces.length,
    spaceGifticons,
    spaceImages,
    membershipsRemoved: memberships.length,
  };
}

module.exports = { deleteAccount, imagePath, mapWithConcurrency };
