import * as fs from 'fs';
import * as path from 'path';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

const PROJECT_ID = 'giftifridge-rules-test';

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: fs.readFileSync(path.resolve(__dirname, 'firestore.rules'), 'utf8'),
      host: 'localhost',
      port: 8080,
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

afterEach(async () => {
  await testEnv.clearFirestore();
});

async function seedSpaceWithOwner(spaceId: string, ownerId: string, name = 'Test Space') {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'spaces', spaceId), { name, ownerId, createdAt: 'now' });
    await setDoc(doc(db, 'spaces', spaceId, 'members', ownerId), {
      uid: ownerId,
      role: 'owner',
      joinedAt: 'now',
    });
  });
}

async function addMember(spaceId: string, uid: string) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'spaces', spaceId, 'members', uid), {
      uid,
      role: 'member',
      joinedAt: 'now',
    });
  });
}

async function seedGifticon(id: string, data: Record<string, unknown>) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'gifticons', id), data);
  });
}

describe('gifticons — personal ownership (unaffected by spaces)', () => {
  it('lets an owner read/update/delete their own gifticon', async () => {
    await seedGifticon('g1', { ownerId: 'alice', name: 'coffee' });
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'gifticons', 'g1')));
    await assertSucceeds(updateDoc(doc(alice, 'gifticons', 'g1'), { isUsed: true }));
    await assertSucceeds(deleteDoc(doc(alice, 'gifticons', 'g1')));
  });

  it("denies a stranger from reading someone else's personal gifticon", async () => {
    await seedGifticon('g2', { ownerId: 'alice', name: 'coffee' });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'gifticons', 'g2')));
  });
});

describe('gifticon creation', () => {
  it('allows creating a personal gifticon when ownerId matches the caller', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertSucceeds(setDoc(doc(alice, 'gifticons', 'g7'), { ownerId: 'alice', name: 'x' }));
  });

  it('denies creating a gifticon with a spoofed ownerId', async () => {
    const alice = testEnv.authenticatedContext('alice').firestore();
    await assertFails(setDoc(doc(alice, 'gifticons', 'g8'), { ownerId: 'bob', name: 'x' }));
  });
});

describe('gifticons in a space', () => {
  it('denies a non-member from reading a space gifticon', async () => {
    await seedSpaceWithOwner('space1', 'alice');
    await seedGifticon('g3', { ownerId: 'alice', spaceId: 'space1', name: 'coffee' });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'gifticons', 'g3')));
  });

  it('lets a space member read and update a gifticon added by someone else', async () => {
    await seedSpaceWithOwner('space1', 'alice');
    await addMember('space1', 'bob');
    await seedGifticon('g4', {
      ownerId: 'alice',
      spaceId: 'space1',
      name: 'coffee',
      isUsed: false,
    });
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(getDoc(doc(bob, 'gifticons', 'g4')));
    await assertSucceeds(updateDoc(doc(bob, 'gifticons', 'g4'), { isUsed: true }));
  });

  it('denies creating a gifticon in a space you are not a member of', async () => {
    await seedSpaceWithOwner('space1', 'alice');
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(
      setDoc(doc(bob, 'gifticons', 'g5'), { ownerId: 'bob', spaceId: 'space1', name: 'x' }),
    );
  });
});

describe('space membership', () => {
  it("lets a user create only their own membership doc, not someone else's", async () => {
    await seedSpaceWithOwner('space2', 'alice');
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(
      setDoc(doc(bob, 'spaces', 'space2', 'members', 'bob'), {
        uid: 'bob',
        role: 'member',
        joinedAt: 'now',
      }),
    );
    await assertFails(
      setDoc(doc(bob, 'spaces', 'space2', 'members', 'carol'), {
        uid: 'carol',
        role: 'member',
        joinedAt: 'now',
      }),
    );
  });

  it('rejects a membership doc whose uid field does not match the authenticated caller', async () => {
    await seedSpaceWithOwner('space3', 'alice');
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(
      setDoc(doc(bob, 'spaces', 'space3', 'members', 'bob'), {
        uid: 'carol',
        role: 'member',
        joinedAt: 'now',
      }),
    );
  });

  it('allows claiming role "owner" in one\'s own doc (role is cosmetic, not authoritative)', async () => {
    await seedSpaceWithOwner('space6', 'alice');
    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertSucceeds(
      setDoc(doc(bob, 'spaces', 'space6', 'members', 'bob'), {
        uid: 'bob',
        role: 'owner',
        joinedAt: 'now',
      }),
    );
    // Claiming the role doesn't grant real authority — only spaces/{id}.ownerId does.
    await assertFails(updateDoc(doc(bob, 'spaces', 'space6'), { name: 'hijack' }));
  });

  it('only the space owner can rename or delete the space', async () => {
    await seedSpaceWithOwner('space4', 'alice');
    await addMember('space4', 'bob');
    const bob = testEnv.authenticatedContext('bob').firestore();
    const alice = testEnv.authenticatedContext('alice').firestore();

    await assertFails(updateDoc(doc(bob, 'spaces', 'space4'), { name: 'hijacked' }));
    await assertSucceeds(updateDoc(doc(alice, 'spaces', 'space4'), { name: 'renamed' }));
    await assertFails(deleteDoc(doc(bob, 'spaces', 'space4')));
    await assertSucceeds(deleteDoc(doc(alice, 'spaces', 'space4')));
  });

  it('revokes gifticon access once the space itself is deleted, even if a stray member doc remains', async () => {
    await seedSpaceWithOwner('space5', 'alice');
    await addMember('space5', 'bob');
    await seedGifticon('g6', { ownerId: 'alice', spaceId: 'space5', name: 'coffee' });

    // Delete only the space doc, leaving bob's member subdoc behind (simulates incomplete cleanup).
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await deleteDoc(doc(context.firestore(), 'spaces', 'space5'));
    });

    const bob = testEnv.authenticatedContext('bob').firestore();
    await assertFails(getDoc(doc(bob, 'gifticons', 'g6')));
  });
});
