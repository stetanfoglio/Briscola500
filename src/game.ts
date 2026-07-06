export type Suit = 'Denari' | 'Coppe' | 'Spade' | 'Bastoni';
export type Rank = 'Asso' | 'Tre' | 'Re' | 'Cavallo' | 'Fante' | 'Sette' | 'Sei' | 'Cinque' | 'Quattro' | 'Due';
export type PlayerId = 'human' | 'cpu';

export type Card = {
  id: string;
  suit: Suit;
  rank: Rank;
  points: number;
  power: number;
};

export type PlayedCard = {
  player: PlayerId;
  card: Card;
};

export type Meld = {
  id: string;
  player: PlayerId;
  name: string;
  cards: string;
  points: number;
};

export type Announcement = {
  player: PlayerId;
  title: string;
  detail: string;
  points: number;
};

export type GameState = {
  handNumber: number;
  deck: Card[];
  briscola: Suit | null;
  humanHand: Card[];
  cpuHand: Card[];
  table: PlayedCard[];
  leader: PlayerId;
  turn: PlayerId;
  scores: Record<PlayerId, number>;
  matchScores: Record<PlayerId, number>;
  takenCards: Record<PlayerId, Card[]>;
  declaredMeldIds: Set<string>;
  melds: Meld[];
  announcement?: Announcement;
  log: string[];
  status: 'playing' | 'resolving' | 'handFinished' | 'finished';
  winner?: PlayerId | 'draw';
};

const suits: Suit[] = ['Denari', 'Coppe', 'Spade', 'Bastoni'];
const ranks: Rank[] = ['Asso', 'Tre', 'Re', 'Cavallo', 'Fante', 'Sette', 'Sei', 'Cinque', 'Quattro', 'Due'];
const rankPoints: Record<Rank, number> = {
  Asso: 11,
  Tre: 10,
  Re: 4,
  Cavallo: 3,
  Fante: 2,
  Sette: 0,
  Sei: 0,
  Cinque: 0,
  Quattro: 0,
  Due: 0,
};

const rankPower: Record<Rank, number> = {
  Asso: 10,
  Tre: 9,
  Re: 8,
  Cavallo: 7,
  Fante: 6,
  Sette: 5,
  Sei: 4,
  Cinque: 3,
  Quattro: 2,
  Due: 1,
};

export function createNewGame(): GameState {
  return dealHand({ human: 0, cpu: 0 }, 1, 'human', []);
}

export function startNextHand(state: GameState): GameState {
  if (state.status !== 'handFinished') {
    return state;
  }

  return dealHand(
    state.matchScores,
    state.handNumber + 1,
    state.leader,
    [`Nuova smazzata. Totale: Tu ${state.matchScores.human}, CPU ${state.matchScores.cpu}.`, ...state.log].slice(0, 9),
  );
}

function dealHand(
  matchScores: Record<PlayerId, number>,
  handNumber: number,
  leader: PlayerId,
  log: string[],
): GameState {
  const shuffled = shuffle(createDeck());
  const humanHand = shuffled.splice(0, 5);
  const cpuHand = shuffled.splice(0, 5);

  return {
    handNumber,
    deck: shuffled,
    briscola: null,
    humanHand,
    cpuHand,
    table: [],
    leader,
    turn: leader,
    scores: { human: 0, cpu: 0 },
    matchScores,
    takenCards: { human: [], cpu: [] },
    declaredMeldIds: new Set(),
    melds: [],
    log: [`Smazzata ${handNumber}: nessuna briscola. La prima cantata stabilisce il seme.`, ...log].slice(0, 9),
    status: 'playing',
  };
}

export function playHumanCard(state: GameState, cardId: string): GameState {
  return playPlayerCard(state, 'human', cardId);
}

