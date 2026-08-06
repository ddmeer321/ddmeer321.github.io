const LANGUAGE_KEY = "neon-bot-arena-language";
const BACKGROUND_KEY = "neon-bot-arena-background";
const BACKGROUND_PRESET_KEY = "neon-bot-arena-background-preset";
const MAX_BACKGROUND_SIZE = 1_500_000;
const BACKGROUND_PRESETS = new Set(["neon", "space", "sunset", "ice"]);
const SUPPORTED_LANGUAGES = new Set(["de", "en", "fr", "es", "it", "pl", "nl", "zh-CN"]);

let activeBackground = "neon";
let customArenaImage = null;
let currentLanguage = "de";

const translations = {
  de: {
    "settings.open": "Einstellungen",
    "settings.title": "Einstellungen",
    "settings.close": "Schließen",
    "settings.background": "Hintergrundbild",
    "settings.presets": "Vorgefertigte Hintergründe",
    "settings.presetNeon": "Neon",
    "settings.presetSpace": "Weltraum",
    "settings.presetSunset": "Sonnenuntergang",
    "settings.presetIce": "Eiswelt",
    "settings.presetHint": "Die Auswahl verändert das Hauptmenü und die Arena.",
    "settings.choose": "Bild auswählen",
    "settings.remove": "Bild entfernen",
    "settings.backgroundHint": "JPG, PNG oder WebP · maximal 1,5 MB · bleibt nur auf diesem Gerät",
    "settings.backgroundSaved": "Hintergrundbild gespeichert.",
    "settings.backgroundRemoved": "Standard-Hintergrund aktiv.",
    "settings.backgroundTooLarge": "Das Bild ist größer als 1,5 MB.",
    "settings.backgroundInvalid": "Bitte wähle ein gültiges Bild.",
    "settings.language": "Sprache",
    "settings.deleteTitle": "Lokale Daten",
    "settings.delete": "Alles löschen",
    "settings.deleteHint": "Löscht Fortschritt, Coins, Einstellungen, Test-ID und lokale Rekorde auf diesem Gerät.",
    "settings.warning": "Achtung: Diese Aktion kann nicht rückgängig gemacht werden. Die Online-Rangliste wird nicht gelöscht.",
    "settings.cancel": "Abbrechen",
    "settings.confirm": "Ja, alles löschen",
    "menu.eyebrow": "Browser Kampfspiel",
    "menu.intro": "Wähle eine Figur, zerlege Roboterwellen und setze deine Spezialfähigkeit im richtigen Moment ein.",
    "menu.device": "Womit spielst du?",
    "menu.mobile": "Handy",
    "menu.difficulty": "Schwierigkeit",
    "menu.easy": "Einfach",
    "menu.easyHint": "weniger Gegner, kaum Münzen",
    "menu.normal": "Normal",
    "menu.normalHint": "normale Belohnung",
    "menu.hard": "Schwer",
    "menu.hardHint": "stärkere Gegner, mehr Münzen",
    "menu.playerName": "Spielername",
    "menu.namePlaceholder": "Dein Name",
    "menu.namePrivacyHint": "Bitte verwende nicht deinen echten Namen.",
    "menu.coins": "Münzen",
    "menu.leaderboard": "Rangliste",
    "menu.all": "Alle",
    "menu.twoPlayers": "2 Spieler",
    "menu.heroes": "Helden",
    "menu.shop": "Shop",
    "menu.start": "Spiel starten",
    "mode.change": "Modus wechseln",
    "mode.title": "Spielmodus wählen",
    "mode.close": "Modusmenü schließen",
    "mode.normalDescription": "Der klassische Kampf gegen immer stärkere Roboterwellen.",
    "mode.label": "Modus",
    "leaderboard.byMode": "Ranglisten nach Modus",
    "mode.chaos": "Chaos",
    "mode.chaosDescription": "Alle 60 Sekunden wechselt ein zufälliges Event die Spielregeln.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "Ein einziger Treffer beendet deinen Run.",
    "chaos.eventLabel": "Chaos-Event",
    "chaos.event.brokenMap": "Broken Map – schwarze Flächen sind tödlich",
    "chaos.event.blindness": "Blindheit – bleib wachsam",
    "chaos.event.meteor": "Meteor – weiche den Einschlägen aus",
    "chaos.event.enemyRush": "Feind-Raserei – Gegner bewegen sich viel schneller",
    "chaos.event.bulletStorm": "Kugelsturm – alle Gegner feuern schnelle Doppelschüsse",
    "chaos.event.mirror": "Spiegel – die Arena ist spiegelverkehrt",
    "chaos.event.respawn": "Respawn – Gegner kehren mit 25 % Leben zurück",
    "hud.hero": "Figur",
    "hud.wave": "Welle",
    "hud.score": "Punkte",
    "hud.difficulty": "Schwierigkeit",
    "hud.health": "Leben",
    "hud.special": "Spezial"
  },
  en: {
    "settings.open": "Settings",
    "settings.title": "Settings",
    "settings.close": "Close",
    "settings.background": "Background image",
    "settings.presets": "Preset backgrounds",
    "settings.presetNeon": "Neon",
    "settings.presetSpace": "Space",
    "settings.presetSunset": "Sunset",
    "settings.presetIce": "Ice world",
    "settings.presetHint": "Your choice changes both the main menu and the arena.",
    "settings.choose": "Choose image",
    "settings.remove": "Remove image",
    "settings.backgroundHint": "JPG, PNG or WebP · max. 1.5 MB · stored only on this device",
    "settings.backgroundSaved": "Background image saved.",
    "settings.backgroundRemoved": "Default background enabled.",
    "settings.backgroundTooLarge": "The image is larger than 1.5 MB.",
    "settings.backgroundInvalid": "Please choose a valid image.",
    "settings.language": "Language",
    "settings.deleteTitle": "Local data",
    "settings.delete": "Delete everything",
    "settings.deleteHint": "Deletes progress, coins, settings, test ID and local records on this device.",
    "settings.warning": "Warning: This cannot be undone. The online leaderboard will not be deleted.",
    "settings.cancel": "Cancel",
    "settings.confirm": "Yes, delete everything",
    "menu.eyebrow": "Browser combat game",
    "menu.intro": "Choose a fighter, destroy robot waves and use your special ability at the right moment.",
    "menu.device": "Which device do you use?",
    "menu.mobile": "Mobile",
    "menu.difficulty": "Difficulty",
    "menu.easy": "Easy",
    "menu.easyHint": "fewer enemies, very few coins",
    "menu.normal": "Normal",
    "menu.normalHint": "normal rewards",
    "menu.hard": "Hard",
    "menu.hardHint": "stronger enemies, more coins",
    "menu.playerName": "Player name",
    "menu.namePlaceholder": "Your name",
    "menu.namePrivacyHint": "Please use a nickname, not your real name.",
    "menu.coins": "Coins",
    "menu.leaderboard": "Leaderboard",
    "menu.all": "All",
    "menu.twoPlayers": "2 players",
    "menu.heroes": "Heroes",
    "menu.shop": "Shop",
    "menu.start": "Start game",
    "mode.change": "Change mode",
    "mode.title": "Choose game mode",
    "mode.close": "Close mode menu",
    "mode.normalDescription": "The classic fight against increasingly strong robot waves.",
    "mode.label": "Mode",
    "leaderboard.byMode": "Leaderboards by mode",
    "mode.chaos": "Chaos",
    "mode.chaosDescription": "A random event changes the rules every 60 seconds.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "A single hit ends your run.",
    "chaos.eventLabel": "Chaos event",
    "chaos.event.brokenMap": "Broken Map – black areas are lethal",
    "chaos.event.blindness": "Blindness – stay alert",
    "chaos.event.meteor": "Meteor – dodge the impacts",
    "chaos.event.enemyRush": "Enemy rush – enemies move much faster",
    "chaos.event.bulletStorm": "Bullet storm – all enemies fire rapid double shots",
    "chaos.event.mirror": "Mirror – the arena is reversed",
    "chaos.event.respawn": "Respawn – enemies return with 25% health",
    "hud.hero": "Hero",
    "hud.wave": "Wave",
    "hud.score": "Score",
    "hud.difficulty": "Difficulty",
    "hud.health": "Health",
    "hud.special": "Special"
  },
  fr: {
    "settings.open": "Paramètres",
    "settings.title": "Paramètres",
    "settings.close": "Fermer",
    "settings.background": "Image d’arrière-plan",
    "settings.presets": "Arrière-plans prédéfinis",
    "settings.presetNeon": "Néon",
    "settings.presetSpace": "Espace",
    "settings.presetSunset": "Coucher de soleil",
    "settings.presetIce": "Monde de glace",
    "settings.presetHint": "Ce choix modifie le menu principal et l’arène.",
    "settings.choose": "Choisir une image",
    "settings.remove": "Supprimer l’image",
    "settings.backgroundHint": "JPG, PNG ou WebP · 1,5 Mo max. · enregistré uniquement sur cet appareil",
    "settings.backgroundSaved": "Image d’arrière-plan enregistrée.",
    "settings.backgroundRemoved": "Arrière-plan standard activé.",
    "settings.backgroundTooLarge": "L’image dépasse 1,5 Mo.",
    "settings.backgroundInvalid": "Veuillez choisir une image valide.",
    "settings.language": "Langue",
    "settings.deleteTitle": "Données locales",
    "settings.delete": "Tout supprimer",
    "settings.deleteHint": "Supprime la progression, les pièces, les paramètres, l’ID de test et les records locaux de cet appareil.",
    "settings.warning": "Attention : cette action est irréversible. Le classement en ligne ne sera pas supprimé.",
    "settings.cancel": "Annuler",
    "settings.confirm": "Oui, tout supprimer",
    "menu.eyebrow": "Jeu de combat sur navigateur",
    "menu.intro": "Choisissez un combattant, détruisez des vagues de robots et utilisez votre capacité spéciale au bon moment.",
    "menu.device": "Sur quel appareil jouez-vous ?",
    "menu.mobile": "Mobile",
    "menu.difficulty": "Difficulté",
    "menu.easy": "Facile",
    "menu.easyHint": "moins d’ennemis, très peu de pièces",
    "menu.normal": "Normal",
    "menu.normalHint": "récompenses normales",
    "menu.hard": "Difficile",
    "menu.hardHint": "ennemis plus forts, plus de pièces",
    "menu.playerName": "Nom du joueur",
    "menu.namePlaceholder": "Votre nom",
    "menu.namePrivacyHint": "Utilisez un pseudonyme, pas votre vrai nom.",
    "menu.coins": "Pièces",
    "menu.leaderboard": "Classement",
    "menu.all": "Tous",
    "menu.twoPlayers": "2 joueurs",
    "menu.heroes": "Héros",
    "menu.shop": "Boutique",
    "menu.start": "Démarrer",
    "mode.change": "Changer de mode",
    "mode.title": "Choisir le mode de jeu",
    "mode.close": "Fermer le menu des modes",
    "mode.normalDescription": "Le combat classique contre des vagues de robots de plus en plus puissantes.",
    "mode.label": "Mode",
    "leaderboard.byMode": "Classements par mode",
    "mode.chaos": "Chaos",
    "mode.chaosDescription": "Un événement aléatoire change les règles toutes les 60 secondes.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "Un seul coup met fin à ta partie.",
    "chaos.eventLabel": "Événement chaos",
    "chaos.event.brokenMap": "Carte brisée – les zones noires sont mortelles",
    "chaos.event.blindness": "Cécité – reste vigilant",
    "chaos.event.meteor": "Météore – évite les impacts",
    "chaos.event.enemyRush": "Ruée ennemie – les ennemis se déplacent beaucoup plus vite",
    "chaos.event.bulletStorm": "Tempête de tirs – tous les ennemis tirent rapidement en double",
    "chaos.event.mirror": "Miroir – l’arène est inversée",
    "chaos.event.respawn": "Réapparition – ennemis à 25 % de vie",
    "hud.hero": "Héros",
    "hud.wave": "Vague",
    "hud.score": "Score",
    "hud.difficulty": "Difficulté",
    "hud.health": "Vie",
    "hud.special": "Spécial"
  },
  es: {
    "settings.open": "Ajustes",
    "settings.title": "Ajustes",
    "settings.close": "Cerrar",
    "settings.background": "Imagen de fondo",
    "settings.presets": "Fondos prediseñados",
    "settings.presetNeon": "Neón",
    "settings.presetSpace": "Espacio",
    "settings.presetSunset": "Atardecer",
    "settings.presetIce": "Mundo helado",
    "settings.presetHint": "La selección cambia el menú principal y la arena.",
    "settings.choose": "Elegir imagen",
    "settings.remove": "Quitar imagen",
    "settings.backgroundHint": "JPG, PNG o WebP · máx. 1,5 MB · solo se guarda en este dispositivo",
    "settings.backgroundSaved": "Imagen de fondo guardada.",
    "settings.backgroundRemoved": "Fondo estándar activado.",
    "settings.backgroundTooLarge": "La imagen supera 1,5 MB.",
    "settings.backgroundInvalid": "Elige una imagen válida.",
    "settings.language": "Idioma",
    "settings.deleteTitle": "Datos locales",
    "settings.delete": "Borrar todo",
    "settings.deleteHint": "Borra el progreso, las monedas, los ajustes, el ID de prueba y los récords locales de este dispositivo.",
    "settings.warning": "Atención: esta acción no se puede deshacer. La clasificación en línea no se borrará.",
    "settings.cancel": "Cancelar",
    "settings.confirm": "Sí, borrar todo",
    "menu.eyebrow": "Juego de combate para navegador",
    "menu.intro": "Elige un luchador, destruye oleadas de robots y usa tu habilidad especial en el momento adecuado.",
    "menu.device": "¿En qué dispositivo juegas?",
    "menu.mobile": "Móvil",
    "menu.difficulty": "Dificultad",
    "menu.easy": "Fácil",
    "menu.easyHint": "menos enemigos, muy pocas monedas",
    "menu.normal": "Normal",
    "menu.normalHint": "recompensas normales",
    "menu.hard": "Difícil",
    "menu.hardHint": "enemigos más fuertes, más monedas",
    "menu.playerName": "Nombre del jugador",
    "menu.namePlaceholder": "Tu nombre",
    "menu.namePrivacyHint": "Usa un apodo, no tu nombre real.",
    "menu.coins": "Monedas",
    "menu.leaderboard": "Clasificación",
    "menu.all": "Todos",
    "menu.twoPlayers": "2 jugadores",
    "menu.heroes": "Héroes",
    "menu.shop": "Tienda",
    "menu.start": "Iniciar partida",
    "mode.change": "Cambiar modo",
    "mode.title": "Elegir modo de juego",
    "mode.close": "Cerrar menú de modos",
    "mode.normalDescription": "La batalla clásica contra oleadas de robots cada vez más fuertes.",
    "mode.label": "Modo",
    "leaderboard.byMode": "Clasificaciones por modo",
    "mode.chaos": "Caos",
    "mode.chaosDescription": "Un evento aleatorio cambia las reglas cada 60 segundos.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "Un solo golpe termina tu partida.",
    "chaos.eventLabel": "Evento de caos",
    "chaos.event.brokenMap": "Mapa roto – las zonas negras son letales",
    "chaos.event.blindness": "Ceguera – mantente alerta",
    "chaos.event.meteor": "Meteorito – esquiva los impactos",
    "chaos.event.enemyRush": "Furia enemiga – los enemigos se mueven mucho más rápido",
    "chaos.event.bulletStorm": "Tormenta de balas – todos los enemigos disparan ráfagas dobles",
    "chaos.event.mirror": "Espejo – la arena está invertida",
    "chaos.event.respawn": "Reaparición – enemigos con 25 % de vida",
    "hud.hero": "Héroe",
    "hud.wave": "Oleada",
    "hud.score": "Puntos",
    "hud.difficulty": "Dificultad",
    "hud.health": "Vida",
    "hud.special": "Especial"
  },
  it: {
    "settings.open": "Impostazioni",
    "settings.title": "Impostazioni",
    "settings.close": "Chiudi",
    "settings.background": "Immagine di sfondo",
    "settings.presets": "Sfondi predefiniti",
    "settings.presetNeon": "Neon",
    "settings.presetSpace": "Spazio",
    "settings.presetSunset": "Tramonto",
    "settings.presetIce": "Mondo di ghiaccio",
    "settings.presetHint": "La scelta modifica il menu principale e l’arena.",
    "settings.choose": "Scegli immagine",
    "settings.remove": "Rimuovi immagine",
    "settings.backgroundHint": "JPG, PNG o WebP · max. 1,5 MB · salvato solo su questo dispositivo",
    "settings.backgroundSaved": "Immagine di sfondo salvata.",
    "settings.backgroundRemoved": "Sfondo standard attivato.",
    "settings.backgroundTooLarge": "L’immagine supera 1,5 MB.",
    "settings.backgroundInvalid": "Scegli un’immagine valida.",
    "settings.language": "Lingua",
    "settings.deleteTitle": "Dati locali",
    "settings.delete": "Elimina tutto",
    "settings.deleteHint": "Elimina progressi, monete, impostazioni, ID di test e record locali da questo dispositivo.",
    "settings.warning": "Attenzione: questa azione non può essere annullata. La classifica online non verrà eliminata.",
    "settings.cancel": "Annulla",
    "settings.confirm": "Sì, elimina tutto",
    "menu.eyebrow": "Gioco di combattimento per browser",
    "menu.intro": "Scegli un combattente, distruggi ondate di robot e usa l’abilità speciale al momento giusto.",
    "menu.device": "Su quale dispositivo giochi?",
    "menu.mobile": "Cellulare",
    "menu.difficulty": "Difficoltà",
    "menu.easy": "Facile",
    "menu.easyHint": "meno nemici, pochissime monete",
    "menu.normal": "Normale",
    "menu.normalHint": "ricompense normali",
    "menu.hard": "Difficile",
    "menu.hardHint": "nemici più forti, più monete",
    "menu.playerName": "Nome giocatore",
    "menu.namePlaceholder": "Il tuo nome",
    "menu.namePrivacyHint": "Usa un soprannome, non il tuo vero nome.",
    "menu.coins": "Monete",
    "menu.leaderboard": "Classifica",
    "menu.all": "Tutti",
    "menu.twoPlayers": "2 giocatori",
    "menu.heroes": "Eroi",
    "menu.shop": "Negozio",
    "menu.start": "Avvia partita",
    "mode.change": "Cambia modalità",
    "mode.title": "Scegli la modalità di gioco",
    "mode.close": "Chiudi il menu modalità",
    "mode.normalDescription": "La battaglia classica contro ondate di robot sempre più forti.",
    "mode.label": "Modalità",
    "leaderboard.byMode": "Classifiche per modalità",
    "mode.chaos": "Caos",
    "mode.chaosDescription": "Un evento casuale cambia le regole ogni 60 secondi.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "Un solo colpo termina la partita.",
    "chaos.eventLabel": "Evento caos",
    "chaos.event.brokenMap": "Mappa rotta – le zone nere sono letali",
    "chaos.event.blindness": "Cecità – resta vigile",
    "chaos.event.meteor": "Meteora – evita gli impatti",
    "chaos.event.enemyRush": "Furia nemica – i nemici si muovono molto più velocemente",
    "chaos.event.bulletStorm": "Tempesta di proiettili – tutti i nemici sparano colpi doppi rapidi",
    "chaos.event.mirror": "Specchio – l’arena è invertita",
    "chaos.event.respawn": "Respawn – nemici al 25% di vita",
    "hud.hero": "Eroe",
    "hud.wave": "Ondata",
    "hud.score": "Punti",
    "hud.difficulty": "Difficoltà",
    "hud.health": "Vita",
    "hud.special": "Speciale"
  },
  pl: {
    "settings.open": "Ustawienia",
    "settings.title": "Ustawienia",
    "settings.close": "Zamknij",
    "settings.background": "Obraz tła",
    "settings.presets": "Gotowe tła",
    "settings.presetNeon": "Neon",
    "settings.presetSpace": "Kosmos",
    "settings.presetSunset": "Zachód słońca",
    "settings.presetIce": "Lodowy świat",
    "settings.presetHint": "Wybór zmienia menu główne oraz arenę.",
    "settings.choose": "Wybierz obraz",
    "settings.remove": "Usuń obraz",
    "settings.backgroundHint": "JPG, PNG lub WebP · maks. 1,5 MB · zapis tylko na tym urządzeniu",
    "settings.backgroundSaved": "Zapisano obraz tła.",
    "settings.backgroundRemoved": "Włączono standardowe tło.",
    "settings.backgroundTooLarge": "Obraz jest większy niż 1,5 MB.",
    "settings.backgroundInvalid": "Wybierz prawidłowy obraz.",
    "settings.language": "Język",
    "settings.deleteTitle": "Dane lokalne",
    "settings.delete": "Usuń wszystko",
    "settings.deleteHint": "Usuwa postęp, monety, ustawienia, identyfikator testowy i lokalne rekordy z tego urządzenia.",
    "settings.warning": "Uwaga: tej operacji nie można cofnąć. Ranking online nie zostanie usunięty.",
    "settings.cancel": "Anuluj",
    "settings.confirm": "Tak, usuń wszystko",
    "menu.eyebrow": "Przeglądarkowa gra akcji",
    "menu.intro": "Wybierz wojownika, niszcz fale robotów i użyj zdolności specjalnej w odpowiednim momencie.",
    "menu.device": "Na czym grasz?",
    "menu.mobile": "Telefon",
    "menu.difficulty": "Poziom trudności",
    "menu.easy": "Łatwy",
    "menu.easyHint": "mniej wrogów, bardzo mało monet",
    "menu.normal": "Normalny",
    "menu.normalHint": "normalne nagrody",
    "menu.hard": "Trudny",
    "menu.hardHint": "silniejsi wrogowie, więcej monet",
    "menu.playerName": "Nazwa gracza",
    "menu.namePlaceholder": "Twoja nazwa",
    "menu.namePrivacyHint": "Użyj pseudonimu, a nie prawdziwego imienia.",
    "menu.coins": "Monety",
    "menu.leaderboard": "Ranking",
    "menu.all": "Wszyscy",
    "menu.twoPlayers": "2 graczy",
    "menu.heroes": "Bohaterowie",
    "menu.shop": "Sklep",
    "menu.start": "Rozpocznij grę",
    "mode.change": "Zmień tryb",
    "mode.title": "Wybierz tryb gry",
    "mode.close": "Zamknij menu trybów",
    "mode.normalDescription": "Klasyczna walka z coraz silniejszymi falami robotów.",
    "mode.label": "Tryb",
    "leaderboard.byMode": "Rankingi według trybu",
    "mode.chaos": "Chaos",
    "mode.chaosDescription": "Losowe wydarzenie zmienia zasady co 60 sekund.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "Jedno trafienie kończy rozgrywkę.",
    "chaos.eventLabel": "Wydarzenie chaosu",
    "chaos.event.brokenMap": "Zniszczona mapa – czarne pola zabijają",
    "chaos.event.blindness": "Ślepota – zachowaj czujność",
    "chaos.event.meteor": "Meteor – unikaj uderzeń",
    "chaos.event.enemyRush": "Szał wrogów – przeciwnicy poruszają się znacznie szybciej",
    "chaos.event.bulletStorm": "Burza pocisków – wszyscy wrogowie szybko strzelają podwójnie",
    "chaos.event.mirror": "Lustro – arena jest odwrócona",
    "chaos.event.respawn": "Odrodzenie – wrogowie wracają z 25% życia",
    "hud.hero": "Postać",
    "hud.wave": "Fala",
    "hud.score": "Punkty",
    "hud.difficulty": "Trudność",
    "hud.health": "Życie",
    "hud.special": "Specjalna"
  },
  nl: {
    "settings.open": "Instellingen",
    "settings.title": "Instellingen",
    "settings.close": "Sluiten",
    "settings.background": "Achtergrondafbeelding",
    "settings.presets": "Vooraf ingestelde achtergronden",
    "settings.presetNeon": "Neon",
    "settings.presetSpace": "Ruimte",
    "settings.presetSunset": "Zonsondergang",
    "settings.presetIce": "IJsland",
    "settings.presetHint": "Deze keuze verandert het hoofdmenu en de arena.",
    "settings.choose": "Afbeelding kiezen",
    "settings.remove": "Afbeelding verwijderen",
    "settings.backgroundHint": "JPG, PNG of WebP · max. 1,5 MB · alleen opgeslagen op dit apparaat",
    "settings.backgroundSaved": "Achtergrondafbeelding opgeslagen.",
    "settings.backgroundRemoved": "Standaardachtergrond actief.",
    "settings.backgroundTooLarge": "De afbeelding is groter dan 1,5 MB.",
    "settings.backgroundInvalid": "Kies een geldige afbeelding.",
    "settings.language": "Taal",
    "settings.deleteTitle": "Lokale gegevens",
    "settings.delete": "Alles verwijderen",
    "settings.deleteHint": "Verwijdert voortgang, munten, instellingen, test-ID en lokale records van dit apparaat.",
    "settings.warning": "Waarschuwing: dit kan niet ongedaan worden gemaakt. Het online klassement wordt niet verwijderd.",
    "settings.cancel": "Annuleren",
    "settings.confirm": "Ja, alles verwijderen",
    "menu.eyebrow": "Browsergevechtsspel",
    "menu.intro": "Kies een vechter, versla robotgolven en gebruik je speciale vaardigheid op het juiste moment.",
    "menu.device": "Op welk apparaat speel je?",
    "menu.mobile": "Mobiel",
    "menu.difficulty": "Moeilijkheid",
    "menu.easy": "Makkelijk",
    "menu.easyHint": "minder vijanden, zeer weinig munten",
    "menu.normal": "Normaal",
    "menu.normalHint": "normale beloningen",
    "menu.hard": "Moeilijk",
    "menu.hardHint": "sterkere vijanden, meer munten",
    "menu.playerName": "Spelersnaam",
    "menu.namePlaceholder": "Jouw naam",
    "menu.namePrivacyHint": "Gebruik een bijnaam, niet je echte naam.",
    "menu.coins": "Munten",
    "menu.leaderboard": "Klassement",
    "menu.all": "Alle",
    "menu.twoPlayers": "2 spelers",
    "menu.heroes": "Helden",
    "menu.shop": "Winkel",
    "menu.start": "Spel starten",
    "mode.change": "Modus wijzigen",
    "mode.title": "Kies een spelmodus",
    "mode.close": "Modusmenu sluiten",
    "mode.normalDescription": "Het klassieke gevecht tegen steeds sterkere robotgolven.",
    "mode.label": "Modus",
    "leaderboard.byMode": "Klassementen per modus",
    "mode.chaos": "Chaos",
    "mode.chaosDescription": "Elke 60 seconden veranderen de regels door een willekeurig event.",
    "mode.hardcore": "Hardcore",
    "mode.hardcoreDescription": "Eén treffer beëindigt je run.",
    "chaos.eventLabel": "Chaos-event",
    "chaos.event.brokenMap": "Kapotte kaart – zwarte vlakken zijn dodelijk",
    "chaos.event.blindness": "Blindheid – blijf alert",
    "chaos.event.meteor": "Meteoor – ontwijk de inslagen",
    "chaos.event.enemyRush": "Vijandelijke razernij – vijanden bewegen veel sneller",
    "chaos.event.bulletStorm": "Kogelstorm – alle vijanden vuren snelle dubbele schoten",
    "chaos.event.mirror": "Spiegel – de arena is omgekeerd",
    "chaos.event.respawn": "Respawn – vijanden keren terug met 25% leven",
    "hud.hero": "Held",
    "hud.wave": "Golf",
    "hud.score": "Score",
    "hud.difficulty": "Moeilijkheid",
    "hud.health": "Leven",
    "hud.special": "Speciaal"
  },
  "zh-CN": {
    "settings.open": "设置",
    "settings.title": "设置",
    "settings.close": "关闭",
    "settings.background": "背景图片",
    "settings.presets": "预设背景",
    "settings.presetNeon": "霓虹",
    "settings.presetSpace": "太空",
    "settings.presetSunset": "日落",
    "settings.presetIce": "冰雪世界",
    "settings.presetHint": "该选择会同时更改主菜单和竞技场背景。",
    "settings.choose": "选择图片",
    "settings.remove": "移除图片",
    "settings.backgroundHint": "JPG、PNG 或 WebP · 最大 1.5 MB · 仅保存在此设备上",
    "settings.backgroundSaved": "背景图片已保存。",
    "settings.backgroundRemoved": "已启用默认背景。",
    "settings.backgroundTooLarge": "图片大于 1.5 MB。",
    "settings.backgroundInvalid": "请选择有效的图片。",
    "settings.language": "语言",
    "settings.deleteTitle": "本地数据",
    "settings.delete": "删除全部",
    "settings.deleteHint": "删除此设备上的进度、金币、设置、测试 ID 和本地纪录。",
    "settings.warning": "警告：此操作无法撤销。在线排行榜不会被删除。",
    "settings.cancel": "取消",
    "settings.confirm": "确认删除全部",
    "menu.eyebrow": "浏览器战斗游戏",
    "menu.intro": "选择一名战士，击败一波波机器人，并在合适的时机使用特殊能力。",
    "menu.device": "你使用什么设备？",
    "menu.mobile": "手机",
    "menu.difficulty": "难度",
    "menu.easy": "简单",
    "menu.easyHint": "敌人较少，金币很少",
    "menu.normal": "普通",
    "menu.normalHint": "普通奖励",
    "menu.hard": "困难",
    "menu.hardHint": "敌人更强，金币更多",
    "menu.playerName": "玩家名称",
    "menu.namePlaceholder": "你的名称",
    "menu.namePrivacyHint": "请使用昵称，不要使用真实姓名。",
    "menu.coins": "金币",
    "menu.leaderboard": "排行榜",
    "menu.all": "全部",
    "menu.twoPlayers": "2 名玩家",
    "menu.heroes": "英雄",
    "menu.shop": "商店",
    "menu.start": "开始游戏",
    "mode.change": "切换模式",
    "mode.title": "选择游戏模式",
    "mode.close": "关闭模式菜单",
    "mode.normalDescription": "与越来越强的机器人波次进行经典战斗。",
    "mode.label": "模式",
    "leaderboard.byMode": "按模式分类的排行榜",
    "mode.chaos": "混乱",
    "mode.chaosDescription": "每 60 秒会有一个随机事件改变游戏规则。",
    "mode.hardcore": "硬核模式",
    "mode.hardcoreDescription": "受到一次攻击就会结束本局。",
    "chaos.eventLabel": "混乱事件",
    "chaos.event.brokenMap": "破碎地图 – 黑色区域会致命",
    "chaos.event.blindness": "失明 – 保持警觉",
    "chaos.event.meteor": "陨石 – 躲避落点",
    "chaos.event.enemyRush": "敌人狂潮 – 敌人的移动速度大幅提升",
    "chaos.event.bulletStorm": "弹幕风暴 – 所有敌人快速发射双重子弹",
    "chaos.event.mirror": "镜像 – 竞技场左右翻转",
    "chaos.event.respawn": "重生 – 敌人以 25% 生命返回",
    "hud.hero": "英雄",
    "hud.wave": "波次",
    "hud.score": "分数",
    "hud.difficulty": "难度",
    "hud.health": "生命",
    "hud.special": "特殊能力"
  }
};

