import { sync } from './sync.js';

describe('sync', () => {
  it('should work', () => {
    expect(sync()).toEqual('sync');
  });
});
