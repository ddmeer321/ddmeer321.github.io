# Neonpalast – Jukebox-Musik: Herkunft und Rechte

Alle Stücke der Jukebox sind **Eigenkompositionen für Neonpalast**. Es gibt keine Samples
und keine fremden Melodien. Die meisten Stücke sind als kleines Programm in
`js/audio/tracks.js` notiert (Akkorde, Basslinien, Rhythmus, Melodie) und werden zur Laufzeit
mit Web Audio synthetisiert (`js/audio/synth.js`) – ohne Netzwerk, auch offline.

**Studio-Aufnahmen (V1.5):** „Pullover-Nacht“ und „Countdown“ sind ebenfalls komplett
synthetisch und eigen, aber offline mit mehr Klangaufwand berechnet, als live im Browser
möglich wäre (Karplus-Strong-Gitarre, Supersaw-Flächen, Freeverb-Hall, Ping-Pong-Echo,
Sidechain). Die Skripte liegen in `tools/music/` und erzeugen die Stücke reproduzierbar
(fester Zufallsstartwert): `node tools/music/countdown.mjs countdown.wav`, danach MP3 mit
`ffmpeg -i countdown.wav -b:a 160k assets/music/countdown.mp3`. Die Aufnahmen brauchen Netz
(sie werden erst beim Abspielen gestreamt) und sind nicht offline verfügbar.

Akkordfolgen wie I–V–vi–IV oder ii–V–I sind musikalisches Allgemeingut und nicht
geschützt; die Melodien sind für dieses Projekt neu geschrieben.

| Stück | Stil | Tempo / Tonart | Art | Freischaltung |
|---|---|---|---|---|
| Mitternachtsfahrt | Synthwave | 100 BPM, a-Moll | Starter | mit der Jukebox |
| Lounge um drei | Lounge · Lo-Fi | 82 BPM, D-Dur | Starter | mit der Jukebox |
| Pixel-Jackpot | Chiptune | 138 BPM, C-Dur | Kaufbar | 1.500 Credits |
| Neon-Nacht | House | 122 BPM, f-Moll | Kaufbar | 1.500 Credits |
| Bossa Royale | Bossa Nova | 128 BPM, C-Dur | Kaufbar | 1.500 Credits |
| Neonregen | Ambient | 70 BPM, C-Dur | Kaufbar | 1.500 Credits |
| Casino-Swing | Jazz-Swing | 148 BPM, B♭-Dur | Kaufbar | 1.500 Credits |
| Turbo-Bonus | Drum & Bass | 172 BPM, d-Moll | Kaufbar | 1.500 Credits |
| Sonnenuntergang 1986 | City-Pop · Funk | 108 BPM, a-Moll | Besonders | Level 10 |
| Palasthymne | Hymne | 92 BPM, C-Dur | Besonders | alle 12 Automaten gespielt |
| Pullover-Nacht *(Studio)* | Indie · Dream-Pop | 100 BPM, d-Moll | Kaufbar | 1.500 Credits |
| Countdown *(Studio)* | Electro · Cinematic | 140 BPM, e-Moll → fis-Moll | Besonders | 10 Erfolge |

## Preisregel

Alle kaufbaren Stücke kosten **exakt gleich viel**. Musikgeschmack ist subjektiv; ein Stück
darf nicht teurer sein, weil es angeblich „besser“ ist. Besondere Stücke sind bewusst
**nicht käuflich** und auch nicht „seltener = wertvoller“: Sie markieren nur Meilensteine
(Level 10, jeden Automaten einmal gespielt, 10 Erfolge). Es gibt nichts Verpassbares und keine
zeitlich begrenzten Stücke.

## Technik

* Abspieler: `js/audio/music.js` – Lookahead-Scheduler (150 ms), eigener Musik-Bus mit
  eigener Lautstärke, weiche Blende beim Wechseln, alle Knoten werden nach dem Stopp getrennt.
* In Spielen läuft Musik standardmäßig auf 30 % („leiser“), wahlweise normal oder aus.
  Die Lotto-Show senkt die Musik während der Ziehung auf 20 %.
* Autoplay-Regeln: Musik startet nie ohne vorherige Geste. Lief beim letzten Besuch Musik,
  setzt sie mit der ersten Berührung wieder ein.
* Versteckter Tab: Der AudioContext wird angehalten, der Scheduler holt nichts nach.
* Studio-Aufnahmen: `<audio>`-Element → `MediaElementSource` → derselbe Musik-Bus (gleiche
  Lautstärke und gleiches Ducking). Gestreamt statt dekodiert (ein dekodiertes 2-Minuten-Stück
  bräuchte ≈ 45 MB Speicher). Versteckter Tab pausiert das Element; „Pause“ setzt am selben
  Takt fort. Der Testbereich nutzt die Dateien der Live-Fassung (`/arcade-casino/assets/music/`).
* Instrumente: subtraktive Synthese (Sägezahn/Puls + Filter), FM-Synthese (E-Piano, Vibraphon,
  Glocken), Karplus-Strong (gezupfte Nylongitarre), Rauschen (Schlagzeug, Regen, Plattenknistern),
  Faltungshall aus generiertem Impuls, Echo mit Filter, „Sidechain“-Pumpen bei House.
* Test: `tests/jukebox.test.mjs` spielt jedes live erzeugte Stück mit einer AudioContext-Attrappe einmal
  komplett inklusive Schleife durch.