const extendedTranslations = {
  de: {
    "reward.new": "Neue Belohnung",
    "reward.maskDescription": "Die Maske verstärkt bei deiner Spezialfähigkeit alle Werte 5 Sekunden lang um 25 %.",
    "reward.equip": "Jetzt ausrüsten",
    "reward.later": "Später",
    "multiplayer.testId": "Test-ID",
    "multiplayer.notCreated": "Nicht erstellt",
    "multiplayer.testConnection": "Verbindung testen",
    "multiplayer.disconnected": "Nicht verbunden",
    "multiplayer.createLobby": "Lobby erstellen",
    "multiplayer.join": "Beitreten",
    "multiplayer.noLobby": "Keine Lobby",
    "multiplayer.players": "Spieler",
    "multiplayer.leave": "Verlassen",
    "multiplayer.startCoop": "Koop starten",
    "multiplayer.coopPlayers": "Koop: 2 Spieler",
    "multiplayer.emptyLobby": "Noch niemand in der Lobby",
    "leaderboard.online": "Online Rangliste",
    "leaderboard.local": "Lokale Rangliste",
    "leaderboard.empty": "Noch kein Score",
    "controls.mouse": "Maus",
    "controls.click": "Klick",
    "controls.space": "Leertaste",
    "controls.fire": "Feuer",
    "controls.autoAim": "Auto-Ziel",
    "shop.heroes": "Helden",
    "shop.companions": "Begleiter",
    "shop.done": "Fertig",
    "shop.open": "offen",
    "shop.allUnlocked": "Alle Helden freigeschaltet.",
    "shop.specialBonus": "Spezial-Bonus",
    "shop.level": "Stufe",
    "shop.coins": "Münzen",
    "shop.active": "Aktiv",
    "shop.equip": "Ausrüsten",
    "shop.reward": "Belohnung",
    "shop.selected": "Ausgewählt",
    "shop.companion": "Begleiter",
    "shop.maxLevel": "Max Stufe",
    "shop.upgrade": "Upgrade",
    "shop.health": "Leben",
    "shop.damage": "Schaden",
    "shop.speed": "Tempo",
    "shop.abilityActivated": "Aktiviert sich mit deiner Spezialfähigkeit",
    "shop.follows": "Läuft neben dir",
    "arena.preparation": "Vorbereitung",
    "arena.bossWave": "Boss Welle",
    "arena.stage": "Stufe",
    "arena.nextWave": "Nächste Welle in",
    "boss.name": "Der Masken Dieb",
    "game.pause": "Pause",
    "game.resume": "Weiter",
    "game.mainMenu": "Hauptmenü",
    "game.newHighScore": "Neuer Highscore!",
    "game.over": "Game Over",
    "game.again": "Nochmal",
    "game.tryAgain": "Nochmal versuchen",
    "game.maskThiefDefeated": "Der Masken Dieb besiegt!",
    "game.maskThiefNotDefeated": "Der Masken Dieb wurde nicht besiegt"
  },
  en: {
    "reward.new": "New reward",
    "reward.maskDescription": "The mask boosts all stats by 25% for 5 seconds when you use your special ability.",
    "reward.equip": "Equip now",
    "reward.later": "Later",
    "multiplayer.testId": "Test ID",
    "multiplayer.notCreated": "Not created",
    "multiplayer.testConnection": "Test connection",
    "multiplayer.disconnected": "Disconnected",
    "multiplayer.createLobby": "Create lobby",
    "multiplayer.join": "Join",
    "multiplayer.noLobby": "No lobby",
    "multiplayer.players": "players",
    "multiplayer.leave": "Leave",
    "multiplayer.startCoop": "Start co-op",
    "multiplayer.coopPlayers": "Co-op: 2 players",
    "multiplayer.emptyLobby": "Nobody is in the lobby yet",
    "leaderboard.online": "Online leaderboard",
    "leaderboard.local": "Local leaderboard",
    "leaderboard.empty": "No score yet",
    "controls.mouse": "Mouse",
    "controls.click": "Click",
    "controls.space": "Space",
    "controls.fire": "Fire",
    "controls.autoAim": "Auto aim",
    "shop.heroes": "Heroes",
    "shop.companions": "Companions",
    "shop.done": "Done",
    "shop.open": "open",
    "shop.allUnlocked": "All heroes unlocked.",
    "shop.specialBonus": "Special bonus",
    "shop.level": "Level",
    "shop.coins": "coins",
    "shop.active": "Active",
    "shop.equip": "Equip",
    "shop.reward": "Reward",
    "shop.selected": "Selected",
    "shop.companion": "Companion",
    "shop.maxLevel": "Max level",
    "shop.upgrade": "Upgrade",
    "shop.health": "Health",
    "shop.damage": "Damage",
    "shop.speed": "Speed",
    "shop.abilityActivated": "Activates with your special ability",
    "shop.follows": "Follows you",
    "arena.preparation": "Preparation",
    "arena.bossWave": "Boss wave",
    "arena.stage": "Stage",
    "arena.nextWave": "Next wave in",
    "boss.name": "The Mask Thief",
    "game.pause": "Paused",
    "game.resume": "Resume",
    "game.mainMenu": "Main menu",
    "game.newHighScore": "New high score!",
    "game.over": "Game Over",
    "game.again": "Play again",
    "game.tryAgain": "Try again",
    "game.maskThiefDefeated": "The Mask Thief defeated!",
    "game.maskThiefNotDefeated": "The Mask Thief was not defeated"
  },
  fr: {
    "reward.new": "Nouvelle récompense",
    "reward.maskDescription": "Le masque augmente toutes les statistiques de 25 % pendant 5 secondes avec votre capacité spéciale.",
    "reward.equip": "Équiper",
    "reward.later": "Plus tard",
    "multiplayer.testId": "ID de test",
    "multiplayer.notCreated": "Non créé",
    "multiplayer.testConnection": "Tester la connexion",
    "multiplayer.disconnected": "Déconnecté",
    "multiplayer.createLobby": "Créer un salon",
    "multiplayer.join": "Rejoindre",
    "multiplayer.noLobby": "Aucun salon",
    "multiplayer.players": "joueurs",
    "multiplayer.leave": "Quitter",
    "multiplayer.startCoop": "Lancer la coop",
    "multiplayer.coopPlayers": "Coop : 2 joueurs",
    "multiplayer.emptyLobby": "Personne dans le salon",
    "leaderboard.online": "Classement en ligne",
    "leaderboard.local": "Classement local",
    "leaderboard.empty": "Aucun score",
    "controls.mouse": "Souris",
    "controls.click": "Clic",
    "controls.space": "Espace",
    "controls.fire": "Tirer",
    "controls.autoAim": "Visée auto",
    "shop.heroes": "Héros",
    "shop.companions": "Compagnons",
    "shop.done": "Terminé",
    "shop.open": "restants",
    "shop.allUnlocked": "Tous les héros sont débloqués.",
    "shop.specialBonus": "Bonus spécial",
    "shop.level": "Niveau",
    "shop.coins": "pièces",
    "shop.active": "Actif",
    "shop.equip": "Équiper",
    "shop.reward": "Récompense",
    "shop.selected": "Sélectionné",
    "shop.companion": "Compagnon",
    "shop.maxLevel": "Niveau max.",
    "shop.upgrade": "Améliorer",
    "shop.health": "Vie",
    "shop.damage": "Dégâts",
    "shop.speed": "Vitesse",
    "shop.abilityActivated": "S’active avec votre capacité spéciale",
    "shop.follows": "Vous accompagne",
    "arena.preparation": "Préparation",
    "arena.bossWave": "Vague de boss",
    "arena.stage": "Phase",
    "arena.nextWave": "Prochaine vague dans",
    "boss.name": "Le Voleur de Masque",
    "game.pause": "Pause",
    "game.resume": "Continuer",
    "game.mainMenu": "Menu principal",
    "game.newHighScore": "Nouveau record !",
    "game.over": "Partie terminée",
    "game.again": "Rejouer",
    "game.tryAgain": "Réessayer",
    "game.maskThiefDefeated": "Le Voleur de Masque est vaincu !",
    "game.maskThiefNotDefeated": "Le Voleur de Masque n’a pas été vaincu"
  },
  es: {
    "reward.new": "Nueva recompensa",
    "reward.maskDescription": "La máscara aumenta todas las estadísticas un 25 % durante 5 segundos al usar tu habilidad especial.",
    "reward.equip": "Equipar ahora",
    "reward.later": "Más tarde",
    "multiplayer.testId": "ID de prueba",
    "multiplayer.notCreated": "No creado",
    "multiplayer.testConnection": "Probar conexión",
    "multiplayer.disconnected": "Desconectado",
    "multiplayer.createLobby": "Crear sala",
    "multiplayer.join": "Unirse",
    "multiplayer.noLobby": "Sin sala",
    "multiplayer.players": "jugadores",
    "multiplayer.leave": "Salir",
    "multiplayer.startCoop": "Iniciar cooperativo",
    "multiplayer.coopPlayers": "Cooperativo: 2 jugadores",
    "multiplayer.emptyLobby": "Todavía no hay nadie en la sala",
    "leaderboard.online": "Clasificación en línea",
    "leaderboard.local": "Clasificación local",
    "leaderboard.empty": "Aún no hay puntuación",
    "controls.mouse": "Ratón",
    "controls.click": "Clic",
    "controls.space": "Espacio",
    "controls.fire": "Disparar",
    "controls.autoAim": "Apuntado automático",
    "shop.heroes": "Héroes",
    "shop.companions": "Compañeros",
    "shop.done": "Completo",
    "shop.open": "pendientes",
    "shop.allUnlocked": "Todos los héroes desbloqueados.",
    "shop.specialBonus": "Bono especial",
    "shop.level": "Nivel",
    "shop.coins": "monedas",
    "shop.active": "Activo",
    "shop.equip": "Equipar",
    "shop.reward": "Recompensa",
    "shop.selected": "Seleccionado",
    "shop.companion": "Compañero",
    "shop.maxLevel": "Nivel máximo",
    "shop.upgrade": "Mejorar",
    "shop.health": "Vida",
    "shop.damage": "Daño",
    "shop.speed": "Velocidad",
    "shop.abilityActivated": "Se activa con tu habilidad especial",
    "shop.follows": "Te acompaña",
    "arena.preparation": "Preparación",
    "arena.bossWave": "Oleada de jefe",
    "arena.stage": "Fase",
    "arena.nextWave": "Siguiente oleada en",
    "boss.name": "El Ladrón de Máscaras",
    "game.pause": "Pausa",
    "game.resume": "Continuar",
    "game.mainMenu": "Menú principal",
    "game.newHighScore": "¡Nuevo récord!",
    "game.over": "Fin de la partida",
    "game.again": "Jugar otra vez",
    "game.tryAgain": "Reintentar",
    "game.maskThiefDefeated": "¡El Ladrón de Máscaras ha sido derrotado!",
    "game.maskThiefNotDefeated": "El Ladrón de Máscaras no fue derrotado"
  },
  it: {
    "reward.new": "Nuova ricompensa",
    "reward.maskDescription": "La maschera aumenta tutte le statistiche del 25% per 5 secondi usando l’abilità speciale.",
    "reward.equip": "Equipaggia",
    "reward.later": "Più tardi",
    "multiplayer.testId": "ID di test",
    "multiplayer.notCreated": "Non creato",
    "multiplayer.testConnection": "Prova connessione",
    "multiplayer.disconnected": "Disconnesso",
    "multiplayer.createLobby": "Crea lobby",
    "multiplayer.join": "Entra",
    "multiplayer.noLobby": "Nessuna lobby",
    "multiplayer.players": "giocatori",
    "multiplayer.leave": "Esci",
    "multiplayer.startCoop": "Avvia cooperativa",
    "multiplayer.coopPlayers": "Coop: 2 giocatori",
    "multiplayer.emptyLobby": "Nessuno nella lobby",
    "leaderboard.online": "Classifica online",
    "leaderboard.local": "Classifica locale",
    "leaderboard.empty": "Nessun punteggio",
    "controls.mouse": "Mouse",
    "controls.click": "Clic",
    "controls.space": "Spazio",
    "controls.fire": "Fuoco",
    "controls.autoAim": "Mira automatica",
    "shop.heroes": "Eroi",
    "shop.companions": "Compagni",
    "shop.done": "Completo",
    "shop.open": "disponibili",
    "shop.allUnlocked": "Tutti gli eroi sono sbloccati.",
    "shop.specialBonus": "Bonus speciale",
    "shop.level": "Livello",
    "shop.coins": "monete",
    "shop.active": "Attivo",
    "shop.equip": "Equipaggia",
    "shop.reward": "Ricompensa",
    "shop.selected": "Selezionato",
    "shop.companion": "Compagno",
    "shop.maxLevel": "Livello massimo",
    "shop.upgrade": "Migliora",
    "shop.health": "Vita",
    "shop.damage": "Danno",
    "shop.speed": "Velocità",
    "shop.abilityActivated": "Si attiva con l’abilità speciale",
    "shop.follows": "Ti segue",
    "arena.preparation": "Preparazione",
    "arena.bossWave": "Ondata boss",
    "arena.stage": "Fase",
    "arena.nextWave": "Prossima ondata tra",
    "boss.name": "Il Ladro di Maschere",
    "game.pause": "Pausa",
    "game.resume": "Continua",
    "game.mainMenu": "Menu principale",
    "game.newHighScore": "Nuovo record!",
    "game.over": "Partita terminata",
    "game.again": "Gioca ancora",
    "game.tryAgain": "Riprova",
    "game.maskThiefDefeated": "Il Ladro di Maschere è stato sconfitto!",
    "game.maskThiefNotDefeated": "Il Ladro di Maschere non è stato sconfitto"
  },
  pl: {
    "reward.new": "Nowa nagroda",
    "reward.maskDescription": "Maska zwiększa wszystkie statystyki o 25% na 5 sekund po użyciu zdolności specjalnej.",
    "reward.equip": "Załóż teraz",
    "reward.later": "Później",
    "multiplayer.testId": "ID testowe",
    "multiplayer.notCreated": "Nie utworzono",
    "multiplayer.testConnection": "Testuj połączenie",
    "multiplayer.disconnected": "Rozłączono",
    "multiplayer.createLobby": "Utwórz lobby",
    "multiplayer.join": "Dołącz",
    "multiplayer.noLobby": "Brak lobby",
    "multiplayer.players": "graczy",
    "multiplayer.leave": "Opuść",
    "multiplayer.startCoop": "Uruchom kooperację",
    "multiplayer.coopPlayers": "Kooperacja: 2 graczy",
    "multiplayer.emptyLobby": "Lobby jest puste",
    "leaderboard.online": "Ranking online",
    "leaderboard.local": "Ranking lokalny",
    "leaderboard.empty": "Brak wyniku",
    "controls.mouse": "Mysz",
    "controls.click": "Klik",
    "controls.space": "Spacja",
    "controls.fire": "Ogień",
    "controls.autoAim": "Auto-celowanie",
    "shop.heroes": "Bohaterowie",
    "shop.companions": "Towarzysze",
    "shop.done": "Gotowe",
    "shop.open": "pozostało",
    "shop.allUnlocked": "Wszyscy bohaterowie odblokowani.",
    "shop.specialBonus": "Bonus specjalny",
    "shop.level": "Poziom",
    "shop.coins": "monet",
    "shop.active": "Aktywny",
    "shop.equip": "Załóż",
    "shop.reward": "Nagroda",
    "shop.selected": "Wybrano",
    "shop.companion": "Towarzysz",
    "shop.maxLevel": "Maks. poziom",
    "shop.upgrade": "Ulepsz",
    "shop.health": "Życie",
    "shop.damage": "Obrażenia",
    "shop.speed": "Tempo",
    "shop.abilityActivated": "Aktywuje się ze zdolnością specjalną",
    "shop.follows": "Podąża za tobą",
    "arena.preparation": "Przygotowanie",
    "arena.bossWave": "Fala bossa",
    "arena.stage": "Etap",
    "arena.nextWave": "Następna fala za",
    "boss.name": "Złodziej Masek",
    "game.pause": "Pauza",
    "game.resume": "Kontynuuj",
    "game.mainMenu": "Menu główne",
    "game.newHighScore": "Nowy rekord!",
    "game.over": "Koniec gry",
    "game.again": "Zagraj ponownie",
    "game.tryAgain": "Spróbuj ponownie",
    "game.maskThiefDefeated": "Złodziej Masek pokonany!",
    "game.maskThiefNotDefeated": "Złodziej Masek nie został pokonany"
  },
  nl: {
    "reward.new": "Nieuwe beloning",
    "reward.maskDescription": "Het masker verhoogt alle statistieken 5 seconden met 25% wanneer je speciale vaardigheid wordt gebruikt.",
    "reward.equip": "Nu uitrusten",
    "reward.later": "Later",
    "multiplayer.testId": "Test-ID",
    "multiplayer.notCreated": "Niet aangemaakt",
    "multiplayer.testConnection": "Verbinding testen",
    "multiplayer.disconnected": "Niet verbonden",
    "multiplayer.createLobby": "Lobby maken",
    "multiplayer.join": "Deelnemen",
    "multiplayer.noLobby": "Geen lobby",
    "multiplayer.players": "spelers",
    "multiplayer.leave": "Verlaten",
    "multiplayer.startCoop": "Co-op starten",
    "multiplayer.coopPlayers": "Co-op: 2 spelers",
    "multiplayer.emptyLobby": "Nog niemand in de lobby",
    "leaderboard.online": "Online klassement",
    "leaderboard.local": "Lokaal klassement",
    "leaderboard.empty": "Nog geen score",
    "controls.mouse": "Muis",
    "controls.click": "Klik",
    "controls.space": "Spatie",
    "controls.fire": "Vuren",
    "controls.autoAim": "Automatisch richten",
    "shop.heroes": "Helden",
    "shop.companions": "Metgezellen",
    "shop.done": "Klaar",
    "shop.open": "open",
    "shop.allUnlocked": "Alle helden ontgrendeld.",
    "shop.specialBonus": "Speciale bonus",
    "shop.level": "Niveau",
    "shop.coins": "munten",
    "shop.active": "Actief",
    "shop.equip": "Uitrusten",
    "shop.reward": "Beloning",
    "shop.selected": "Geselecteerd",
    "shop.companion": "Metgezel",
    "shop.maxLevel": "Max. niveau",
    "shop.upgrade": "Upgrade",
    "shop.health": "Leven",
    "shop.damage": "Schade",
    "shop.speed": "Tempo",
    "shop.abilityActivated": "Activeert met je speciale vaardigheid",
    "shop.follows": "Volgt je",
    "arena.preparation": "Voorbereiding",
    "arena.bossWave": "Bossgolf",
    "arena.stage": "Fase",
    "arena.nextWave": "Volgende golf over",
    "boss.name": "De Maskerdief",
    "game.pause": "Pauze",
    "game.resume": "Doorgaan",
    "game.mainMenu": "Hoofdmenu",
    "game.newHighScore": "Nieuwe highscore!",
    "game.over": "Game over",
    "game.again": "Opnieuw spelen",
    "game.tryAgain": "Opnieuw proberen",
    "game.maskThiefDefeated": "De Maskerdief is verslagen!",
    "game.maskThiefNotDefeated": "De Maskerdief is niet verslagen"
  },
  "zh-CN": {
    "reward.new": "新奖励",
    "reward.maskDescription": "使用特殊能力时，面具会使所有属性提高 25%，持续 5 秒。",
    "reward.equip": "立即装备",
    "reward.later": "稍后",
    "multiplayer.testId": "测试 ID",
    "multiplayer.notCreated": "尚未创建",
    "multiplayer.testConnection": "测试连接",
    "multiplayer.disconnected": "未连接",
    "multiplayer.createLobby": "创建房间",
    "multiplayer.join": "加入",
    "multiplayer.noLobby": "无房间",
    "multiplayer.players": "名玩家",
    "multiplayer.leave": "离开",
    "multiplayer.startCoop": "开始合作",
    "multiplayer.coopPlayers": "合作：2 名玩家",
    "multiplayer.emptyLobby": "房间内暂无玩家",
    "leaderboard.online": "在线排行榜",
    "leaderboard.local": "本地排行榜",
    "leaderboard.empty": "暂无分数",
    "controls.mouse": "鼠标",
    "controls.click": "点击",
    "controls.space": "空格键",
    "controls.fire": "射击",
    "controls.autoAim": "自动瞄准",
    "shop.heroes": "英雄",
    "shop.companions": "伙伴",
    "shop.done": "完成",
    "shop.open": "未解锁",
    "shop.allUnlocked": "所有英雄均已解锁。",
    "shop.specialBonus": "特殊加成",
    "shop.level": "等级",
    "shop.coins": "金币",
    "shop.active": "已装备",
    "shop.equip": "装备",
    "shop.reward": "奖励",
    "shop.selected": "已选择",
    "shop.companion": "伙伴",
    "shop.maxLevel": "最高等级",
    "shop.upgrade": "升级",
    "shop.health": "生命",
    "shop.damage": "伤害",
    "shop.speed": "速度",
    "shop.abilityActivated": "使用特殊能力时激活",
    "shop.follows": "跟随在你身边",
    "arena.preparation": "准备",
    "arena.bossWave": "首领波次",
    "arena.stage": "阶段",
    "arena.nextWave": "下一波倒计时",
    "boss.name": "面具窃贼",
    "game.pause": "暂停",
    "game.resume": "继续",
    "game.mainMenu": "主菜单",
    "game.newHighScore": "新纪录！",
    "game.over": "游戏结束",
    "game.again": "再玩一次",
    "game.tryAgain": "再次尝试",
    "game.maskThiefDefeated": "面具窃贼已被击败！",
    "game.maskThiefNotDefeated": "未能击败面具窃贼"
  }
};

