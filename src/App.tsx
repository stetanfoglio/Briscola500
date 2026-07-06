import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  availableMeldPreview,
  cardShortRank,
  createNewGame,
  declareHumanMeld,
  label,
  playCpuTurn,
  playHumanCard,
  resolveCurrentTrick,
  startNextHand,
  suitSymbol,
  type Card,
  type GameState,
  type PlayerId,
} from './game';

type OnlineState = {
  code: string;
  role: PlayerId;
  waiting: boolean;
  message?: string;
};

export function App() {
  const [game, setGame] = useState<GameState>(() => createNewGame());
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [mode, setMode] = useState<'local' | 'online'>('local');
  const [online, setOnline] = useState<OnlineState | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 900 || window.screen.width < 900);
  const socketRef = useRef<Socket | null>(null);
  const humanMelds = availableMeldPreview(game.humanHand, game.briscola, game.declaredMeldIds);

  useEffect(() => {
    function updateViewport() {
      setIsMobile(window.innerWidth < 900 || window.screen.width < 900);
    }

    updateViewport();
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);
    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  useEffect(() => {
    if (mode !== 'local' || game.status !== 'playing' || game.turn !== 'cpu') {
      return;
    }

    const timer = window.setTimeout(() => {
      setGame((current) => playCpuTurn(current));
    }, 950);

    return () => window.clearTimeout(timer);
  }, [game.status, game.turn, game.table.length, mode]);

  useEffect(() => {
    if (mode !== 'local' || game.status !== 'resolving') {
      return;
    }

    const timer = window.setTimeout(() => {
      setGame((current) => resolveCurrentTrick(current));
    }, 1400);

    return () => window.clearTimeout(timer);
  }, [game.status, game.table.length, mode]);

  useEffect(() => {
    if (!game.announcement) {
      setShowAnnouncement(false);
      return;
    }

    setShowAnnouncement(true);
    const timer = window.setTimeout(() => setShowAnnouncement(false), 3200);
    return () => window.clearTimeout(timer);
  }, [game.announcement]);

  function play(card: Card) {
    if (mode === 'online' && online) {
      socketRef.current?.emit('playCard', { code: online.code, role: online.role, cardId: card.id });
      return;
    }

    setGame((current) => playHumanCard(current, card.id));
  }

  function sing(meldId: string) {
    if (mode === 'online' && online) {
      socketRef.current?.emit('declareMeld', { code: online.code, role: online.role, meldId });
      return;
    }

    setGame((current) => declareHumanMeld(current, meldId));
  }

  function restart() {
    socketRef.current?.disconnect();
    socketRef.current = null;
    setMode('local');
    setOnline(null);
    setGame(createNewGame());
  }

  function nextHand() {
    if (mode === 'online' && online) {
      socketRef.current?.emit('nextHand', { code: online.code, role: online.role });
      return;
    }

    setGame((current) => startNextHand(current));
  }

  function connectSocket() {
    if (socketRef.current) {
      return socketRef.current;
    }

    const socket = io(import.meta.env.DEV ? `http://${window.location.hostname}:3000` : undefined);
    socket.on('gameState', (payload: OnlineState & { game: GameState }) => {
      setMode('online');
      setOnline({ code: payload.code, role: payload.role, waiting: payload.waiting, message: payload.message });
      setGame(payload.game);
    });
    socketRef.current = socket;
    return socket;
  }

  function createOnlineRoom() {
    const socket = connectSocket();
    socket.emit('createRoom', {}, (response: { ok: boolean; code: string; role: PlayerId; error?: string }) => {
      if (!response.ok) return;
      setMode('online');
      setOnline({ code: response.code, role: response.role, waiting: true });
    });
  }

  function joinOnlineRoom() {
    const socket = connectSocket();
    socket.emit('joinRoom', { code: roomInput }, (response: { ok: boolean; code?: string; role?: PlayerId; error?: string }) => {
      if (!response.ok || !response.code || !response.role) {
        setOnline({ code: roomInput.toUpperCase(), role: 'human', waiting: false, message: response.error });
        return;
      }
      setMode('online');
      setOnline({ code: response.code, role: response.role, waiting: false });
    });
  }

  return (
    <main className={`app-shell ${isMobile ? 'is-mobile' : ''}`}>
      <section className="hero">
        <div>
          <p className="eyebrow">{mode === 'online' ? 'Partita online' : 'Gioco locale contro CPU'}</p>
          <h1>Briscola 500</h1>
          <p>
            Si gioca a smazzate fino a 500 punti. La prima cantata imposta il seme e vale 40,
            le successive valgono 20.
          </p>
        </div>
        <div className="hero-actions">
          <button className="secondary-button" onClick={restart}>Nuova partita</button>
        </div>
      </section>

      <section className="online-panel">
        {online ? (
          <>
            <span>Codice stanza</span>
            <strong>{online.code}</strong>
            <small>{online.waiting ? 'In attesa del secondo giocatore...' : 'Due giocatori collegati'}</small>
            {online.message ? <small>{online.message}</small> : null}
          </>
        ) : (
          <>
            <button className="secondary-button" onClick={createOnlineRoom}>Crea partita online</button>
            <div className="join-room">
              <input value={roomInput} onChange={(event) => setRoomInput(event.target.value.toUpperCase())} placeholder="Codice" />
              <button onClick={joinOnlineRoom}>Entra</button>
            </div>
          </>
        )}
      </section>

      {showAnnouncement && game.announcement && (game.status === 'playing' || game.status === 'resolving') ? (
        <AnnouncementBanner game={game} mode={mode} />
      ) : null}

      <section className="scoreboard" aria-label="Punteggio">
        <ScoreCard
          name="Tu"
          score={game.scores.human}
          total={game.matchScores.human}
          cards={game.takenCards.human.length}
        />
        <div className="trump-card">
          <span>Smazzata {game.handNumber}</span>
          <span>Briscola</span>
          <strong>{game.briscola ?? 'Non cantata'}</strong>
          <small>{game.briscola ? `Seme deciso dalla prima cantata` : 'Si decide alla prima cantata'}</small>
        </div>
        <ScoreCard
          name={mode === 'online' ? 'Avversario' : 'CPU'}
          score={game.scores.cpu}
          total={game.matchScores.cpu}
          cards={game.takenCards.cpu.length}
        />
      </section>

      {game.status === 'handFinished' ? (
        <section className="hand-finished">
          <div>
            <span className="zone-label">Smazzata conclusa</span>
            <strong>Totale: Tu {game.matchScores.human} · CPU {game.matchScores.cpu}</strong>
          </div>
          <button className="secondary-button" onClick={nextHand}>Prossima smazzata</button>
        </section>
      ) : null}

      <section className="table-panel">
        <div className="opponent-row">
          <div>
            <span className="zone-label">{mode === 'online' ? 'Avversario' : 'CPU'}</span>
            <div className="cpu-hand" aria-label={`${game.cpuHand.length} carte CPU`}>
              {game.cpuHand.map((card) => <div className="card back" key={card.id}><span>Briscola</span><strong>500</strong></div>)}
            </div>
          </div>
        </div>

        <div className={`table-center ${game.status === 'resolving' ? 'is-resolving' : ''}`}>
          <div className="deck-pile" aria-label={`${game.deck.length} carte nel mazzo`}>
            <div className="deck-card-back">500</div>
            <span>Mazzo</span>
            <strong>{game.deck.length}</strong>
            <small>carte</small>
          </div>
          {game.table.length === 0 ? (
            <div className="empty-table">{tableMessage(game, mode)}</div>
          ) : (
            game.table.map((played) => <PlayedCardView key={`${played.player}-${played.card.id}`} played={played} mode={mode} />)
          )}
        </div>

        <div className="hand-panel">
          <div className="hand-heading">
            <span className="zone-label">La tua mano</span>
            <span>{statusText(game, mode)}</span>
          </div>
          <div className="hand">
            {game.humanHand.map((card) => (
              <button
                className={`card playable suit-${card.suit.toLowerCase()}`}
                disabled={game.turn !== 'human' || game.status !== 'playing' || Boolean(online?.waiting)}
                key={card.id}
                onClick={() => play(card)}
              >
                <CardFace card={card} />
              </button>
            ))}
          </div>
        </div>
      </section>

      <aside className="side-grid">
        <section className="info-card">
          <h2>Cantate disponibili</h2>
          {humanMelds.length === 0 ? (
            <p>Nessuna cantata disponibile nella mano.</p>
          ) : (
            <div className="meld-actions">
              {humanMelds.map((meld) => (
                <button
                  className="meld-button"
                  disabled={game.turn !== 'human' || game.status !== 'playing' || Boolean(online?.waiting)}
                  key={meld.id}
                  onClick={() => sing(meld.id)}
                >
                  <span>{meld.name}</span>
                  <strong>+{meld.points}</strong>
                  <small>{meld.cards}</small>
                </button>
              ))}
            </div>
          )}
          <p className="hint">Se hai Re e Cavallo dello stesso seme puoi scegliere tu quando cantare.</p>
        </section>

        <section className="info-card">
          <h2>Cantate dichiarate</h2>
          {game.melds.length === 0 ? (
            <p>Nessuna cantata dichiarata.</p>
          ) : (
            <ul>
              {game.melds.slice(0, 6).map((meld) => (
                <li key={meld.id}>{displayLabel(meld.player, mode)}: {meld.name} (+{meld.points})</li>
              ))}
            </ul>
          )}
        </section>
      </aside>
    </main>
  );
}