export function playPlayerCard(state: GameState, player: PlayerId, cardId: string): GameState {
  if (state.status !== 'playing' || state.turn !== player) {
    return state;
  }

  const hand = player === 'human' ? state.humanHand : state.cpuHand;
  const card = hand.find((item) => item.id === cardId);
  return card ? playCard(state, player, card) : state;
}

export function playCpuTurn(state: GameState): GameState {
  if (state.status !== 'playing' || state.turn !== 'cpu') {
    return state;
  }

  const declared = declareAvailableMelds(state, 'cpu');
  if (declared.status !== 'playing') {
    return declared;
  }

  return playCard(declared, 'cpu', chooseCpuCard(declared));
}

export function declareHumanMeld(state: GameState, meldId: string): GameState {
  return declarePlayerMeld(state, 'human', meldId);
}

export function declarePlayerMeld(state: GameState, player: PlayerId, meldId: string): GameState {
  if (state.status !== 'playing' || state.turn !== player) {
    return state;
  }

  const hand = player === 'human' ? state.humanHand : state.cpuHand;
  const meld = findMelds(hand, player, state.declaredMeldIds, state.briscola !== null).find(
    (item) => item.id === meldId,
  );

  return meld ? declareMelds(state, player, [meld]) : state;
}

export function resolveCurrentTrick(state: GameState): GameState {
  if (state.status !== 'resolving' || state.table.length !== 2) {
    return state;
  }

  const [first, second] = state.table;
  const winner = winsAgainst(second.card, first.card, state.briscola) ? second.player : first.player;
  const trickPoints = first.card.points + second.card.points;
  const taken = [...state.takenCards[winner], first.card, second.card];
  const nextScores = { ...state.scores, [winner]: state.scores[winner] + trickPoints };
  let next: GameState = {
    ...state,
    table: [],
    leader: winner,
    turn: winner,
    scores: nextScores,
    takenCards: { ...state.takenCards, [winner]: taken },
    status: 'playing',
    log: [`${label(winner)} prende ${trickPoints} punti.`, ...state.log].slice(0, 9),
  };

  next = drawAfterTrick(next, winner);
  next = maybeFinish(next);
  return next;
}

export function availableMeldPreview(hand: Card[], briscola: Suit | null, declared: Set<string>): Meld[] {
  return findMelds(hand, 'human', declared, briscola !== null).map((meld, index) => ({
    ...meld,
    points: briscola === null && index === 0 && meld.points < 250 ? 40 : meld.points,
    name: briscola === null && index === 0 && meld.points < 250 ? `${meld.name} - prima briscola` : meld.name,
  }));
}

function playCard(state: GameState, player: PlayerId, card: Card): GameState {
  const handKey = player === 'human' ? 'humanHand' : 'cpuHand';
  const table = [...state.table, { player, card }];
  return {
    ...state,
    [handKey]: state[handKey].filter((item) => item.id !== card.id),
    table,
    turn: table.length === 2 ? state.turn : player === 'human' ? 'cpu' : 'human',
    status: table.length === 2 ? 'resolving' : 'playing',
    log: [`${label(player)} gioca ${cardName(card)}.`, ...state.log].slice(0, 9),
  };
}

function drawAfterTrick(state: GameState, winner: PlayerId): GameState {
  if (state.deck.length === 0) {
    return state;
  }

  const deck = [...state.deck];
  const loser = winner === 'human' ? 'cpu' : 'human';
  const hands = {
    human: [...state.humanHand],
    cpu: [...state.cpuHand],
  };

  const winnerDraw = deck.shift();
  if (winnerDraw) {
    hands[winner].push(winnerDraw);
  }

  const loserDraw = deck.shift();
  if (loserDraw) {
    hands[loser].push(loserDraw);
  }

  return { ...state, deck, humanHand: hands.human, cpuHand: hands.cpu };
}

function declareAvailableMelds(state: GameState, player: PlayerId): GameState {
  const hand = player === 'human' ? state.humanHand : state.cpuHand;
  const melds = findMelds(hand, player, state.declaredMeldIds, state.briscola !== null);
  if (melds.length === 0) {
    return state;
  }

  return declareMelds(state, player, melds);
}