Object.entries(extendedTranslations).forEach(([language, values]) => {
  Object.assign(translations[language], values);
});

const multiplayerRuntimeTranslations = {
  de: {
    "multiplayer.connecting": "Verbinde...",
    "multiplayer.connected": "Verbunden",
    "multiplayer.lobbyConnected": "Lobby verbunden",
    "multiplayer.error": "Fehler",
    "multiplayer.codeMissing": "Code fehlt",
    "multiplayer.needsTwo": "Normaler Koop braucht genau 2 Spieler",
    "multiplayer.hostOnly": "Nur der Host kann starten",
    "multiplayer.endbossStarting": "Endboss startet",
    "multiplayer.endbossLobby": "Endboss-Lobby wird erstellt...",
    "multiplayer.ready": "Spieler bereit",
    "multiplayer.secondMissing": "Zweiter Spieler fehlt",
    "multiplayer.player": "Spieler",
    "multiplayer.starting": "Startet...",
    "multiplayer.coopStarting": "Koop startet..."
  },
  en: {
    "multiplayer.connecting": "Connecting...",
    "multiplayer.connected": "Connected",
    "multiplayer.lobbyConnected": "Lobby connected",
    "multiplayer.error": "Error",
    "multiplayer.codeMissing": "Code missing",
    "multiplayer.needsTwo": "Normal co-op requires exactly 2 players",
    "multiplayer.hostOnly": "Only the host can start",
    "multiplayer.endbossStarting": "Final boss starting",
    "multiplayer.endbossLobby": "Creating final boss lobby...",
    "multiplayer.ready": "players ready",
    "multiplayer.secondMissing": "Second player missing",
    "multiplayer.player": "Player",
    "multiplayer.starting": "Starting...",
    "multiplayer.coopStarting": "Co-op starting..."
  },
  fr: {
    "multiplayer.connecting": "Connexion...",
    "multiplayer.connected": "Connecté",
    "multiplayer.lobbyConnected": "Salon connecté",
    "multiplayer.error": "Erreur",
    "multiplayer.codeMissing": "Code manquant",
    "multiplayer.needsTwo": "La coop normale nécessite exactement 2 joueurs",
    "multiplayer.hostOnly": "Seul l’hôte peut lancer",
    "multiplayer.endbossStarting": "Boss final en cours de lancement",
    "multiplayer.endbossLobby": "Création du salon du boss final...",
    "multiplayer.ready": "joueurs prêts",
    "multiplayer.secondMissing": "Deuxième joueur manquant",
    "multiplayer.player": "Joueur",
    "multiplayer.starting": "Lancement...",
    "multiplayer.coopStarting": "Lancement de la coop..."
  },
  es: {
    "multiplayer.connecting": "Conectando...",
    "multiplayer.connected": "Conectado",
    "multiplayer.lobbyConnected": "Sala conectada",
    "multiplayer.error": "Error",
    "multiplayer.codeMissing": "Falta el código",
    "multiplayer.needsTwo": "El cooperativo normal requiere exactamente 2 jugadores",
    "multiplayer.hostOnly": "Solo el anfitrión puede iniciar",
    "multiplayer.endbossStarting": "Iniciando jefe final",
    "multiplayer.endbossLobby": "Creando sala del jefe final...",
    "multiplayer.ready": "jugadores listos",
    "multiplayer.secondMissing": "Falta el segundo jugador",
    "multiplayer.player": "Jugador",
    "multiplayer.starting": "Iniciando...",
    "multiplayer.coopStarting": "Iniciando cooperativo..."
  },
  it: {
    "multiplayer.connecting": "Connessione...",
    "multiplayer.connected": "Connesso",
    "multiplayer.lobbyConnected": "Lobby connessa",
    "multiplayer.error": "Errore",
    "multiplayer.codeMissing": "Codice mancante",
    "multiplayer.needsTwo": "La cooperativa normale richiede esattamente 2 giocatori",
    "multiplayer.hostOnly": "Solo l’host può iniziare",
    "multiplayer.endbossStarting": "Avvio boss finale",
    "multiplayer.endbossLobby": "Creazione lobby del boss finale...",
    "multiplayer.ready": "giocatori pronti",
    "multiplayer.secondMissing": "Manca il secondo giocatore",
    "multiplayer.player": "Giocatore",
    "multiplayer.starting": "Avvio...",
    "multiplayer.coopStarting": "Avvio cooperativa..."
  },
  pl: {
    "multiplayer.connecting": "Łączenie...",
    "multiplayer.connected": "Połączono",
    "multiplayer.lobbyConnected": "Połączono z lobby",
    "multiplayer.error": "Błąd",
    "multiplayer.codeMissing": "Brak kodu",
    "multiplayer.needsTwo": "Zwykła kooperacja wymaga dokładnie 2 graczy",
    "multiplayer.hostOnly": "Tylko host może rozpocząć",
    "multiplayer.endbossStarting": "Uruchamianie bossa końcowego",
    "multiplayer.endbossLobby": "Tworzenie lobby bossa końcowego...",
    "multiplayer.ready": "graczy gotowych",
    "multiplayer.secondMissing": "Brakuje drugiego gracza",
    "multiplayer.player": "Gracz",
    "multiplayer.starting": "Uruchamianie...",
    "multiplayer.coopStarting": "Uruchamianie kooperacji..."
  },
  nl: {
    "multiplayer.connecting": "Verbinden...",
    "multiplayer.connected": "Verbonden",
    "multiplayer.lobbyConnected": "Lobby verbonden",
    "multiplayer.error": "Fout",
    "multiplayer.codeMissing": "Code ontbreekt",
    "multiplayer.needsTwo": "Normale co-op vereist precies 2 spelers",
    "multiplayer.hostOnly": "Alleen de host kan starten",
    "multiplayer.endbossStarting": "Eindbaas wordt gestart",
    "multiplayer.endbossLobby": "Eindbaaslobby wordt gemaakt...",
    "multiplayer.ready": "spelers gereed",
    "multiplayer.secondMissing": "Tweede speler ontbreekt",
    "multiplayer.player": "Speler",
    "multiplayer.starting": "Starten...",
    "multiplayer.coopStarting": "Co-op wordt gestart..."
  },
  "zh-CN": {
    "multiplayer.connecting": "正在连接...",
    "multiplayer.connected": "已连接",
    "multiplayer.lobbyConnected": "房间已连接",
    "multiplayer.error": "错误",
    "multiplayer.codeMissing": "缺少房间码",
    "multiplayer.needsTwo": "普通合作模式需要正好 2 名玩家",
    "multiplayer.hostOnly": "只有房主可以开始",
    "multiplayer.endbossStarting": "最终首领即将开始",
    "multiplayer.endbossLobby": "正在创建最终首领房间...",
    "multiplayer.ready": "名玩家已准备",
    "multiplayer.secondMissing": "缺少第二名玩家",
    "multiplayer.player": "玩家",
    "multiplayer.starting": "正在开始...",
    "multiplayer.coopStarting": "合作模式正在开始..."
  }
};

