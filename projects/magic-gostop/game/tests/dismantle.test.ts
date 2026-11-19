import { describe, it, expect } from 'vitest';
import { ITEMS, grantItem, ownedOf, upgradeItem, upgradable, dismantleItem, UPGRADE_NEED, DISMANTLE_RATE } from '../src/ui/collection';

describe('승급·분해', () => {
  const id = ITEMS[0].id;
  it('등급마다 필요한 장수만큼 모여야 승급', () => {
    grantItem(id, 3, 2); // C 2장: C는 3장 필요
    expect(UPGRADE_NEED[3]).toBe(3);
    expect(upgradeItem(id, 3)).toBe(false);
    grantItem(id, 3, 1);
    expect(upgradable(id)).toBe(3);
    expect(upgradeItem(id, 3)).toBe(true);
    expect(ownedOf(id).C ?? 0).toBe(0);
    expect(ownedOf(id).B).toBe(1);
  });
  it('분해: 1장이 사라지고 확률대로 엽전·은화·다른 카드', () => {
    expect(DISMANTLE_RATE.yeop + DISMANTLE_RATE.eun + DISMANTLE_RATE.card).toBe(100);
    grantItem(id, 0, 3);
    expect(dismantleItem(id, 0, () => 0.1)?.kind).toBe('yeop');
    expect(dismantleItem(id, 0, () => 0.7)?.kind).toBe('eun');
    const r = dismantleItem(id, 0, () => 0.99);
    expect(r?.kind).toBe('card');
    if (r?.kind === 'card') { expect(r.item.id).not.toBe(id); expect(ownedOf(r.item.id).F).toBeGreaterThan(0); }
    expect(ownedOf(id).F ?? 0).toBe(0);
    expect(dismantleItem(id, 0)).toBeNull();
  });
});
