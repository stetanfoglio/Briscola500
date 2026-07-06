# Briscola500
Web app per giocare a briscola 500

## Avvio

```bash
npm install
npm run dev
```

## Avvio online in locale

Avvia frontend e server insieme:

```bash
npm run dev:online
```

Poi apri `http://localhost:5173/` su due browser o due dispositivi nella stessa rete.

- Primo giocatore: `Crea partita online`.
- Secondo giocatore: inserisce il codice stanza e preme `Entra`.

Per provare dal telefono sulla stessa rete Wi-Fi, usa l'indirizzo IP del PC al posto di `localhost`.

## Funzionalita implementate

- Partita locale 1 contro 1 contro CPU.
- Partita a 500 punti su piu smazzate: a fine smazzata i punti vengono sommati al totale e si continua finche qualcuno raggiunge o supera 500.
- Se entrambi superano 500 nella stessa smazzata, vince chi ha il totale piu alto.
- Mazzo italiano da 40 carte con semi Denari, Coppe, Spade e Bastoni.
- Variante a 5 carte per giocatore.
- Nessuna briscola iniziale: il primo giocatore che canta Re + Cavallo dello stesso seme stabilisce la briscola.
- Prese e punteggio tradizionale della Briscola: Asso 11, Tre 10, Re 4, Cavallo 3, Fante 2.
- Cantata manuale per il giocatore: quando hai Re + Cavallo dello stesso seme puoi decidere se e quando cantare.
- La CPU canta automaticamente nel proprio turno.
- La prima cantata vale 40 punti, le successive valgono 20 punti e non cambiano la briscola.
- Mariannino: 4 Cavalli + 1 Re, 250 punti.
- Mariannone: 4 Re + 1 Cavallo, 500 punti e vittoria immediata.
- Ritmo di gioco rallentato: la CPU gioca con una pausa e la presa resta visibile prima di essere raccolta.
- Banner evidente quando un giocatore canta.
- Supporto per immagini reali delle carte siciliane in `public/cards/siciliane/`.
- Modalita online a due giocatori reali con stanze Socket.IO.

## Carte siciliane reali

La web-app prova prima a caricare immagini `.jpg` da `public/cards/siciliane/`. Se non trova il file, usa la carta disegnata in CSS come fallback.

Nomi file richiesti:

```text
asso-denari.jpg
tre-denari.jpg
re-denari.jpg
cavallo-denari.jpg
fante-denari.jpg
sette-denari.jpg
sei-denari.jpg
cinque-denari.jpg
quattro-denari.jpg
due-denari.jpg
```

Ripeti lo stesso schema per `coppe`, `spade` e `bastoni`.

## Build

```bash
npm run build
```

## Server produzione

Dopo la build, il server serve sia API realtime che frontend:

```bash
npm run build
npm start
```