function declareMelds(state: GameState, player: PlayerId, melds: Array<Meld & { cardsSuit?: Suit }>): GameState {
  let briscola = state.briscola;
  let hasBriscola = briscola !== null;
  const declaredMelds = melds.map((meld) => {
    if (meld.points >= 250) {
      return meld;
    }

    if (!hasBriscola && meld.cardsSuit) {
      briscola = meld.cardsSuit;
      hasBriscola = true;
      return { ...meld, name: `${meld.name} - briscola a ${meld.cardsSuit}`, points: 40 };
    }

    return { ...meld, points: 20 };
  });
  const points = declaredMelds.reduce((sum, meld) => sum + meld.points, 0);
  const declaredMeldIds = new Set(state.declaredMeldIds);
  declaredMelds.forEach((meld) => declaredMeldIds.add(meld.id));

  const immediateWin = declaredMelds.find((meld) => meld.points >= 500);
  const announcement = {
    player,
    title: `${label(player)} canta!`,
    detail: declaredMelds.map((meld) => meld.name).join(', '),
    points,
  };
  const next: GameState = {
    ...state,
    briscola,
    scores: { ...state.scores, [player]: state.scores[player] + points },
    declaredMeldIds,
    melds: [...declaredMelds, ...state.melds],
    announcement,
    log: [
      `${label(player)} canta ${declaredMelds.map((meld) => meld.name).join(', ')} (+${points}).`,
      ...state.log,
    ].slice(0, 9),
  };

  if (immediateWin) {
    return finishMatch({
      ...next,
      matchScores: {
        human: next.matchScores.human + next.scores.human,
        cpu: next.matchScores.cpu + next.scores.cpu,
      },
    });
  }

  return next;
}

function findMelds(
  hand: Card[],
  player: PlayerId,
  declared: Set<string>,
  hasBriscola: boolean,
): Array<Meld & { cardsSuit?: Suit }> {
  const melds: Array<Meld & { cardsSuit?: Suit }> = [];
  const kings = hand.filter((card) => card.rank === 'Re');
  const horses = hand.filter((card) => card.rank === 'Cavallo');

  if (kings.length === 4 && horses.length >= 1) {
    const ids = [...kings, horses[0]].map((card) => card.id).sort().join('|');
    const id = `mariannone:${player}:${ids}`;
    if (!declared.has(id)) {
      melds.push({ id, player, name: 'Mariannone', cards: '4 Re + 1 Cavallo', points: 500 });
    }
    return melds;
  }

  if (horses.length === 4 && kings.length >= 1) {
    const ids = [...horses, kings[0]].map((card) => card.id).sort().join('|');
    const id = `mariannino:${player}:${ids}`;
    if (!declared.has(id)) {
      melds.push({ id, player, name: 'Mariannino', cards: '4 Cavalli + 1 Re', points: 250 });
    }
    return melds;
  }

  for (const suit of suits) {
    const hasKing = hand.some((card) => card.suit === suit && card.rank === 'Re');
    const hasHorse = hand.some((card) => card.suit === suit && card.rank === 'Cavallo');
    const id = `marianna:${player}:${suit}`;
    if (hasKing && hasHorse && !declared.has(id)) {
      melds.push({
        id,
        player,
        name: `Cantata di ${suit}`,
        cards: `Re e Cavallo di ${suit}`,
        cardsSuit: suit,
        points: hasBriscola ? 20 : 40,
      });
    }
  }

  return melds;
}