Object.entries(multiplayerRuntimeTranslations).forEach(([language, values]) => {
  Object.assign(translations[language], values);
});

const gameTextTranslations = {
  de: {
    "game.pauseStatus": "{name}, du bist bei Welle {wave}.",
    "game.summary": "{name}, du hast Welle {wave} erreicht und {score} Punkte gesammelt.",
    "game.defeatedBosses": "Besiegte Bosse",
    "game.bossBonus": "Bossbonus",
    "game.difficulty": "Schwierigkeit",
    "game.reward": "Belohnung",
    "game.highScore": "Highscore",
    "game.endbossVictory": "Du hast alle drei Stufen in einer Runde bezwungen.",
    "game.newReward": "Neue Belohnung: Scipios Maske",
    "game.endbossProgress": "Du hast Stufe {stage} von 3 erreicht.",
    "game.fightAgain": "Erneut kämpfen"
  },
  en: {
    "game.pauseStatus": "{name}, you are on wave {wave}.",
    "game.summary": "{name}, you reached wave {wave} and scored {score} points.",
    "game.defeatedBosses": "Bosses defeated",
    "game.bossBonus": "Boss bonus",
    "game.difficulty": "Difficulty",
    "game.reward": "Reward",
    "game.highScore": "High score",
    "game.endbossVictory": "You defeated all three stages in one round.",
    "game.newReward": "New reward: Scipio’s Mask",
    "game.endbossProgress": "You reached stage {stage} of 3.",
    "game.fightAgain": "Fight again"
  },
  fr: {
    "game.pauseStatus": "{name}, vous êtes à la vague {wave}.",
    "game.summary": "{name}, vous avez atteint la vague {wave} et marqué {score} points.",
    "game.defeatedBosses": "Boss vaincus",
    "game.bossBonus": "Bonus de boss",
    "game.difficulty": "Difficulté",
    "game.reward": "Récompense",
    "game.highScore": "Record",
    "game.endbossVictory": "Vous avez vaincu les trois phases en une manche.",
    "game.newReward": "Nouvelle récompense : Masque de Scipio",
    "game.endbossProgress": "Vous avez atteint la phase {stage} sur 3.",
    "game.fightAgain": "Combattre à nouveau"
  },
  es: {
    "game.pauseStatus": "{name}, estás en la oleada {wave}.",
    "game.summary": "{name}, alcanzaste la oleada {wave} y conseguiste {score} puntos.",
    "game.defeatedBosses": "Jefes derrotados",
    "game.bossBonus": "Bono de jefe",
    "game.difficulty": "Dificultad",
    "game.reward": "Recompensa",
    "game.highScore": "Récord",
    "game.endbossVictory": "Has superado las tres fases en una ronda.",
    "game.newReward": "Nueva recompensa: Máscara de Scipio",
    "game.endbossProgress": "Has alcanzado la fase {stage} de 3.",
    "game.fightAgain": "Luchar de nuevo"
  },
  it: {
    "game.pauseStatus": "{name}, sei all’ondata {wave}.",
    "game.summary": "{name}, hai raggiunto l’ondata {wave} e ottenuto {score} punti.",
    "game.defeatedBosses": "Boss sconfitti",
    "game.bossBonus": "Bonus boss",
    "game.difficulty": "Difficoltà",
    "game.reward": "Ricompensa",
    "game.highScore": "Record",
    "game.endbossVictory": "Hai superato tutte e tre le fasi in una partita.",
    "game.newReward": "Nuova ricompensa: Maschera di Scipio",
    "game.endbossProgress": "Hai raggiunto la fase {stage} di 3.",
    "game.fightAgain": "Combatti di nuovo"
  },
  pl: {
    "game.pauseStatus": "{name}, jesteś na fali {wave}.",
    "game.summary": "{name}, osiągnięto falę {wave} i zdobyto {score} punktów.",
    "game.defeatedBosses": "Pokonani bossowie",
    "game.bossBonus": "Premia za bossa",
    "game.difficulty": "Trudność",
    "game.reward": "Nagroda",
    "game.highScore": "Rekord",
    "game.endbossVictory": "Pokonano wszystkie trzy etapy w jednej rundzie.",
    "game.newReward": "Nowa nagroda: Maska Scypiona",
    "game.endbossProgress": "Osiągnięto etap {stage} z 3.",
    "game.fightAgain": "Walcz ponownie"
  },
  nl: {
    "game.pauseStatus": "{name}, je bent bij golf {wave}.",
    "game.summary": "{name}, je bereikte golf {wave} en behaalde {score} punten.",
    "game.defeatedBosses": "Verslagen bazen",
    "game.bossBonus": "Baasbonus",
    "game.difficulty": "Moeilijkheid",
    "game.reward": "Beloning",
    "game.highScore": "Highscore",
    "game.endbossVictory": "Je hebt alle drie fasen in één ronde verslagen.",
    "game.newReward": "Nieuwe beloning: Scipio’s Masker",
    "game.endbossProgress": "Je bereikte fase {stage} van 3.",
    "game.fightAgain": "Opnieuw vechten"
  },
  "zh-CN": {
    "game.pauseStatus": "{name}，你正在第 {wave} 波。",
    "game.summary": "{name}，你到达了第 {wave} 波并获得 {score} 分。",
    "game.defeatedBosses": "击败的首领",
    "game.bossBonus": "首领奖励",
    "game.difficulty": "难度",
    "game.reward": "奖励",
    "game.highScore": "最高分",
    "game.endbossVictory": "你在一局内击败了全部三个阶段。",
    "game.newReward": "新奖励：西庇阿的面具",
    "game.endbossProgress": "你到达了第 {stage}/3 阶段。",
    "game.fightAgain": "再次挑战"
  }
};

