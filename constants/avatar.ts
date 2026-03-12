import type {
  AvatarColorId,
  AvatarColorOption,
  AvatarIdentity,
  AvatarSuitId,
  AvatarSuitOption,
} from '@/types/avatar';

export const AVATAR_SUITS: readonly AvatarSuitOption[] = [
  { id: 'spades', name: 'Spades', symbol: '♠', key: 'spade' },
  { id: 'hearts', name: 'Hearts', symbol: '♥', key: 'heart' },
  { id: 'diamonds', name: 'Diamonds', symbol: '♦', key: 'diamond' },
  { id: 'clubs', name: 'Clubs', symbol: '♣', key: 'club' },
] as const;

export const AVATAR_COLORS: readonly AvatarColorOption[] = [
  { id: 'red', name: 'Red', value: '#E53E3E', light: '#FED7D7' },
  { id: 'blue', name: 'Blue', value: '#3B82F6', light: '#DBEAFE' },
  { id: 'orange', name: 'Orange', value: '#F97316', light: '#FFEDD5' },
  { id: 'green', name: 'Green', value: '#22C55E', light: '#DCFCE7' },
] as const;

const IDENTITY_ORDER: ReadonlyArray<readonly [AvatarColorId, AvatarSuitId]> = [
  ['blue', 'spades'],
  ['red', 'hearts'],
  ['green', 'diamonds'],
  ['orange', 'clubs'],
  ['red', 'spades'],
  ['blue', 'hearts'],
  ['orange', 'diamonds'],
  ['green', 'clubs'],
  ['green', 'spades'],
  ['orange', 'hearts'],
  ['blue', 'diamonds'],
  ['red', 'clubs'],
  ['orange', 'spades'],
  ['green', 'hearts'],
  ['red', 'diamonds'],
  ['blue', 'clubs'],
] as const;

export function buildAvatarIdentityKey(colorId: AvatarColorId, suitId: AvatarSuitId): string {
  const suit = AVATAR_SUITS.find((item) => item.id === suitId) ?? AVATAR_SUITS[0]!;
  return `${colorId}-${suit.key}`;
}

export const PLAYER_IDENTITIES: readonly AvatarIdentity[] = IDENTITY_ORDER.map(([colorId, suitId]) => {
  const color = AVATAR_COLORS.find((item) => item.id === colorId) ?? AVATAR_COLORS[0]!;
  const suit = AVATAR_SUITS.find((item) => item.id === suitId) ?? AVATAR_SUITS[0]!;

  return {
    key: buildAvatarIdentityKey(colorId, suitId),
    colorId,
    colorName: color.name,
    color: color.value,
    lightColor: color.light,
    suitId,
    suitName: suit.name,
    suit: suit.symbol,
    label: `${color.name} ${suit.symbol}`,
  };
});

export const DEFAULT_AVATAR_IDENTITY = PLAYER_IDENTITIES[0]!;

export function getAvatarIdentityByKey(identityKey: string | null | undefined): AvatarIdentity | null {
  if (!identityKey) {
    return null;
  }

  return PLAYER_IDENTITIES.find((identity) => identity.key === identityKey) ?? null;
}

export function getAvatarIdentityBySelection(colorId: AvatarColorId, suitId: AvatarSuitId): AvatarIdentity {
  return getAvatarIdentityByKey(buildAvatarIdentityKey(colorId, suitId)) ?? DEFAULT_AVATAR_IDENTITY;
}