function AnnouncementBanner({ game, mode }: { game: GameState; mode: 'local' | 'online' }) {
  const announcement = game.announcement!;
  return (
    <section className="announcement-banner" aria-live="polite">
      <span>{displayLabel(announcement.player, mode)} canta!</span>
      <strong>{announcement.detail}</strong>
      <small>+{announcement.points} punti · Briscola: {game.briscola ?? 'non ancora decisa'}</small>
    </section>
  );
}

function ScoreCard({ name, score, total, cards }: { name: string; score: number; total: number; cards: number }) {
  return (
    <div className="score-card">
      <span>{name}</span>
      <strong>{total}</strong>
      <small>totale verso 500</small>
      <div className="hand-score">
        <span>Smazzata</span>
        <b>{score}</b>
      </div>
      <small>{cards} carte prese</small>
    </div>
  );
}

function PlayedCardView({ played, mode }: { played: { player: PlayerId; card: Card }; mode: 'local' | 'online' }) {
  return (
    <div className="played-stack">
      <span>{displayLabel(played.player, mode)}</span>
      <div className={`card table-card suit-${played.card.suit.toLowerCase()}`}>
        <CardFace card={played.card} />
      </div>
    </div>
  );
}

function CardFace({ card }: { card: Card }) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSrc = `/cards/siciliane/${card.rank.toLowerCase()}-${card.suit.toLowerCase()}.jpg`;

  if (!imageFailed) {
    return <img className="real-card-image" src={imageSrc} alt={`${card.rank} di ${card.suit}`} onError={() => setImageFailed(true)} />;
  }

  return (
    <>
      <span className="card-corner">{cardShortRank(card)}</span>
      <span className="card-art" aria-hidden="true">
        <span className="card-symbol">{suitSymbol(card.suit)}</span>
        <span className={`card-illustration rank-${card.rank.toLowerCase()}`}>{illustration(card)}</span>
      </span>
      <strong>{card.rank}</strong>
      <small>{card.suit} · {card.points} pt</small>
    </>
  );
}

