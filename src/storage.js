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
    .map(obj => ({
      path: obj.key.replace(prefix, ''),
      size: obj.size,
      sha256: obj.customMetadata?.sha256 || null,
      lines: obj.customMetadata?.lines ? parseInt(obj.customMetadata.lines) : null
    }))
    .filter(o => o.path && !isBlocked(o.path) && o.path !== '.dev.vars' && !o.path.endsWith('/.dev.vars'))
    .sort((a, b) => a.path.localeCompare(b.path));
}

export async function putFile(FILES, key, bytes, customMetadata = {}) {
  await FILES.put(key, bytes, { customMetadata });
}

