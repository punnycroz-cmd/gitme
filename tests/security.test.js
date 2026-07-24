import { describe, it, expect } from 'vitest';
import { safeRelPath, safeProj, isBlocked } from '../src/security.js';

describe('isBlocked', () => {
  it('should block paths with node_modules', () => {
    expect(isBlocked('node_modules/express/index.js')).toBe(true);
    expect(isBlocked('src/node_modules/index.js')).toBe(true);
  });

  it('should block paths with credentials or env files', () => {
    expect(isBlocked('.env')).toBe(true);
    expect(isBlocked('.env.production')).toBe(true);
    expect(isBlocked('config/.env.local')).toBe(true);
    expect(isBlocked('credentials.json')).toBe(true);
  });

  it('should allow env.example files', () => {
    expect(isBlocked('.env.example')).toBe(false);
  });

  it('should block credentials with blocked extensions', () => {
    expect(isBlocked('key.pem')).toBe(true);
    expect(isBlocked('certs/cert.key')).toBe(true);
  });

  it('should allow normal source files', () => {
    expect(isBlocked('src/index.js')).toBe(false);
    expect(isBlocked('public/index.html')).toBe(false);
  });
});

describe('safeRelPath', () => {
  it('should block directory traversal attempts', () => {
    expect(safeRelPath('../etc/passwd')).toBe(null);
    expect(safeRelPath('src/../../etc/passwd')).toBe(null);
  });

  it('should normalize paths', () => {
    expect(safeRelPath('src/./helpers.js')).toBe('src/helpers.js');
    expect(safeRelPath('src//index.js')).toBe('src/index.js');
  });

  it('should block root paths', () => {
    expect(safeRelPath('/etc/passwd')).toBe(null);
  });

  it('should block blocked files', () => {
    expect(safeRelPath('.env')).toBe(null);
  });
});

describe('safeProj', () => {
  it('should validate normal project names', () => {
    expect(safeProj('my-cool-project')).toBe('my-cool-project');
    expect(safeProj('project.123')).toBe('project.123');
  });

  it('should reject names with path symbols', () => {
    expect(safeProj('..')).toBe(null);
    expect(safeProj('a/b')).toBe(null);
    expect(safeProj('a\\b')).toBe(null);
  });

  it('should reject invalid regex matchers', () => {
    expect(safeProj('!!!')).toBe(null);
    expect(safeProj('-start')).toBe(null); // regex requires starting with letter/number
  });
});