const privacyAndScoreTranslations = {
  de: {
    "privacy.footer": "Datenschutz",
    "scoreManage.title": "Meine Online-Scores",
    "scoreManage.hint": "Nur Einträge, die auf diesem Gerät mit einem Löschschlüssel gespeichert wurden, können hier gelöscht werden.",
    "scoreManage.empty": "Auf diesem Gerät sind noch keine löschbaren Online-Scores gespeichert.",
    "scoreManage.delete": "Löschen",
    "scoreManage.deleteAll": "Alle meine Online-Scores löschen",
    "scoreManage.confirm": "Online-Scores löschen",
    "scoreManage.confirmText": "Diese Einträge werden dauerhaft aus der Online-Rangliste gelöscht.",
    "scoreManage.deleting": "Online-Score wird gelöscht …",
    "scoreManage.deleted": "Online-Score gelöscht.",
    "scoreManage.deletedAll": "Alle gespeicherten Online-Scores wurden gelöscht.",
    "scoreManage.deleteFailed": "Der Online-Score konnte nicht gelöscht werden.",
    "settings.deleteHint": "Löscht Fortschritt, Coins, Einstellungen und lokale Rekorde auf diesem Gerät. Online-Scores bleiben erhalten.",
    "settings.warning": "Achtung: Dabei gehen auch die Löschschlüssel für Online-Scores verloren. Lösche deine Online-Scores zuerst, falls du sie später nicht behalten möchtest."
  },
  en: {
    "privacy.footer": "Privacy",
    "scoreManage.title": "My online scores",
    "scoreManage.hint": "Only entries saved with a deletion key on this device can be deleted here.",
    "scoreManage.empty": "No deletable online scores are stored on this device yet.",
    "scoreManage.delete": "Delete",
    "scoreManage.deleteAll": "Delete all my online scores",
    "scoreManage.confirm": "Delete online scores",
    "scoreManage.confirmText": "These entries will be permanently removed from the online leaderboard.",
    "scoreManage.deleting": "Deleting online score …",
    "scoreManage.deleted": "Online score deleted.",
    "scoreManage.deletedAll": "All stored online scores were deleted.",
    "scoreManage.deleteFailed": "The online score could not be deleted.",
    "settings.deleteHint": "Deletes progress, coins, settings and local records on this device. Online scores remain stored.",
    "settings.warning": "Warning: This also removes your online-score deletion keys. Delete your online scores first if you do not want to keep them."
  },
  fr: {
    "privacy.footer": "Confidentialité",
    "scoreManage.title": "Mes scores en ligne",
    "scoreManage.hint": "Seules les entrées dont la clé de suppression est enregistrée sur cet appareil peuvent être supprimées ici.",
    "scoreManage.empty": "Aucun score en ligne supprimable n’est enregistré sur cet appareil.",
    "scoreManage.delete": "Supprimer",
    "scoreManage.deleteAll": "Supprimer tous mes scores en ligne",
    "scoreManage.confirm": "Supprimer les scores",
    "scoreManage.confirmText": "Ces entrées seront définitivement supprimées du classement en ligne.",
    "scoreManage.deleting": "Suppression du score en ligne…",
    "scoreManage.deleted": "Score en ligne supprimé.",
    "scoreManage.deletedAll": "Tous les scores en ligne enregistrés ont été supprimés.",
    "scoreManage.deleteFailed": "Le score en ligne n’a pas pu être supprimé.",
    "settings.deleteHint": "Supprime la progression, les pièces, les paramètres et les records locaux. Les scores en ligne restent enregistrés.",
    "settings.warning": "Attention : les clés de suppression des scores en ligne seront aussi effacées. Supprimez d’abord vos scores en ligne si vous ne souhaitez pas les conserver."
  },
  es: {
    "privacy.footer": "Privacidad",
    "scoreManage.title": "Mis puntuaciones online",
    "scoreManage.hint": "Aquí solo pueden borrarse las entradas cuya clave de eliminación esté guardada en este dispositivo.",
    "scoreManage.empty": "Este dispositivo aún no tiene puntuaciones online que puedan borrarse.",
    "scoreManage.delete": "Borrar",
    "scoreManage.deleteAll": "Borrar todas mis puntuaciones online",
    "scoreManage.confirm": "Borrar puntuaciones",
    "scoreManage.confirmText": "Estas entradas se eliminarán permanentemente de la clasificación online.",
    "scoreManage.deleting": "Borrando puntuación online…",
    "scoreManage.deleted": "Puntuación online borrada.",
    "scoreManage.deletedAll": "Se borraron todas las puntuaciones online guardadas.",
    "scoreManage.deleteFailed": "No se pudo borrar la puntuación online.",
    "settings.deleteHint": "Borra el progreso, las monedas, los ajustes y los récords locales. Las puntuaciones online permanecen.",
    "settings.warning": "Atención: también se borrarán las claves para eliminar puntuaciones online. Borra primero tus puntuaciones online si no quieres conservarlas."
  },
  it: {
    "privacy.footer": "Privacy",
    "scoreManage.title": "I miei punteggi online",
    "scoreManage.hint": "Qui puoi eliminare solo le voci con una chiave di eliminazione salvata su questo dispositivo.",
    "scoreManage.empty": "Su questo dispositivo non sono ancora salvati punteggi online eliminabili.",
    "scoreManage.delete": "Elimina",
    "scoreManage.deleteAll": "Elimina tutti i miei punteggi online",
    "scoreManage.confirm": "Elimina punteggi online",
    "scoreManage.confirmText": "Queste voci verranno rimosse definitivamente dalla classifica online.",
    "scoreManage.deleting": "Eliminazione del punteggio online…",
    "scoreManage.deleted": "Punteggio online eliminato.",
    "scoreManage.deletedAll": "Tutti i punteggi online salvati sono stati eliminati.",
    "scoreManage.deleteFailed": "Impossibile eliminare il punteggio online.",
    "settings.deleteHint": "Elimina progressi, monete, impostazioni e record locali. I punteggi online restano salvati.",
    "settings.warning": "Attenzione: verranno eliminate anche le chiavi dei punteggi online. Elimina prima i punteggi online se non vuoi conservarli."
  },
  pl: {
    "privacy.footer": "Prywatność",
    "scoreManage.title": "Moje wyniki online",
    "scoreManage.hint": "Można tu usunąć tylko wpisy, których klucz usuwania zapisano na tym urządzeniu.",
    "scoreManage.empty": "Na tym urządzeniu nie zapisano jeszcze wyników online możliwych do usunięcia.",
    "scoreManage.delete": "Usuń",
    "scoreManage.deleteAll": "Usuń wszystkie moje wyniki online",
    "scoreManage.confirm": "Usuń wyniki online",
    "scoreManage.confirmText": "Te wpisy zostaną trwale usunięte z rankingu online.",
    "scoreManage.deleting": "Usuwanie wyniku online…",
    "scoreManage.deleted": "Wynik online usunięty.",
    "scoreManage.deletedAll": "Wszystkie zapisane wyniki online zostały usunięte.",
    "scoreManage.deleteFailed": "Nie udało się usunąć wyniku online.",
    "settings.deleteHint": "Usuwa postęp, monety, ustawienia i lokalne rekordy. Wyniki online pozostają zapisane.",
    "settings.warning": "Uwaga: klucze usuwania wyników online również zostaną skasowane. Najpierw usuń wyniki online, jeśli nie chcesz ich zachować."
  },
  nl: {
    "privacy.footer": "Privacy",
    "scoreManage.title": "Mijn online scores",
    "scoreManage.hint": "Alleen inzendingen met een verwijdercode op dit apparaat kunnen hier worden verwijderd.",
    "scoreManage.empty": "Op dit apparaat zijn nog geen verwijderbare online scores opgeslagen.",
    "scoreManage.delete": "Verwijderen",
    "scoreManage.deleteAll": "Al mijn online scores verwijderen",
    "scoreManage.confirm": "Online scores verwijderen",
    "scoreManage.confirmText": "Deze inzendingen worden permanent uit het online klassement verwijderd.",
    "scoreManage.deleting": "Online score wordt verwijderd…",
    "scoreManage.deleted": "Online score verwijderd.",
    "scoreManage.deletedAll": "Alle opgeslagen online scores zijn verwijderd.",
    "scoreManage.deleteFailed": "De online score kon niet worden verwijderd.",
    "settings.deleteHint": "Verwijdert voortgang, munten, instellingen en lokale records. Online scores blijven bewaard.",
    "settings.warning": "Waarschuwing: ook de verwijdercodes voor online scores verdwijnen. Verwijder eerst je online scores als je ze niet wilt bewaren."
  },
  "zh-CN": {
    "privacy.footer": "隐私说明",
    "scoreManage.title": "我的在线分数",
    "scoreManage.hint": "这里只能删除在此设备上保存了删除密钥的记录。",
    "scoreManage.empty": "此设备上还没有可删除的在线分数。",
    "scoreManage.delete": "删除",
    "scoreManage.deleteAll": "删除我的全部在线分数",
    "scoreManage.confirm": "删除在线分数",
    "scoreManage.confirmText": "这些记录将从在线排行榜中永久删除。",
    "scoreManage.deleting": "正在删除在线分数…",
    "scoreManage.deleted": "在线分数已删除。",
    "scoreManage.deletedAll": "已删除此设备保存的全部在线分数。",
    "scoreManage.deleteFailed": "无法删除在线分数。",
    "settings.deleteHint": "删除此设备上的进度、金币、设置和本地纪录。在线分数会保留。",
    "settings.warning": "注意：在线分数的删除密钥也会被清除。如果不想保留在线分数，请先将其删除。"
  }
};

