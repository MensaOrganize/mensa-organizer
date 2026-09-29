# Mensa Organizer

Lokaler Hackdays-Prototyp für:
- Kostenlose Vorbestellungen für die Vorführung
- Anzeige der aktuellen Schlangenlänge
- Ampelstatus 0–4 / 5–6 / 7+
- Mitarbeiterbereich
- Status „abholbereit“ bzw. „abgeschlossen“
- vorbereitete WLAN-API für Arduino

## 1. Voraussetzungen

Node.js installieren. Danach in diesem Ordner ein Terminal öffnen.

## 2. Abhängigkeiten installieren

```bash
npm install
```

## 3. Server starten

```bash
npm start
```

Danach im Browser öffnen:

http://localhost:3000

## 4. Mitarbeiterbereich

Standard-Demo-Passwort:

mensa2026

Für euren Hackday könnt ihr das Passwort vor dem Start ändern.

Windows PowerShell:
```powershell
$env:STAFF_PASSWORD="EuerPasswort"
npm start
```

macOS/Linux:
```bash
STAFF_PASSWORD="EuerPasswort" npm start
```

## 5. Auf Handy/Tablet im gleichen WLAN öffnen

Der Node-Server hört auf allen Netzwerk-Schnittstellen.

Findet die lokale IP des Laptops, z. B. `192.168.178.42`, und öffnet:

http://192.168.178.42:3000

Falls die Windows-Firewall fragt, muss Node.js im privaten Netzwerk zugelassen werden.

## 6. Arduino-WLAN-Anbindung

Die Website besitzt bereits diese Schnittstellen:

GET /api/arduino/queue
-> aktuelle Personenzahl und Ampelstatus

POST /api/arduino/queue
-> Personenzahl setzen, z. B.:
{"count": 8}

GET /api/arduino/ready
-> nächste Bestellung mit Status "abholbereit"

Beispielantwort:
```json
{
  "number": 17,
  "status": "abholbereit",
  "items": [
    {
      "name": "Cheeseburger",
      "quantity": 1
    }
  ]
}
```

Der Arduino kann später mit seinem WLAN-Modul regelmäßig `/api/arduino/ready`
abfragen und bei einer neuen abholbereiten Bestellung die Bestellnummer auf
dem LCD anzeigen.

## Wichtig zum Arduino Uno

Der Website-Code kommuniziert noch NICHT direkt mit eurem konkreten
WLAN-Modul. Die HTTP-API ist vorbereitet.

Je nachdem, welches Modul ihr verwendet (z. B. ESP8266, ESP-01, Arduino
WiFi Shield oder anderes Modul), braucht ihr danach einen passenden
Arduino-Sketch für dieses Modul.

## Daten

Bestellungen werden lokal in `data.json` gespeichert. Für einen Hackdays-
Prototyp ist das praktisch; für einen echten Mensabetrieb sollte später eine
richtige Datenbank und Authentifizierung verwendet werden.

## Öffentlich über das Internet erreichbar machen

Der Server ist bereits für Hosting vorbereitet (`PORT` wird aus der Umgebungsvariable gelesen und der Server bindet an `0.0.0.0`).

Eine einfache Möglichkeit für den Hackday ist ein Node.js-Webservice bei Render. Render dokumentiert die Bereitstellung von Express-Apps und vergibt nach dem Deployment eine öffentliche `onrender.com`-Adresse.

### Deployment
1. Das Projekt in ein GitHub-Repository hochladen.
2. Bei Render anmelden und **New -> Web Service** auswählen.
3. Das GitHub-Repository verbinden.
4. Build Command: `npm install`
5. Start Command: `npm start`
6. Als Environment Variable `STAFF_PASSWORD` ein eigenes Mitarbeiterpasswort setzen.
7. Deploy starten.
8. Die danach angezeigte `https://...onrender.com`-Adresse ist eure öffentliche Website.

### Wichtig bei der kostenlosen Variante
Die kostenlose Render-Variante kann nach Inaktivität pausieren und das lokale Dateisystem ist nicht dauerhaft. Dadurch können Bestellungen bzw. die lokale `data.json` nach einem Neustart verloren gehen. Für eine Hackday-Demo ist das meist okay; für einen dauerhaften Mensabetrieb sollte später eine echte Datenbank verwendet werden.
