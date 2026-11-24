import { it, expect } from 'vitest';
// node에는 localStorage가 없어 간단한 대역을 둔다
const mem = new Map<string, string>();
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  get length() { return mem.size; }, key: (i: number) => [...mem.keys()][i] ?? null, getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => { mem.set(k, String(v)); }, removeItem: (k: string) => { mem.delete(k); }, clear: () => mem.clear(),
} as Storage;
import { makeBackup, readBackup } from '../src/ui/native';
it('백업 코드: 그대로면 읽히고, 손대면 거절', () => {
  localStorage.setItem('mg-coins-v1', '12345'); localStorage.setItem('mg-items-v2', '{"swap":{"F":2}}'); localStorage.setItem('other', 'x');
  const code = makeBackup();
  const r = readBackup(code)!;
  expect(r.data['mg-coins-v1']).toBe('12345');
  expect(r.data['mg-items-v2']).toContain('swap');
  expect(r.data.other).toBeUndefined();
  expect(readBackup(code.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')))).toBeNull();
  const parts = code.split('.'); parts[1] = parts[1].slice(0, -4) + 'AAAA';
  expect(readBackup(parts.join('.'))).toBeNull();
  expect(readBackup(' ' + code.slice(0, 20) + '\n' + code.slice(20))).not.toBeNull(); // 줄바꿈 섞여도 OK
});