Object.entries(gameTextTranslations).forEach(([language, values]) => {
  Object.assign(translations[language], values);
});

Object.entries(privacyAndScoreTranslations).forEach(([language, values]) => {
  Object.assign(translations[language], values);
});

export function setupSettings() {
  const button = document.querySelector("#settingsBtn");
  const overlay = document.querySelector("#settingsOverlay");
  const closeButton = document.querySelector("#settingsCloseBtn");
  const languageSelect = document.querySelector("#settingsLanguage");
  const backgroundInput = document.querySelector("#backgroundImageInput");
  const presetButtons = [...document.querySelectorAll("[data-background-preset]")];
  const removeBackgroundButton = document.querySelector("#removeBackgroundBtn");
  const backgroundStatus = document.querySelector("#backgroundStatus");
  const deleteButton = document.querySelector("#deleteAllBtn");
  const warning = document.querySelector("#deleteWarning");
  const cancelDeleteButton = document.querySelector("#cancelDeleteBtn");
  const confirmDeleteButton = document.querySelector("#confirmDeleteBtn");

  let language = normalizeLanguage(localStorage.getItem(LANGUAGE_KEY));
  if (languageSelect) languageSelect.value = language;
  applyLanguage(language);
  applyStoredBackground(presetButtons);

  const close = () => {
    overlay?.classList.add("hidden");
    warning?.classList.add("hidden");
    button?.focus();
  };

  button?.addEventListener("click", () => {
    overlay?.classList.remove("hidden");
    closeButton?.focus();
  });
  closeButton?.addEventListener("click", close);
  overlay?.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !overlay?.classList.contains("hidden")) close();
  });

  languageSelect?.addEventListener("change", () => {
    language = normalizeLanguage(languageSelect.value);
    localStorage.setItem(LANGUAGE_KEY, language);
    applyLanguage(language);
  });

  presetButtons.forEach((presetButton) => {
    presetButton.addEventListener("click", () => {
      const preset = presetButton.dataset.backgroundPreset;
      if (!BACKGROUND_PRESETS.has(preset)) return;
      localStorage.setItem(BACKGROUND_PRESET_KEY, preset);
      applyPresetBackground(preset, presetButtons);
      setStatus(backgroundStatus, translate(language, "settings.backgroundSaved"));
    });
  });

  backgroundInput?.addEventListener("change", () => {
    const file = backgroundInput.files?.[0];
    if (!file || !file.type.startsWith("image/")) {
      setStatus(backgroundStatus, translate(language, "settings.backgroundInvalid"), true);
      return;
    }
    if (file.size > MAX_BACKGROUND_SIZE) {
      setStatus(backgroundStatus, translate(language, "settings.backgroundTooLarge"), true);
      backgroundInput.value = "";
      return;
    }
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const value = typeof reader.result === "string" ? reader.result : "";
      if (!value.startsWith("data:image/")) {
        setStatus(backgroundStatus, translate(language, "settings.backgroundInvalid"), true);
        return;
      }
      try {
        localStorage.setItem(BACKGROUND_KEY, value);
        localStorage.setItem(BACKGROUND_PRESET_KEY, "custom");
        applyCustomBackground(value, presetButtons);
        setStatus(backgroundStatus, translate(language, "settings.backgroundSaved"));
      } catch {
        setStatus(backgroundStatus, translate(language, "settings.backgroundTooLarge"), true);
      }
    });
    reader.readAsDataURL(file);
  });

  removeBackgroundButton?.addEventListener("click", () => {
    localStorage.removeItem(BACKGROUND_KEY);
    localStorage.setItem(BACKGROUND_PRESET_KEY, "neon");
    applyPresetBackground("neon", presetButtons);
    if (backgroundInput) backgroundInput.value = "";
    setStatus(backgroundStatus, translate(language, "settings.backgroundRemoved"));
  });

  deleteButton?.addEventListener("click", () => {
    warning?.classList.remove("hidden");
    confirmDeleteButton?.focus();
  });
  cancelDeleteButton?.addEventListener("click", () => warning?.classList.add("hidden"));
  confirmDeleteButton?.addEventListener("click", () => {
    localStorage.clear();
    window.location.reload();
  });
}