function illustration(card: Card): string {
  if (card.rank === 'Re') {
    return '♛';
  }

  if (card.rank === 'Cavallo') {
    return '♞';
  }

  if (card.rank === 'Fante') {
    return '⚔';
  }

  return suitSymbol(card.suit).repeat(Math.min(Number(cardShortRank(card)) || 1, 4));
}

function tableMessage(game: GameState, mode: 'local' | 'online'): string {
  if (game.status === 'finished') {
    return resultText(game);
  }

  if (game.status === 'handFinished') {
    return 'Smazzata conclusa';
  }

  if (game.turn === 'cpu') {
    return mode === 'online' ? 'Avversario sta giocando...' : 'La CPU sta pensando...';
  }

  return 'Tocca a te';
}

function statusText(game: GameState, mode: 'local' | 'online'): string {
  if (game.status === 'finished') {
    return resultText(game);
  }

  if (game.status === 'handFinished') {
    return 'Avvia la prossima smazzata';
  }

  if (game.status === 'resolving') {
    return 'Presa sul tavolo...';
  }

  return `Turno: ${displayLabel(game.turn, mode)}`;
}

function displayLabel(player: PlayerId, mode: 'local' | 'online'): string {
  if (player === 'human') {
    return 'Tu';
  }

  return mode === 'online' ? 'Avversario' : 'CPU';
}

function resultText(game: GameState): string {
  if (game.winner === 'draw') {
    return 'Pareggio';
  }

  return game.winner === 'human' ? 'Hai vinto' : 'Ha vinto la CPU';
}
