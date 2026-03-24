export type PlayerSuit = '♠' | '♥' | '♦' | '♣';
export type AvatarSuitId = 'spades' | 'hearts' | 'diamonds' | 'clubs';
export type AvatarColorId = 'red' | 'blue' | 'orange' | 'green';

export interface AvatarSuitOption {
  id: AvatarSuitId;
  name: string;
  symbol: PlayerSuit;
  key: 'spade' | 'heart' | 'diamond' | 'club';
}

export interface AvatarColorOption {
  id: AvatarColorId;
  name: string;
  value: string;
  light: string;
}

export interface AvatarIdentity {
  key: string;
  colorId: AvatarColorId;
  colorName: string;
  color: string;
  lightColor: string;
  suitId: AvatarSuitId;
  suitName: string;
  suit: PlayerSuit;
  label: string;
}