function applyLanguage(language) {
  currentLanguage = normalizeLanguage(language);
  document.documentElement.lang = language;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = translate(language, element.dataset.i18n);
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
    element.setAttribute("placeholder", translate(language, element.dataset.i18nPlaceholder));
  });
  document.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
    element.setAttribute("aria-label", translate(language, element.dataset.i18nAriaLabel));
  });
  window.dispatchEvent(new CustomEvent("languagechange", { detail: { language: currentLanguage } }));
}

function translate(language, key) {
  return translations[language]?.[key] || translations.en[key] || translations.de[key] || key;
}

function normalizeLanguage(language) {
  return SUPPORTED_LANGUAGES.has(language) ? language : "de";
}

export function t(key) {
  return translate(currentLanguage, key);
}

export function tf(key, values = {}) {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    t(key)
  );
}

export function getCurrentLanguage() {
  return currentLanguage;
}

function applyStoredBackground(presetButtons) {
  const preset = localStorage.getItem(BACKGROUND_PRESET_KEY);
  const stored = localStorage.getItem(BACKGROUND_KEY);
  if (preset === "custom" && stored?.startsWith("data:image/")) {
    applyCustomBackground(stored, presetButtons);
    return;
  }
  applyPresetBackground(BACKGROUND_PRESETS.has(preset) ? preset : "neon", presetButtons);
}

