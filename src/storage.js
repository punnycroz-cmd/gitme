// src/storage.js
import { isBlocked } from './security.js';

export async function listProjectFiles(FILES, user, proj) {
  const prefix = `projects/${user}/${proj}/`;
  let list = await FILES.list({ prefix });
  let objects = [...list.objects];
  while (list.truncated) {
    list = await FILES.list({ prefix, cursor: list.cursor });
    objects.push(...list.objects);
  }
  
  return objects
    .map(obj => obj.key.replace(prefix, ''))
    .filter(path => path && !isBlocked(path) && path !== '.dev.vars' && !path.endsWith('/.dev.vars'))
    .sort();
}

export async function getFileMeta(FILES, key) {
  const object = await FILES.head(key);
  if (!object) return null;
  return {
    size: object.size,
    sha256: object.customMetadata?.sha256 || null
  };
}

export async function putFile(FILES, key, bytes, customMetadata = {}) {
  await FILES.put(key, bytes, { customMetadata });
}