function maybeFinish(state: GameState): GameState {
  const cardsLeft = state.deck.length + state.humanHand.length + state.cpuHand.length + state.table.length;
  if (cardsLeft > 0) {
    return state;
  }

  const matchScores = {
    human: state.matchScores.human + state.scores.human,
    cpu: state.matchScores.cpu + state.scores.cpu,
  };
  const reachedTarget = matchScores.human >= 500 || matchScores.cpu >= 500;

  if (reachedTarget) {
    return finishMatch({ ...state, matchScores });
  }

  return {
    ...state,
    matchScores,
    status: 'handFinished',
    log: [`Smazzata conclusa: Tu ${state.scores.human}, CPU ${state.scores.cpu}.`, ...state.log].slice(0, 9),
  };
}

function finishMatch(state: GameState): GameState {
  const winner = state.matchScores.human === state.matchScores.cpu
    ? 'draw'
    : state.matchScores.human > state.matchScores.cpu
      ? 'human'
      : 'cpu';
  return {
    ...state,
    status: 'finished',
    winner,
    log: [`Partita a 500 conclusa: Tu ${state.matchScores.human}, CPU ${state.matchScores.cpu}.`, ...state.log].slice(0, 9),
  };
}

function chooseCpuCard(state: GameState): Card {
  const hand = state.cpuHand;
  if (state.table.length === 0) {
    return [...hand].sort((a, b) => cpuCardCost(a, state.briscola, hand, state.declaredMeldIds) - cpuCardCost(b, state.briscola, hand, state.declaredMeldIds))[0];
  }

  const leading = state.table[0].card;
  const winningCards = hand.filter((card) => winsAgainst(card, leading, state.briscola));
  if (winningCards.length > 0) {
    return winningCards.sort((a, b) => cpuCardCost(a, state.briscola, hand, state.declaredMeldIds) - cpuCardCost(b, state.briscola, hand, state.declaredMeldIds))[0];
  }

  return [...hand].sort((a, b) => cpuCardCost(a, state.briscola, hand, state.declaredMeldIds) - cpuCardCost(b, state.briscola, hand, state.declaredMeldIds))[0];
}

function cpuCardCost(card: Card, briscola: Suit | null, hand: Card[], declared: Set<string>): number {
  return card.points + (card.suit === briscola ? 20 : 0) + cantataPotentialCost(card, hand, declared) + card.power / 10;
}

function cantataPotentialCost(card: Card, hand: Card[], declared: Set<string>): number {
  if (card.rank !== 'Re' && card.rank !== 'Cavallo') {
    return 0;
  }

  const meldId = `marianna:cpu:${card.suit}`;
  if (declared.has(meldId)) {
    return 0;
  }

  const pairedRank: Rank = card.rank === 'Re' ? 'Cavallo' : 'Re';
  const hasPair = hand.some((item) => item.suit === card.suit && item.rank === pairedRank);
  return hasPair ? 45 : 10;
}

function winsAgainst(challenger: Card, current: Card, briscola: Suit | null): boolean {
  if (challenger.suit === current.suit) {
    return challenger.power > current.power;
  }

  return briscola !== null && challenger.suit === briscola && current.suit !== briscola;
}

function createDeck(): Card[] {
  return suits.flatMap((suit) =>
    ranks.map((rank) => ({
      id: `${rank}-${suit}`,
      suit,
      rank,
      points: rankPoints[rank],
      power: rankPower[rank],
    })),
  );
}

function shuffle<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

export function cardName(card: Card): string {
  return `${card.rank} di ${card.suit}`;
}

export function cardShortRank(card: Card): string {
  const labels: Record<Rank, string> = {
    Asso: 'A',
    Tre: '3',
    Re: 'R',
    Cavallo: 'C',
    Fante: 'F',
    Sette: '7',
    Sei: '6',
    Cinque: '5',
    Quattro: '4',
    Due: '2',
  };
  return labels[card.rank];
}

export function suitSymbol(suit: Suit): string {
  return { Denari: '◆', Coppe: '♥', Spade: '♠', Bastoni: '♣' }[suit];
}

export function label(player: PlayerId): string {
  return player === 'human' ? 'Tu' : 'CPU';
}
