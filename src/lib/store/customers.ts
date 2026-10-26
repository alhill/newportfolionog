import { adminDb } from '../firebase-admin';
import type { Customer, CustomerNote, PostalAddress } from '../../types/store';
import { joinPersonName } from './contact';
import { StoreError } from './errors';
import { isIndexError } from './http';
import { mapOrder } from './orders';

function asString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function mapCustomer(id: string, data: FirebaseFirestore.DocumentData): Customer {
  const firstName = asString(data.firstName);
  const lastName = asString(data.lastName);
  return {
    id,
    email: asString(data.email) || id,
    firstName,
    lastName,
    name: asString(data.name) || joinPersonName(firstName, lastName),
    phone: asString(data.phone),
    addresses: Array.isArray(data.addresses) ? data.addresses as PostalAddress[] : [],
    adminNote: asString(data.adminNote),
    createdAt: asString(data.createdAt),
    updatedAt: asString(data.updatedAt),
  };
}

export async function listCustomers() {
  const snapshot = await adminDb.collection('customers').orderBy('updatedAt', 'desc').limit(100).get();
  return snapshot.docs.map((doc) => mapCustomer(doc.id, doc.data()));
}

export async function getCustomer(id: string) {
  const doc = await adminDb.collection('customers').doc(id).get();
  if (!doc.exists) return null;
  const notesSnap = await doc.ref.collection('notes').orderBy('createdAt', 'desc').limit(50).get();
  const notes: CustomerNote[] = notesSnap.docs.map((note) => ({
    id: note.id,
    message: asString(note.get('message')),
    createdAt: asString(note.get('createdAt')),
    createdBy: asString(note.get('createdBy')),
  }));

  let orders;
  try {
    const ordered = await adminDb.collection('orders').where('customerId', '==', id).orderBy('createdAt', 'desc').limit(30).get();
    orders = ordered.docs.map((order) => mapOrder(order.id, order.data()));
  } catch (error) {
    if (!isIndexError(error)) throw error;
    const fallback = await adminDb.collection('orders').where('customerId', '==', id).limit(30).get();
    orders = fallback.docs
      .map((order) => mapOrder(order.id, order.data()))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  return { customer: mapCustomer(doc.id, doc.data() || {}), notes, orders };
}

export async function updateCustomer(id: string, input: Record<string, unknown>) {
  const ref = adminDb.collection('customers').doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new StoreError('Cliente no encontrado', 404);
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim().slice(0, 80) : doc.get('firstName') || '';
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim().slice(0, 80) : doc.get('lastName') || '';
  const legacyName = typeof input.name === 'string' ? input.name.trim() : '';
  await ref.update({
    firstName: typeof firstName === 'string' ? firstName : '',
    lastName: typeof lastName === 'string' ? lastName : '',
    name: joinPersonName(String(firstName), String(lastName)) || legacyName || doc.get('name') || '',
    phone: typeof input.phone === 'string' ? input.phone.trim() : doc.get('phone'),
    adminNote: typeof input.adminNote === 'string' ? input.adminNote.trim().slice(0, 4000) : doc.get('adminNote'),
    updatedAt: new Date().toISOString(),
  });
  return getCustomer(id);
}

export async function addCustomerNote(id: string, message: string, userId: string) {
  const text = message.trim();
  if (!text) throw new StoreError('La nota está vacía');
  const ref = adminDb.collection('customers').doc(id);
  const doc = await ref.get();
  if (!doc.exists) throw new StoreError('Cliente no encontrado', 404);
  await ref.collection('notes').add({
    message: text.slice(0, 4000),
    createdAt: new Date().toISOString(),
    createdBy: userId,
  });
  return getCustomer(id);
}
