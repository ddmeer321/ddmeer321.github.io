// Was der Fisch in welchem Spiel sagt -- und woran er merkt, dass es
// vorangeht.
//
// BEWUSST GETRENNT VON fisch.js: Texte aendert man oft, Verhalten selten.
// Wer hier eine Zeile umschreibt, soll nicht in der Logik landen.
//
// EIN EINTRAG BESTEHT AUS:
//   name         Wie die Figur heisst (steht in der Vorlesehilfe des Knopfes).
//   start        Was beim allerersten Mal erklaert wird, eine Zeile pro Blase.
//                Kurz halten: drei Blasen sind ein Tutorial, sechs sind eine
//                Bedienungsanleitung, und die liest niemand.
//   tipps        Werden der Reihe nach gezeigt, wenn man den Fisch anklickt.
//   steckt       Was er sagt, wenn er von selbst auftaucht. Fehlt es, nimmt
//                er den ersten Tipp.
//   fortschritt  Funktion, die eine Zahl liefert, die beim Spielen WAECHST.
//                Ohne sie gibt es kein Erkennen von Feststecken -- und dann
//                meldet er sich auch nie von selbst. Lieber weglassen als
//                etwas erfinden, das nicht wirklich Fortschritt bedeutet.

window.FischTexte = {

  /* --------------------------------------------------------------- Snake --
     Fortschritt ist der Rekord, nicht der laufende Punktestand: der faellt
     bei jedem Tod auf null zurueck, und ein Fisch, der daraus "du kommst
     nicht weiter" liest, meldet sich nach jeder Runde. */
  snake: {
    name: "Der Fisch",
    start: [
      "Hallo! Ich bin der Fisch. Ich erkläre dir kurz, worum es hier geht.",
      "Du steuerst die Schlange mit den Pfeiltasten — am Handy einfach in die Richtung wischen.",
      "Jedes Futter macht dich länger. Wände und dich selbst solltest du meiden.",
      "Für Punkte gibt es Münzen, und für Münzen gibt es Aussehen. Viel Spaß!"
    ],
    tipps: [
      "Plane eine Kurve, bevor du sie brauchst. Die meisten Tode passieren, weil man in der Ecke erst überlegt.",
      "Die Hindernisse geben mehr Münzen. Wenn dir langweilig wird, schalte sie im Menü dazu.",
      "Der Schwierigkeitsgrad ändert das Tempo, nicht die Punkte. Langsam ist keine Schande.",
      "Halte dich an den Rändern, solange die Schlange kurz ist. In der Mitte fängst du dich später selbst ein."
    ],
    steckt: [
      "Dein Rekord steht schon eine Weile. Versuch mal, am Rand zu kreisen statt quer durchs Feld — das hält länger."
    ],
    fortschritt: function () {
      var el = document.getElementById("highscore");
      return el ? Number(String(el.textContent).replace(/\D/g, "")) || 0 : 0;
    }
  },

  /* ------------------------------------------------------- Cursor Clicker --
     Klicks sind KEIN Fortschritt: man kann eine Stunde klicken und nichts
     erreichen. Geoeffnete Kisten sind einer -- und genau deshalb ist "viel
     geklickt, keine Kiste" der Moment, in dem ein Hinweis wirklich hilft.

     getSnapshot() gibt es dort schon; im Kopf von cursor-clicker/js/main.js
     steht sogar, dass die Schnittstelle fuer genau solche Systeme gedacht
     war. Hier wird sie zum ersten Mal benutzt. */
  "cursor-clicker": {
    name: "Der Fisch",
    start: [
      "Moin! Ich bin der Fisch und bleibe danach da unten in der Ecke.",
      "Klick auf den großen Cursor. Jeder Klick bringt Münzen.",
      "Von den Münzen kaufst du Kisten, und in den Kisten stecken neue Cursor — manche davon sehr selten.",
      "Ein besserer Cursor bringt mehr pro Klick. Von da an läuft es von allein."
    ],
    tipps: [
      "Rüste deinen besten Cursor wirklich aus. Ihn nur zu besitzen bringt nichts.",
      "Doppelte Cursor sind kein Pech — die brauchst du zum Fusionieren.",
      "Die tägliche Belohnung wächst mit der Serie. Einmal am Tag kurz vorbeischauen lohnt sich mehr, als es aussieht.",
      "Auren wirken zusätzlich zum Cursor. Eine gute Aura ist oft mehr wert als der nächste Cursor."
    ],
    steckt: [
      "Du klickst fleißig, aber hast noch keine Kiste geöffnet. Genau dafür sind die Münzen da — der Sprung kommt erst danach."
    ],
    fortschritt: function () {
      var api = window.CursorClicker;
      if (!api || typeof api.getSnapshot !== "function") return 0;
      var s = api.getSnapshot();
      return (s && s.boxesOpened) || 0;
    }
  },

  /* -------------------------------------------------------- Tic-Tac-Toe --
     Kein fortschritt: eine Partie dauert eine Minute und danach faengt man
     neu an. Es gibt schlicht keine Zahl, die waechst. Also erklaert er
     einmal, sitzt danach in der Ecke und meldet sich nie von selbst. */
  "tic-tac-toe": {
    name: "Der Fisch",
    start: [
      "Hi! Drei in einer Reihe — waagerecht, senkrecht oder schräg.",
      "Links stellst du ein, wie stark der Bot spielen soll. Oder du holst dir jemanden ans selbe Gerät.",
      "Die höchste Stufe verliert nie. Wirklich nie. Ein Unentschieden ist dort schon ein Sieg."
    ],
    tipps: [
      "Die Mitte ist das stärkste Feld. Wenn du anfangen darfst, nimm sie.",
      "Bevor du deinen eigenen Angriff baust: schau, ob der Gegner gerade zwei in einer Reihe hat.",
      "Gegen die höchste Stufe geht es nicht ums Gewinnen, sondern ums Nicht-Verlieren.",
      "Zwei Bedrohungen gleichzeitig aufzubauen ist der einzige Weg, einen guten Gegner zu schlagen."
    ]
  },

  /* ----------------------------------------------------------- Spielwiese --
     Nur fuer fisch/index.html. Dort steht kein echtes Spiel dahinter,
     sondern ein Knopf, mit dem man den Fortschritt von Hand hochzaehlt --
     damit alle drei Zustaende vorfuehrbar sind, ohne erst zu spielen. */
  demo: {
    name: "Der Fisch",
    start: [
      "Hallo! Genau so melde ich mich beim ersten Mal in einem Spiel.",
      "Ich erkläre in ein paar kurzen Blasen, worum es geht — nie mehr als vier.",
      "Danach setze ich mich in die Ecke und bin still. Anklicken kannst du mich jederzeit."
    ],
    tipps: [
      "Angeklickt gebe ich einen Tipp. Beim nächsten Mal den nächsten, der Reihe nach.",
      "Ich fange nie von vorne an, solange es noch ungesagte Tipps gibt.",
      "Und wenn dich das hier nervt: „Nicht mehr zeigen“ meine ich ernst — dauerhaft.",
      "Das war der letzte Tipp. Jetzt geht es wieder von vorne los."
    ],
    steckt: [
      "Du bist seit einer Weile am selben Punkt. Soll ich dir zeigen, wie es weitergeht?"
    ],
    fortschritt: function () {
      var el = document.getElementById("demo-stand");
      return el ? Number(el.textContent) || 0 : 0;
    }
  }
};
