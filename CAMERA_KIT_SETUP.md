# Snap Camera Kit Web – Camera Arcade einrichten

Camera Kit ist als eigenständiges Testspiel unter `test-chatgpt/camera-kit/` eingebaut. Die Camera Arcade enthält ein freies Lens-Labor sowie mehrere kurze Kamera-Minispiele. Der SDK-Bundle wird erst geladen, wenn der Testzugriff bestätigt ist und der Nutzer die Kamera startet. Ein Mikrofon wird nicht angefordert.

## 1. Werte im Snap Developer Portal prüfen

Unter **Camera Kit → Apps → Initial Version** werden benötigt:

- der **Staging API Token** für Web;
- die **Demo Lens Group ID**;
- unter **Platform Identifiers / Trusted Origins** die Ursprünge, auf denen getestet wird.

Für die mitgelieferte lokale Konfiguration sind das:

```text
http://127.0.0.1:8915
http://localhost:8915
```

Für den geschützten Online-Testbereich zusätzlich:

```text
https://ddmeer321.github.io
```

## 2. Lokal mit `.env.local` testen

Im Repo-Hauptordner neben `.env.example` eine Datei namens `.env.local` anlegen:

```dotenv
SNAP_CAMERA_KIT_API_TOKEN=HIER_DEN_STAGING_API_TOKEN_EINTRAGEN
SNAP_CAMERA_KIT_LENS_GROUP_ID=HIER_DIE_DEMO_LENS_GROUP_ID_EINTRAGEN
LOCAL_HOST=127.0.0.1
LOCAL_PORT=8915
```

`.env.local` wird durch `.gitignore` ausgeschlossen. Der lokale Server liest die Werte nur im Arbeitsspeicher und gibt sie nicht im Terminal aus.

Danach:

```powershell
npm install
npm run dev
```

`http://127.0.0.1:8915/test-chatgpt/camera-kit/` öffnen und mit einem Tester-, Admin- oder Owner-Konto anmelden. **Camera Arcade starten** wird verfügbar, sobald beide Werte geladen wurden.

## 3. Geschützten Online-Testbereich konfigurieren

GitHub Pages kann keine `.env.local` lesen. Online lädt die Testseite die Konfiguration deshalb aus der Supabase Edge Function `camera-kit-config`. Diese Funktion prüft serverseitig die aktuelle Supabase-Sitzung und gibt die Werte nur für `tester`, `admin` oder `owner` aus.

Im Supabase Dashboard unter **Edge Functions → Secrets** exakt diese beiden Einträge anlegen:

```text
SNAP_CAMERA_KIT_API_TOKEN       = dein Staging API Token
SNAP_CAMERA_KIT_LENS_GROUP_ID   = deine Demo Lens Group ID
```

Alternativ mit der Supabase CLI:

```powershell
supabase secrets set SNAP_CAMERA_KIT_API_TOKEN="..." SNAP_CAMERA_KIT_LENS_GROUP_ID="..."
```

Die Werte gehören niemals in `supabase/functions/camera-kit-config/index.ts`, eine HTML-Datei oder einen Commit. Änderungen an Edge-Function-Secrets stehen laut Supabase ohne erneutes Deployment bereit.

Wichtig: Camera Kit Web übergibt den API-Token im Browser an `bootstrapCameraKit`. Ein berechtigter Tester kann ihn deshalb technisch sehen. Die serverseitige Rollenprüfung verhindert die allgemeine Ausgabe, aber der eigentliche Missbrauchsschutz sind die **Trusted Origins** im Snap Developer Portal. Der Token ist kein serverseitig geheim haltbarer Schlüssel.

## 4. Staging und spätere Veröffentlichung

Mit dem Staging-Token erscheint absichtlich ein Camera-Kit-Staging-Wasserzeichen und es gelten niedrigere Limits. Die Camera Arcade bleibt im geschützten Ordner `test-chatgpt` und wird nicht auf der öffentlichen Spielebibliothek verlinkt.

Vor einer öffentlichen Veröffentlichung:

1. Camera-Kit-App bei Snap zur Prüfung einreichen.
2. Öffentliche Datenschutz-URL und Demo-Video im Portal hinterlegen.
3. Den Production API Token statt des Staging-Tokens verwenden.
4. Datenschutzerklärung und tatsächlichen Funktionsumfang erneut abgleichen.
5. Kamerazugriff, Lens-Auswahl, Ablehnen der Snap-Nutzungsbedingungen und Aufräumen beim Schließen auf unterstützten Browsern testen.

## Technische Hinweise

- Snap nennt als Mindestversionen Chrome 95+, Edge 79+ und Safari 16+; Firefox wird weiterhin geprüft.
- Das Spiel fordert die Kamera mit `audio: false` an.
- Live-Bilder und Schnappschüsse bleiben im Arbeitsspeicher des Browsers und werden weder hochgeladen noch dauerhaft gespeichert.
- Nur der lokale Bestwert wird in `localStorage` gespeichert.
- Beim Verlassen der Seite oder Beenden der Arcade werden alle Kamera-Tracks gestoppt und Camera Kit wird zerstört.
- Die von Camera Kit bereitgestellte Nutzungsbedingungen-Abfrage erscheint vor der ersten Lens-Anwendung und wird nicht ersetzt oder verändert.
