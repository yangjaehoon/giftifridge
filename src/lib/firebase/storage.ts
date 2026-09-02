import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from './config';

// The one module that touches firebase/storage and holds the `storage` handle.

export function storageRef(path: string) {
  return ref(storage, path);
}

export { deleteObject, getDownloadURL, uploadBytes };
