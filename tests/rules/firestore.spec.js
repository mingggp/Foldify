// Firestore Security Rules tests. Run with `npm run test:rules` (starts the emulator).
import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore'

let env

const face = (extra = {}) => ({
  color: '#ffffff', textureUrl: null, aiImageUrl: null, userImageUrl: null,
  rotation: 0, flipX: false, flipY: false, shapes: [], activeShapeIndex: null, ...extra,
})
const faces = (extra = {}) => ({ top: face(), bottom: face(), front: face(), back: face(), left: face(), right: face(), ...extra })
const box = (uid, extra = {}) => ({
  userId: uid, facesConfig: faces(), activeNetId: 3, netFlipX: false, netFlipY: false, netRotation: 1,
  schemaVersion: 2, createdAt: serverTimestamp(), title: 'Box Config 30/10/2026', visibility: 'private', ...extra,
})

test.beforeAll(async () => {
  const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080').split(':')
  env = await initializeTestEnvironment({
    projectId: 'demo-foldify',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host, port: Number(port) },
  })
})
test.afterAll(async () => { await env?.cleanup() })
test.beforeEach(async () => { await env.clearFirestore() })

const alice = () => env.authenticatedContext('alice').firestore()
const bob = () => env.authenticatedContext('bob').firestore()
const guest = () => env.unauthenticatedContext().firestore()
// seed data bypassing rules
const seed = (id, data) => env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'boxes', id), { ...data, createdAt: Timestamp.now() }))

test.describe('create', () => {
  test('signed-in user can save a box as themselves (what the app sends)', async () => {
    await assertSucceeds(setDoc(doc(alice(), 'boxes', 'b1'), box('alice')))
  })
  test('old-format box without the new optional fields is still accepted', async () => {
    const { netRotation: _r, schemaVersion: _s, visibility: _v, ...old } = box('alice')
    await assertSucceeds(setDoc(doc(alice(), 'boxes', 'b1'), old))
  })
  test('cannot save while signed out', async () => {
    await assertFails(setDoc(doc(guest(), 'boxes', 'b1'), box('alice')))
  })
  test('cannot save a box in someone else\'s name', async () => {
    await assertFails(setDoc(doc(bob(), 'boxes', 'b1'), box('alice')))
  })
  test('cannot back-date createdAt', async () => {
    await assertFails(setDoc(doc(alice(), 'boxes', 'b1'), box('alice', { createdAt: Timestamp.fromDate(new Date('2020-01-01')) })))
  })
  test('rejects junk fields and bad values', async () => {
    await assertFails(setDoc(doc(alice(), 'boxes', 'b1'), box('alice', { isAdmin: true })))
    await assertFails(setDoc(doc(alice(), 'boxes', 'b2'), box('alice', { activeNetId: 11 })))
    await assertFails(setDoc(doc(alice(), 'boxes', 'b3'), box('alice', { netRotation: 4 })))
    await assertFails(setDoc(doc(alice(), 'boxes', 'b4'), box('alice', { visibility: 'everyone' })))
    await assertFails(setDoc(doc(alice(), 'boxes', 'b5'), box('alice', { title: '' })))
    await assertFails(setDoc(doc(alice(), 'boxes', 'b6'), box('alice', { facesConfig: { top: face() } })))
    await assertFails(setDoc(doc(alice(), 'boxes', 'b7'), box('alice', { facesConfig: faces({ top: face({ hacked: 1 }) }) })))
  })
  test('rejects oversized pictures (keeps documents small)', async () => {
    const huge = 'data:image/jpeg;base64,' + 'A'.repeat(130_000)
    await assertFails(setDoc(doc(alice(), 'boxes', 'b1'), box('alice', { facesConfig: faces({ front: face({ textureUrl: huge }) }) })))
    const thumb = 'data:image/jpeg;base64,' + 'A'.repeat(10_000)
    await assertSucceeds(setDoc(doc(alice(), 'boxes', 'b2'), box('alice', { facesConfig: faces({ front: face({ textureUrl: thumb }) }) })))
  })
})

test.describe('read', () => {
  test.beforeEach(async () => {
    await seed('private1', { ...box('alice'), visibility: 'private' })
    const legacy = box('alice')
    delete legacy.visibility // saved before visibility existed
    await seed('legacy', legacy)
    await seed('public1', { ...box('alice'), visibility: 'public' })
  })
  test('owner can read and list their own boxes (Gallery query)', async () => {
    await assertSucceeds(getDoc(doc(alice(), 'boxes', 'private1')))
    const snap = await assertSucceeds(getDocs(query(collection(alice(), 'boxes'), where('userId', '==', 'alice'))))
    expect(snap.size).toBe(3)
  })
  test('other users and guests cannot read private (or legacy) boxes', async () => {
    await assertFails(getDoc(doc(bob(), 'boxes', 'private1')))
    await assertFails(getDoc(doc(guest(), 'boxes', 'private1')))
    await assertFails(getDoc(doc(bob(), 'boxes', 'legacy')))
    await assertFails(getDocs(query(collection(bob(), 'boxes'), where('userId', '==', 'alice'))))
  })
  test('anyone can open a public box; public boxes can be listed', async () => {
    await assertSucceeds(getDoc(doc(guest(), 'boxes', 'public1')))
    await assertSucceeds(getDoc(doc(bob(), 'boxes', 'public1')))
    const snap = await assertSucceeds(getDocs(query(collection(guest(), 'boxes'), where('visibility', '==', 'public'))))
    expect(snap.size).toBe(1)
  })
  test('cannot list the whole collection', async () => {
    await assertFails(getDocs(collection(bob(), 'boxes')))
  })
})

test.describe('update & delete', () => {
  test.beforeEach(async () => { await seed('b1', box('alice')) })
  test('owner can rename and publish', async () => {
    await assertSucceeds(updateDoc(doc(alice(), 'boxes', 'b1'), { title: 'ลูกบาศก์ข้อ 3', visibility: 'public' }))
  })
  test('owner cannot change contents or owner after saving', async () => {
    await assertFails(updateDoc(doc(alice(), 'boxes', 'b1'), { userId: 'bob' }))
    await assertFails(updateDoc(doc(alice(), 'boxes', 'b1'), { activeNetId: 0 }))
  })
  test('others cannot update or delete', async () => {
    await assertFails(updateDoc(doc(bob(), 'boxes', 'b1'), { title: 'mine now' }))
    await assertFails(deleteDoc(doc(bob(), 'boxes', 'b1')))
    await assertFails(deleteDoc(doc(guest(), 'boxes', 'b1')))
  })
  test('owner can delete', async () => {
    await assertSucceeds(deleteDoc(doc(alice(), 'boxes', 'b1')))
  })
})

test('every other collection is closed', async () => {
  await assertFails(setDoc(doc(alice(), 'users', 'alice'), { role: 'admin' }))
  await assertFails(getDoc(doc(guest(), 'anything', 'x')))
})