function applyCustomBackground(value, presetButtons) {
  activeBackground = "custom";
  document.body.dataset.backgroundTheme = "custom";
  document.documentElement.style.setProperty("--custom-background", `url("${value}")`);
  document.body.classList.add("custom-background");
  updatePresetSelection(presetButtons, "");
  loadCustomArenaImage(value);
}

function applyPresetBackground(preset, presetButtons) {
  activeBackground = BACKGROUND_PRESETS.has(preset) ? preset : "neon";
  customArenaImage = null;
  document.body.dataset.backgroundTheme = activeBackground;
  document.documentElement.style.removeProperty("--custom-background");
  document.body.classList.remove("custom-background");
  updatePresetSelection(presetButtons, activeBackground);
}

function updatePresetSelection(presetButtons, selectedPreset) {
  presetButtons.forEach((button) => {
    const selected = button.dataset.backgroundPreset === selectedPreset;
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function loadCustomArenaImage(value) {
  const image = new Image();
  image.addEventListener("load", () => {
    if (activeBackground === "custom") customArenaImage = image;
  });
  image.src = value;
}

function setStatus(element, message, error = false) {
  if (!element) return;
  element.textContent = message;
  element.dataset.state = error ? "error" : "ok";
}

export function drawArenaBackground(ctx, canvas) {
  if (activeBackground === "custom" && customArenaImage?.complete) {
    drawCoverImage(ctx, canvas, customArenaImage);
    ctx.fillStyle = "rgba(4, 8, 14, 0.58)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return { grid: "rgba(255,255,255,0.11)", border: "rgba(56,216,255,0.52)" };
  }

  const themes = {
    neon: {
      colors: ["#07121b", "#090b10", "#15101a"],
      grid: "rgba(56,216,255,0.11)",
      border: "rgba(183,255,74,0.28)"
    },
    space: {
      colors: ["#020617", "#11123b", "#1c0b35"],
      grid: "rgba(135,168,255,0.13)",
      border: "rgba(151,126,255,0.48)"
    },
    sunset: {
      colors: ["#281044", "#6e2148", "#c45132"],
      grid: "rgba(255,210,148,0.13)",
      border: "rgba(255,188,92,0.5)"
    },
    ice: {
      colors: ["#061b2b", "#0b3a50", "#146b77"],
      grid: "rgba(187,244,255,0.14)",
      border: "rgba(174,246,255,0.56)"
    }
  };
  const theme = themes[activeBackground] || themes.neon;
  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, theme.colors[0]);
  gradient.addColorStop(0.55, theme.colors[1]);
  gradient.addColorStop(1, theme.colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  drawThemeDetails(ctx, canvas, activeBackground);
  return theme;
}

function drawThemeDetails(ctx, canvas, theme) {
  ctx.save();
  if (theme === "space") {
    ctx.fillStyle = "rgba(255,255,255,0.56)";
    for (let index = 0; index < 46; index += 1) {
      const x = (index * 197) % canvas.width;
      const y = (index * 83) % canvas.height;
      const size = index % 7 === 0 ? 2.2 : 1.1;
      ctx.fillRect(x, y, size, size);
    }
    const planet = ctx.createRadialGradient(canvas.width * 0.82, 105, 8, canvas.width * 0.82, 105, 90);
    planet.addColorStop(0, "rgba(193,171,255,0.38)");
    planet.addColorStop(1, "rgba(95,66,180,0)");
    ctx.fillStyle = planet;
    ctx.beginPath();
    ctx.arc(canvas.width * 0.82, 105, 90, 0, Math.PI * 2);
    ctx.fill();
  } else if (theme === "sunset") {
    const sun = ctx.createRadialGradient(canvas.width * 0.76, 125, 5, canvas.width * 0.76, 125, 115);
    sun.addColorStop(0, "rgba(255,234,166,0.72)");
    sun.addColorStop(0.42, "rgba(255,151,89,0.3)");
    sun.addColorStop(1, "rgba(255,95,94,0)");
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  } else if (theme === "ice") {
    ctx.strokeStyle = "rgba(190,247,255,0.13)";
    ctx.lineWidth = 3;
    for (let x = -100; x < canvas.width + 150; x += 170) {
      ctx.beginPath();
      ctx.moveTo(x, canvas.height);
      ctx.lineTo(x + 120, 0);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawCoverImage(ctx, canvas, image) {
  const scale = Math.max(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;
  ctx.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
}
