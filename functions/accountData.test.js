const { deleteAccount, imagePath, mapWithConcurrency } = require('./accountData');

// A minimal in-memory stand-in for the Admin Firestore/Storage/Auth surface
// that accountData touches: collection().where().get(), collectionGroup, a
// space doc ref's members subcollection + delete(), and batched deletes.
function createFakeEnv(seed = {}) {
  const state = {
    gifticons: (seed.gifticons || []).map((g) => ({ ...g })),
    spaces: (seed.spaces || []).map((s) => ({ ...s })),
    members: (seed.members || []).map((m) => ({ ...m })),
  };
  const deletedImages = [];
  const deletedUsers = [];
  const failImageIds = new Set(seed.failImageIds || []);

  const gifticonRef = (id) => ({
    id,
    _remove: () => {
      state.gifticons = state.gifticons.filter((g) => g.id !== id);
    },
  });
  const memberRef = (spaceId, uid) => ({
    id: uid,
    _remove: () => {
      state.members = state.members.filter((m) => !(m.spaceId === spaceId && m.uid === uid));
    },
  });
  const spaceRef = (id) => ({
    id,
    collection: (name) => {
      if (name !== 'members') throw new Error(`unexpected subcollection ${name}`);
      return {
        get: async () => ({
          docs: state.members
            .filter((m) => m.spaceId === id)
            .map((m) => ({ id: m.uid, ref: memberRef(id, m.uid) })),
        }),
      };
    },
    delete: async () => {
      state.spaces = state.spaces.filter((s) => s.id !== id);
    },
  });

  const whereGet = (name) => (field, _op, value) => ({
    get: async () => {
      if (name === 'gifticons') {
        return {
          docs: state.gifticons
            .filter((g) => g[field] === value)
            .map((g) => ({ id: g.id, ref: gifticonRef(g.id) })),
        };
      }
      if (name === 'spaces') {
        return {
          docs: state.spaces
            .filter((s) => s[field] === value)
            .map((s) => ({ id: s.id, ref: spaceRef(s.id) })),
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
  });

  const db = {
    collection: (name) => ({ where: whereGet(name) }),
    collectionGroup: (name) => {
      if (name !== 'members') throw new Error(`unexpected group ${name}`);
      return {
        where: (field, _op, value) => ({
          get: async () => ({
            docs: state.members
              .filter((m) => m[field] === value)
              .map((m) => ({ id: m.uid, ref: memberRef(m.spaceId, m.uid) })),
          }),
        }),
      };
    },
    batch: () => {
      const ops = [];
      return {
        delete: (ref) => ops.push(ref),
        commit: async () => ops.forEach((ref) => ref._remove()),
      };
    },
  };

  const storage = {
    bucket: () => ({
      file: (path) => ({
        delete: async () => {
          const id = path.replace(/^gifticons\//, '').replace(/\.jpg$/, '');
          if (failImageIds.has(id)) throw new Error('storage 500');
          deletedImages.push(path);
        },
      }),
    }),
  };

  const auth = {
    deleteUser: async (uid) => {
      deletedUsers.push(uid);
    },
  };

  return { db, storage, auth, state, deletedImages, deletedUsers };
}

describe('deleteAccount', () => {
  it("deletes the user's own gifticons and their images, then the auth user", async () => {
    const env = createFakeEnv({
      gifticons: [
        { id: 'g1', ownerId: 'u1' },
        { id: 'g2', ownerId: 'u1' },
        { id: 'g3', ownerId: 'other' },
      ],
    });

    const summary = await deleteAccount(env, 'u1');

    expect(env.state.gifticons.map((g) => g.id)).toEqual(['g3']);
    expect(env.deletedImages.sort()).toEqual(['gifticons/g1.jpg', 'gifticons/g2.jpg']);
    expect(env.deletedUsers).toEqual(['u1']);
    expect(summary).toMatchObject({ ownedGifticons: 2, ownedImages: 2, membershipsRemoved: 0 });
  });

  it('dissolves a space the user owns — its gifticons of any owner, its members, the space doc', async () => {
    const env = createFakeEnv({
      gifticons: [
        { id: 'g1', ownerId: 'u1', spaceId: 's1' },
        { id: 'g2', ownerId: 'friend', spaceId: 's1' },
      ],
      spaces: [{ id: 's1', ownerId: 'u1' }],
      members: [
        { spaceId: 's1', uid: 'u1' },
        { spaceId: 's1', uid: 'friend' },
      ],
    });

    const summary = await deleteAccount(env, 'u1');

    expect(env.state.gifticons).toEqual([]);
    expect(env.state.spaces).toEqual([]);
    expect(env.state.members).toEqual([]);
    expect(env.deletedImages.sort()).toEqual(['gifticons/g1.jpg', 'gifticons/g2.jpg']);
    // g1 (ownerId u1) is counted with the owned gifticons; the space pass then
    // only sees g2. Both member docs go with the dissolved space, so the
    // leftover-memberships query finds nothing.
    expect(summary).toMatchObject({
      ownedGifticons: 1,
      spacesDissolved: 1,
      spaceGifticons: 1,
      membershipsRemoved: 0,
    });
  });

  it("only removes the user's membership from a space owned by someone else", async () => {
    const env = createFakeEnv({
      gifticons: [{ id: 'g1', ownerId: 'owner', spaceId: 's1' }],
      spaces: [{ id: 's1', ownerId: 'owner' }],
      members: [
        { spaceId: 's1', uid: 'owner' },
        { spaceId: 's1', uid: 'u1' },
      ],
    });

    const summary = await deleteAccount(env, 'u1');

    expect(env.state.spaces).toEqual([{ id: 's1', ownerId: 'owner' }]);
    expect(env.state.gifticons).toEqual([{ id: 'g1', ownerId: 'owner', spaceId: 's1' }]);
    expect(env.state.members).toEqual([{ spaceId: 's1', uid: 'owner' }]);
    expect(env.deletedImages).toEqual([]);
    expect(summary).toMatchObject({ spacesDissolved: 0, membershipsRemoved: 1 });
  });

  it('reports a failed image delete without aborting the account teardown', async () => {
    const env = createFakeEnv({
      gifticons: [
        { id: 'g1', ownerId: 'u1' },
        { id: 'g2', ownerId: 'u1' },
      ],
      failImageIds: ['g1'],
    });
    const onImageError = jest.fn();

    const summary = await deleteAccount({ ...env, onImageError }, 'u1');

    expect(onImageError).toHaveBeenCalledWith('g1', expect.any(Error));
    expect(env.state.gifticons).toEqual([]);
    expect(env.deletedUsers).toEqual(['u1']);
    expect(summary).toMatchObject({ ownedGifticons: 2, ownedImages: 1 });
  });

  it('still deletes the auth user when the account owns nothing', async () => {
    const env = createFakeEnv();

    const summary = await deleteAccount(env, 'u1');

    expect(env.deletedUsers).toEqual(['u1']);
    expect(summary).toEqual({
      uid: 'u1',
      ownedGifticons: 0,
      ownedImages: 0,
      spacesDissolved: 0,
      spaceGifticons: 0,
      spaceImages: 0,
      membershipsRemoved: 0,
    });
  });
});

describe('helpers', () => {
  it('imagePath keys a Storage object by the gifticon id', () => {
    expect(imagePath('abc')).toBe('gifticons/abc.jpg');
  });

  it('mapWithConcurrency runs everything and preserves order', async () => {
    const seen = [];
    const out = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
      return n * 2;
    });

    expect(out).toEqual([2, 4, 6, 8, 10]);
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });
});
