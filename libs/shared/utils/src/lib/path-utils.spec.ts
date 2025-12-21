import { describe, it, expect } from 'vitest';
import { getDirname } from './path-utils';

describe('path-utils', () => {
  describe('getDirname', () => {
    it('should extract directory from Unix path', () => {
      expect(getDirname('/home/user/file.txt')).toBe('/home/user');
    });

    it('should extract directory from Windows path', () => {
      expect(getDirname('C:\\Users\\file.txt')).toBe('C:\\Users');
    });

    it('should return . for filename without directory', () => {
      expect(getDirname('file.txt')).toBe('.');
    });

    it('should handle paths with mixed slashes', () => {
      expect(getDirname('/home/user\\subdir/file.txt')).toBe(
        '/home/user\\subdir',
      );
    });

    it('should handle root paths', () => {
      expect(getDirname('/file.txt')).toBe('');
    });
  });
});
