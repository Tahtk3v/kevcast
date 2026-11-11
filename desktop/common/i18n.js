// Translations for the desktop apps' own windows, menus and dialogs (the Web Studio and the player
// pages come from the server and use shared/i18n.js). Follows the operating system's language.
const { app } = require('electron');

const SUPPORTED = ['en', 'nl', 'de'];
let lang = null;
function current() {
  if (lang) return lang;
  let list = [];
  try { list = app.getPreferredSystemLanguages(); } catch {}
  if (!list || !list.length) { try { list = [app.getLocale()]; } catch {} }
  lang = 'en';
  for (const l of list || []) {
    const code = String(l || '').toLowerCase().split(/[-_]/)[0];
    if (SUPPORTED.includes(code)) { lang = code; break; }
  }
  return lang;
}

const NL = {
  'Preview — KevCast': 'Voorbeeld — KevCast',
  "Can't reach the KevCast server at {url}": 'De KevCast-server op {url} is niet bereikbaar',
  'Try again': 'Opnieuw proberen',
  'Choose another server': 'Andere server kiezen',
  Quit: 'Afsluiten',
  File: 'Bestand',
  'Upload files…': 'Bestanden uploaden…',
  'New playlist': 'Nieuwe afspeellijst',
  'Connect to another server…': 'Met een andere server verbinden…',
  'Recent servers': 'Recente servers',
  'Open in web browser': 'Openen in webbrowser',
  Go: 'Ga naar',
  Dashboard: 'Dashboard',
  Media: 'Media',
  Playlists: 'Afspeellijsten',
  Schedule: 'Planning',
  Displays: 'Schermen',
  Groups: 'Groepen',
  Settings: 'Instellingen',
  View: 'Beeld',
  'KevCast Studio {version} — connected to {server}': 'KevCast Studio {version} — verbonden met {server}',
  nothing: 'niets',
  'Connect to the KevCast server you want to manage.': 'Verbind met de KevCast-server die je wilt beheren.',
  'This screen is not connected yet. Pick your KevCast server — after that, everything is managed from the admin.': 'Dit scherm is nog niet verbonden. Kies je KevCast-server; daarna regel je alles vanuit de Web Studio.',
  'That does not look like a valid address.': 'Dat lijkt geen geldig adres.',
  'Could not reach a KevCast server at {url}: {error}': 'Geen KevCast-server bereikbaar op {url}: {error}',
  'No answer from this address': 'Geen antwoord van dit adres',
  'Not a KevCast server': 'Dit is geen KevCast-server',
  'Connect to KevCast': 'Verbinden met KevCast',
  'Ctrl+Shift+K opens this screen again later.': 'Met Ctrl+Shift+K open je dit scherm later opnieuw.',
  'Choose the KevCast server to connect to.': 'Kies de KevCast-server waarmee je wilt verbinden.',
  'Servers found on your network': 'Servers op je netwerk',
  'Searching…': 'Zoeken…',
  'Search again': 'Opnieuw zoeken',
  'Or enter the address': 'Of typ het adres',
  'e.g. 192.168.1.20 or kevcast.company.local:8080': 'bijv. 192.168.1.20 of kevcast.bedrijf.local:8080',
  Connect: 'Verbinden',
  Cancel: 'Annuleren',
  'Could not connect': 'Verbinden is niet gelukt',
  'No servers found automatically. Enter the address below (shown on the server when it starts).': 'Geen servers automatisch gevonden. Typ hieronder het adres (de server toont het bij het starten).',
  'KevCast server': 'KevCast-server',
  'Connect →': 'Verbinden →',
  'Current: {url}': 'Nu: {url}',
  'Everything KevCast can show': 'Alles wat KevCast kan tonen',
  'PowerPoint & PDF': 'PowerPoint en pdf',
  Images: 'Afbeeldingen',
  Videos: "Video's",
  Desktop: 'Bureaublad',
  Documents: 'Documenten',
  Downloads: 'Downloads',
  Pictures: 'Afbeeldingen',
  Home: 'Persoonlijke map',
  'Drive {letter}:': 'Station {letter}:',
  'Upload failed ({status})': 'Uploaden mislukt ({status})',
  'This file type is not supported': 'Dit bestandstype wordt niet ondersteund',
  'No permission to open this folder': 'Geen toestemming om deze map te openen',
  'Choose files to upload to KevCast': 'Kies bestanden om naar KevCast te uploaden',
  'Open a folder': 'Een map openen',
  'PowerPoint could not convert this file ({error}); the server converts it instead.': 'PowerPoint kon dit bestand niet omzetten ({error}); de server zet het om.',
};
const DE = {
  'Preview — KevCast': 'Vorschau — KevCast',
  "Can't reach the KevCast server at {url}": 'Der KevCast-Server unter {url} ist nicht erreichbar',
  'Try again': 'Erneut versuchen',
  'Choose another server': 'Anderen Server wählen',
  Quit: 'Beenden',
  File: 'Datei',
  'Upload files…': 'Dateien hochladen…',
  'New playlist': 'Neue Playlist',
  'Connect to another server…': 'Mit anderem Server verbinden…',
  'Recent servers': 'Zuletzt verwendete Server',
  'Open in web browser': 'Im Webbrowser öffnen',
  Go: 'Gehe zu',
  Dashboard: 'Übersicht',
  Media: 'Medien',
  Playlists: 'Playlists',
  Schedule: 'Zeitplan',
  Displays: 'Bildschirme',
  Groups: 'Gruppen',
  Settings: 'Einstellungen',
  View: 'Ansicht',
  'KevCast Studio {version} — connected to {server}': 'KevCast Studio {version} — verbunden mit {server}',
  nothing: 'nichts',
  'Connect to the KevCast server you want to manage.': 'Verbinden Sie sich mit dem KevCast-Server, den Sie verwalten möchten.',
  'This screen is not connected yet. Pick your KevCast server — after that, everything is managed from the admin.': 'Dieser Bildschirm ist noch nicht verbunden. Wählen Sie Ihren KevCast-Server; danach wird alles im Web Studio verwaltet.',
  'That does not look like a valid address.': 'Das sieht nicht wie eine gültige Adresse aus.',
  'Could not reach a KevCast server at {url}: {error}': 'Kein KevCast-Server erreichbar unter {url}: {error}',
  'No answer from this address': 'Keine Antwort von dieser Adresse',
  'Not a KevCast server': 'Das ist kein KevCast-Server',
  'Connect to KevCast': 'Mit KevCast verbinden',
  'Ctrl+Shift+K opens this screen again later.': 'Mit Strg+Umschalt+K öffnen Sie dieses Fenster später erneut.',
  'Choose the KevCast server to connect to.': 'Wählen Sie den KevCast-Server, mit dem Sie sich verbinden möchten.',
  'Servers found on your network': 'Server in Ihrem Netzwerk',
  'Searching…': 'Suche läuft…',
  'Search again': 'Erneut suchen',
  'Or enter the address': 'Oder Adresse eingeben',
  'e.g. 192.168.1.20 or kevcast.company.local:8080': 'z. B. 192.168.1.20 oder kevcast.firma.local:8080',
  Connect: 'Verbinden',
  Cancel: 'Abbrechen',
  'Could not connect': 'Verbindung fehlgeschlagen',
  'No servers found automatically. Enter the address below (shown on the server when it starts).': 'Keine Server automatisch gefunden. Geben Sie unten die Adresse ein (der Server zeigt sie beim Start an).',
  'KevCast server': 'KevCast-Server',
  'Connect →': 'Verbinden →',
  'Current: {url}': 'Aktuell: {url}',
  'Everything KevCast can show': 'Alles, was KevCast anzeigen kann',
  'PowerPoint & PDF': 'PowerPoint & PDF',
  Images: 'Bilder',
  Videos: 'Videos',
  Desktop: 'Schreibtisch',
  Documents: 'Dokumente',
  Downloads: 'Downloads',
  Pictures: 'Bilder',
  Home: 'Persönlicher Ordner',
  'Drive {letter}:': 'Laufwerk {letter}:',
  'Upload failed ({status})': 'Hochladen fehlgeschlagen ({status})',
  'This file type is not supported': 'Dieser Dateityp wird nicht unterstützt',
  'No permission to open this folder': 'Keine Berechtigung, diesen Ordner zu öffnen',
  'Choose files to upload to KevCast': 'Dateien zum Hochladen in KevCast auswählen',
  'Open a folder': 'Ordner öffnen',
  'PowerPoint could not convert this file ({error}); the server converts it instead.': 'PowerPoint konnte diese Datei nicht umwandeln ({error}); der Server wandelt sie stattdessen um.',
};
const DICTS = { nl: NL, de: DE };

function t(key, vars) {
  const d = DICTS[current()];
  const text = (d && d[key]) || key;
  return text.replace(/\{(\w+)\}/g, (m, k) => (vars && vars[k] !== undefined ? String(vars[k]) : m));
}
/** All translations for a list of keys, for a renderer window. */
function strings(keys) {
  const out = {};
  for (const k of keys) out[k] = t(k);
  return out;
}

module.exports = { t, strings, lang: current };
