
import './styles.css';
import { api, auth } from '@appdeploy/client';
import * as Blockly from 'blockly';
import initSqlJs, { type Database } from 'sql.js';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { V86, type V86Options } from 'v86';

type RuntimeKind = 'iframe' | 'controlled' | 'automation' | 'sqlite' | 'python' | 'terminal' | 'files' | 'vmception';
type Category = 'Systeme' | 'Coding' | 'Kreativ' | 'Tools' | 'Chaos';

type AppDef = {
  id: string;
  title: string;
  icon: string;
  category: Category;
  description: string;
  kind: RuntimeKind;
  url?: string;
  externalUrl?: string;
  helper?: string;
  command?: string;
  heavy?: boolean;
};

type Project = {
  id: string;
  name: string;
  workspace: string;
  createdAt: string;
};

type VmProfile = {
  title: string;
  options: Partial<V86Options>;
};

type VmSession = {
  emulator: V86;
  profileId: string;
  startedAt: number;
  cursorX: number;
  cursorY: number;
};

type DriveFile = {
  path: string;
  data: Uint8Array;
  updatedAt: number;
};

type SnapshotRecord = {
  id: string;
  profileId: string;
  name: string;
  createdAt: number;
  size: number;
  state: ArrayBuffer;
};

const V86_WASM = 'https://cdn.jsdelivr.net/npm/v86@0.5/build/v86.wasm';
const V86_ROOT = 'https://copy.sh/v86/';
const IMAGE_ROOT = 'https://i.copy.sh/';
const PYODIDE_INDEX = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
const ARCH_URL = V86_ROOT + '?profile=archlinux';

const VM_PROFILES: Record<string, VmProfile> = {
  arch: {
    title: 'Arch Linux',
    options: {
      memory_size: 512 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      initial_state: { url: IMAGE_ROOT + 'arch_state-v3.bin.zst' },
      filesystem: { baseurl: IMAGE_ROOT + 'arch/' },
      net_device: { type: 'virtio' },
    },
  },
  reactos: {
    title: 'ReactOS',
    options: {
      memory_size: 512 * 1024 * 1024,
      hda: {
        url: IMAGE_ROOT + 'reactos-v3/.img',
        size: 734003200,
        async: true,
        fixed_chunk_size: 1024 * 1024,
        use_parts: true,
      },
      initial_state: { url: IMAGE_ROOT + 'reactos_state-v3.bin.zst' },
      net_device: { type: 'virtio' },
      acpi: true,
    },
  },
  android: {
    title: 'Android-x86',
    options: {
      memory_size: 512 * 1024 * 1024,
      cdrom: {
        url: IMAGE_ROOT + 'android-x86-1.6-r2/.iso',
        size: 54661120,
        async: true,
        fixed_chunk_size: 1024 * 1024,
        use_parts: true,
      },
    },
  },
  freedos: {
    title: 'FreeDOS',
    options: {
      memory_size: 64 * 1024 * 1024,
      fda: { url: IMAGE_ROOT + 'freedos722.img' },
    },
  },
};

const APPS: AppDef[] = [
  { id: 'scratch', title: 'Scratch', icon: '🧩', category: 'Coding', description: 'Offizieller Scratch-GUI-Build.', kind: 'iframe', url: 'https://scratchfoundation.github.io/scratch-gui/', externalUrl: 'https://scratchfoundation.github.io/scratch-gui/' },
  { id: 'scratchvm', title: 'Scratch → VM', icon: '🧩', category: 'Coding', description: 'Scratch-artige BlockVM-Blöcke für VM-Start, Tastatur, Klicks, Screenshots und Snapshots.', kind: 'automation' },
  { id: 'lubuntu', title: 'Lubuntu ISO Lab', icon: '🐧', category: 'Systeme', description: 'v86-Slot für dein eigenes Lubuntu-ISO.', kind: 'iframe', url: V86_ROOT, externalUrl: V86_ROOT, helper: 'Lubuntu bleibt ein ISO-Slot: bei CD image dein ISO auswählen. Ein komplettes Lubuntu-Image wird nicht ungefragt geladen.', heavy: true },
  { id: 'android', title: 'Android-x86', icon: '🤖', category: 'Systeme', description: 'Direkt eingebettete, steuerbare Android-x86-v86-VM.', kind: 'controlled', externalUrl: V86_ROOT + '?profile=android', heavy: true },
  { id: 'reactos', title: 'ReactOS', icon: '🖥️', category: 'Systeme', description: 'Direkt eingebettete ReactOS-VM mit Input- und Snapshot-Bridge.', kind: 'controlled', externalUrl: V86_ROOT + '?profile=reactos', heavy: true },
  { id: 'arch', title: 'Arch Linux', icon: '🐧', category: 'Systeme', description: 'Steuerbares Arch Linux mit v86 9p-Dateibrücke.', kind: 'controlled', externalUrl: ARCH_URL, heavy: true },
  { id: 'windows98', title: 'Windows 98', icon: '🪟', category: 'Systeme', description: 'Externer v86-Slot; BlockVM hostet kein eigenes Windows-Image.', kind: 'iframe', url: V86_ROOT + '?profile=windows98', externalUrl: V86_ROOT + '?profile=windows98', heavy: true },
  { id: 'freedos', title: 'FreeDOS', icon: '🕹️', category: 'Systeme', description: 'Winzige steuerbare FreeDOS-VM – perfekt für Automationstests.', kind: 'controlled', externalUrl: V86_ROOT + '?profile=freedos' },
  { id: 'firefox', title: 'Firefox in Arch', icon: '🌐', category: 'Tools', description: 'Firefox steckt im Arch-v86-Profil.', kind: 'controlled', externalUrl: ARCH_URL, helper: 'Nach Xorg Firefox starten.', command: 'firefox', heavy: true },
  { id: 'code', title: 'VS Code Web', icon: '💻', category: 'Coding', description: 'VS-Code-artiger Browser-Editor.', kind: 'iframe', url: 'https://vscode.dev/', externalUrl: 'https://vscode.dev/' },
  { id: 'jupyter', title: 'JupyterLite', icon: '📓', category: 'Coding', description: 'JupyterLite bleibt als Notebook-Oberfläche verfügbar.', kind: 'iframe', url: 'https://jupyter.org/try-jupyter/lab/', externalUrl: 'https://jupyter.org/try-jupyter/lab/', heavy: true },
  { id: 'python', title: 'Python Lab', icon: '🐍', category: 'Coding', description: 'Eigenes Pyodide-Terminal/Editor mit BlockVM-Dateibrücke.', kind: 'python', heavy: true },
  { id: 'terminal', title: 'BlockVM Terminal', icon: '⌨️', category: 'Coding', description: 'vm start, vm type, vm click, snapshot, python, sql und open.', kind: 'terminal' },
  { id: 'drive', title: 'Shared Drive', icon: '📁', category: 'Tools', description: 'Gemeinsames virtuelles Laufwerk für Python, Browser-Tools und Arch 9p.', kind: 'files' },
  { id: 'excalidraw', title: 'Excalidraw', icon: '🎨', category: 'Kreativ', description: 'Whiteboard direkt im Browser.', kind: 'iframe', url: 'https://excalidraw.com/', externalUrl: 'https://excalidraw.com/' },
  { id: 'blockly', title: 'Blockly Automation', icon: '🧱', category: 'Coding', description: 'Programmatische VM-Ketten mit echtem Input, Screenshot und Snapshots.', kind: 'automation' },
  { id: 'sqlite', title: 'SQLite Lab', icon: '🗄️', category: 'Coding', description: 'SQLite via WebAssembly mit Query-Playground.', kind: 'sqlite' },
  { id: 'libreoffice', title: 'LibreOffice', icon: '📄', category: 'Tools', description: 'Desktop-App-Slot über Arch.', kind: 'controlled', externalUrl: 'https://www.libreoffice.org/', helper: 'Arch starten und falls verfügbar/installiert:', command: 'libreoffice --writer', heavy: true },
  { id: 'krita', title: 'Krita', icon: '🖌️', category: 'Kreativ', description: 'Krita-Slot über Arch.', kind: 'controlled', externalUrl: 'https://krita.org/', helper: 'Arch starten und falls verfügbar/installiert:', command: 'krita', heavy: true },
  { id: 'audacity', title: 'Audacity', icon: '🎵', category: 'Kreativ', description: 'Audacity-Slot über Arch.', kind: 'controlled', externalUrl: 'https://www.audacityteam.org/', helper: 'Arch starten und falls verfügbar/installiert:', command: 'audacity', heavy: true },
  { id: 'godot', title: 'Godot Web Editor', icon: '🎮', category: 'Coding', description: 'Offizieller Godot-Web-Editor.', kind: 'iframe', url: 'https://editor.godotengine.org/releases/latest/', externalUrl: 'https://editor.godotengine.org/releases/latest/', heavy: true },
  { id: 'blender', title: 'Blender', icon: '🧊', category: 'Kreativ', description: 'Experiment-Slot über Arch.', kind: 'controlled', externalUrl: 'https://www.blender.org/download/', helper: 'Aktuelles Blender ist für den 32-bit-v86-Stack praktisch zu schwer. Der Befehl bleibt als Experiment drin. 💀', command: 'blender', heavy: true },
  { id: 'vmception', title: 'VMception', icon: '🧬', category: 'Chaos', description: 'BlockVM in BlockVM mit Depth-Breadcrumb und Achievement.', kind: 'vmception', heavy: true },
];
const CATEGORIES: Array<'Alle' | Category> = ['Alle', 'Systeme', 'Coding', 'Kreativ', 'Tools', 'Chaos'];

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) throw new Error('Missing #app');

app.innerHTML = `
<div class="app-shell">
  <header class="topbar">
    <button class="brand-button" id="homeButton" type="button"><span class="logo">B</span><span><strong>BlockVM V4</strong><small>VM automation platform</small></span></button>
    <div class="depth-path" id="depthPath"></div>
    <div class="top-actions">
      <span class="running-pill" id="runningPill">0 Runtimes</span>
      <label class="toggle"><input id="tortureToggle" type="checkbox"><span>🔥 Torture</span></label>
      <button class="button panic" id="panicButton" type="button">🚨 SAVE THE IPAD</button>
      <button class="button secondary" id="projectsButton" type="button">💾 Projekte</button>
      <button class="button secondary" id="authButton" type="button">Anmelden</button>
    </div>
  </header>

  <div class="hud" id="hud">
    <span><b id="hudFps">60</b> FPS</span>
    <span><b id="hudRuntimes">0</b> Runtimes</span>
    <span><b id="hudRam">0 MB</b> est. VM RAM</span>
    <span><b id="hudUptime">0s</b> Laufzeit</span>
    <span class="suffering">🔥 <b id="hudSuffering">0</b>/100 SUFFERING</span>
  </div>

  <main class="layout" id="appsView">
    <aside class="sidebar">
      <div class="side-title"><strong>Launcher</strong><span id="appCount"></span></div>
      <input class="search" id="searchInput" placeholder="App suchen…" autocomplete="off">
      <div class="category-list" id="categoryList"></div>
      <div class="tiny-warning">Normal: eine schwere Runtime. Torture Mode: bis zu 4. Panic zerstört VMs, iframes, Blockly, SQLite und Python-Referenzen ohne Reload.</div>
    </aside>
    <section class="workspace">
      <div class="catalog" id="catalog"></div>
      <div class="stage hidden" id="stage">
        <div class="stage-toolbar">
          <button class="button secondary" id="backToCatalog" type="button">← Launcher</button>
          <div class="active-title"><span id="activeIcon">⚙️</span><span><strong id="activeTitle">Runtime</strong><small id="activeStatus">bereit</small></span></div>
          <div class="stage-actions"><a class="button secondary hidden" id="externalLink" target="_blank" rel="noreferrer">Extern ↗</a><button class="button danger" id="stopActive" type="button">Stop</button></div>
        </div>
        <div class="helper hidden" id="helper"></div>
        <div class="runtime-stack" id="runtimeStack"></div>
      </div>
    </section>
  </main>

  <main class="projects-view hidden" id="projectsView">
    <div class="projects-head"><div><p class="eyebrow">ACCOUNT WORKSPACE</p><h1>Deine Projekte</h1><p>Launcher-Metadaten bleiben privat an deinen Account gebunden.</p></div><button class="button secondary" id="backFromProjects" type="button">← Zurück</button></div>
    <div class="auth-gate" id="authGate"><div class="lock">🔐</div><h2>Account erforderlich</h2><p>Melde dich an oder registriere dich, um Launcher-Projekte zu speichern.</p><button class="button primary" id="gateSignIn" type="button">Anmelden / Registrieren</button></div>
    <div class="project-area hidden" id="projectArea">
      <div class="profile-card"><span class="avatar big" id="profileAvatar">?</span><span class="profile-copy"><strong id="profileName">Account</strong><span id="profileEmail"></span></span><button class="button danger" id="signOutButton" type="button">Abmelden</button></div>
      <form class="create-card" id="projectForm"><span><strong>Neuer Workspace</strong><small>merkt sich, was du öffnen willst</small></span><input id="projectName" maxlength="80" placeholder="Projektname" required><select id="projectType"></select><button class="button primary" type="submit">Speichern</button></form>
      <div class="feedback" id="projectFeedback" aria-live="polite"></div><div class="projects-grid" id="projectsGrid"></div>
    </div>
  </main>

  <div class="achievement hidden" id="achievement">🏆 Achievement unlocked: <b>VMception Depth 3</b></div>
  <div class="toast hidden" id="toast"></div>
</div>`;

const catalog = document.querySelector<HTMLDivElement>('#catalog')!;
const stage = document.querySelector<HTMLDivElement>('#stage')!;
const runtimeStack = document.querySelector<HTMLDivElement>('#runtimeStack')!;
const helper = document.querySelector<HTMLDivElement>('#helper')!;
const activeIcon = document.querySelector<HTMLElement>('#activeIcon')!;
const activeTitle = document.querySelector<HTMLElement>('#activeTitle')!;
const activeStatus = document.querySelector<HTMLElement>('#activeStatus')!;
const externalLink = document.querySelector<HTMLAnchorElement>('#externalLink')!;
const runningPill = document.querySelector<HTMLElement>('#runningPill')!;
const tortureToggle = document.querySelector<HTMLInputElement>('#tortureToggle')!;
const searchInput = document.querySelector<HTMLInputElement>('#searchInput')!;
const categoryList = document.querySelector<HTMLDivElement>('#categoryList')!;
const appCount = document.querySelector<HTMLElement>('#appCount')!;
const appsView = document.querySelector<HTMLElement>('#appsView')!;
const projectsView = document.querySelector<HTMLElement>('#projectsView')!;
const authButton = document.querySelector<HTMLButtonElement>('#authButton')!;
const authGate = document.querySelector<HTMLDivElement>('#authGate')!;
const gateSignIn = document.querySelector<HTMLButtonElement>('#gateSignIn')!;
const projectArea = document.querySelector<HTMLDivElement>('#projectArea')!;
const projectForm = document.querySelector<HTMLFormElement>('#projectForm')!;
const projectName = document.querySelector<HTMLInputElement>('#projectName')!;
const projectType = document.querySelector<HTMLSelectElement>('#projectType')!;
const projectsGrid = document.querySelector<HTMLDivElement>('#projectsGrid')!;
const projectFeedback = document.querySelector<HTMLDivElement>('#projectFeedback')!;
const profileName = document.querySelector<HTMLElement>('#profileName')!;
const profileEmail = document.querySelector<HTMLElement>('#profileEmail')!;
const profileAvatar = document.querySelector<HTMLElement>('#profileAvatar')!;
const signOutButton = document.querySelector<HTMLButtonElement>('#signOutButton')!;
const hudFps = document.querySelector<HTMLElement>('#hudFps')!;
const hudRuntimes = document.querySelector<HTMLElement>('#hudRuntimes')!;
const hudRam = document.querySelector<HTMLElement>('#hudRam')!;
const hudUptime = document.querySelector<HTMLElement>('#hudUptime')!;
const hudSuffering = document.querySelector<HTMLElement>('#hudSuffering')!;
const toast = document.querySelector<HTMLDivElement>('#toast')!;
const achievement = document.querySelector<HTMLDivElement>('#achievement')!;
const depthPath = document.querySelector<HTMLDivElement>('#depthPath')!;

let selectedCategory: 'Alle' | Category = 'Alle';
let activeRuntimeId = '';
let currentUser: Awaited<ReturnType<typeof auth.getUser>> = null;
let projects: Project[] = [];
let sqliteDb: Database | null = null;
let pyodide: PyodideInterface | null = null;
let pyodideLoading: Promise<PyodideInterface> | null = null;
let activeAutomationWorkspace: Blockly.WorkspaceSvg | null = null;
let activeAutomationId = '';
const sessions = new Map<string, HTMLElement>();
const sessionOrder: string[] = [];
const vmSessions = new Map<string, VmSession>();
const vmBootPromises = new Map<string, Promise<VmSession>>();
const vmBootWatchdogs = new Map<string, number>();
const appStartedAt = performance.now();

function escapeHtml(value: string) {
  const node = document.createElement('span');
  node.textContent = value;
  return node.innerHTML;
}

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  window.setTimeout(() => toast.classList.add('hidden'), 2600);
}

function getApp(id: string) {
  return APPS.find((item) => item.id === id);
}

function runtimeProfileId(appId: string) {
  if (appId === 'firefox' || appId === 'libreoffice' || appId === 'krita' || appId === 'audacity' || appId === 'blender') return 'arch';
  return appId;
}

function openLocalDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('blockvm-v4', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('files')) db.createObjectStore('files', { keyPath: 'path' });
      if (!db.objectStoreNames.contains('snapshots')) db.createObjectStore('snapshots', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbPut(store: 'files' | 'snapshots', value: DriveFile | SnapshotRecord) {
  const db = await openLocalDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function idbGet<T>(store: 'files' | 'snapshots', key: string) {
  const db = await openLocalDb();
  return new Promise<T | undefined>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => resolve(req.result as T | undefined);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbAll<T>(store: 'files' | 'snapshots') {
  const db = await openLocalDb();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAll();
    req.onsuccess = () => resolve(req.result as T[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function idbDelete(store: 'files' | 'snapshots', key: string) {
  const db = await openLocalDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

function renderCategories() {
  categoryList.innerHTML = '';
  for (const category of CATEGORIES) {
    const button = document.createElement('button');
    button.className = 'category-button' + (selectedCategory === category ? ' active' : '');
    button.textContent = category;
    button.addEventListener('click', () => {
      selectedCategory = category;
      renderCategories();
      renderCatalog();
    });
    categoryList.appendChild(button);
  }
}

function renderCatalog() {
  const query = searchInput.value.trim().toLowerCase();
  const filtered = APPS.filter((item) => (selectedCategory === 'Alle' || item.category === selectedCategory) && (!query || (item.title + ' ' + item.description + ' ' + item.category).toLowerCase().includes(query)));
  appCount.textContent = APPS.length + ' Apps';
  catalog.innerHTML = '';
  for (const item of filtered) {
    const card = document.createElement('button');
    card.className = 'app-card';
    card.type = 'button';
    card.innerHTML = '<span class="app-icon">' + item.icon + '</span><span class="app-copy"><strong>' + escapeHtml(item.title) + '</strong><small>' + escapeHtml(item.description) + '</small></span><span class="badges"><em>' + escapeHtml(item.category) + '</em>' + (item.heavy ? '<em class="hot">heavy</em>' : '') + (item.kind === 'controlled' ? '<em class="live">VM API</em>' : '') + '</span>';
    card.addEventListener('click', () => void openRuntime(item.id));
    catalog.appendChild(card);
  }
  if (!filtered.length) catalog.innerHTML = '<div class="empty-state">Nichts gefunden. Selbst BlockVM hat Grenzen. 😭</div>';
}

function updateRunningPill() {
  runningPill.textContent = sessions.size + (sessions.size === 1 ? ' Runtime' : ' Runtimes');
}

function showCatalog() {
  stage.classList.add('hidden');
  catalog.classList.remove('hidden');
}

function showStage() {
  catalog.classList.add('hidden');
  stage.classList.remove('hidden');
}

function setHelper(item: AppDef) {
  if (!item.helper && !item.command) {
    helper.classList.add('hidden');
    helper.innerHTML = '';
    return;
  }
  helper.classList.remove('hidden');
  helper.innerHTML = (item.helper ? '<span>' + escapeHtml(item.helper) + '</span>' : '') + (item.command ? '<code>' + escapeHtml(item.command) + '</code>' : '');
}

async function destroySession(id: string) {
  const node = sessions.get(id);
  const profileId = runtimeProfileId(id);
  const vm = vmSessions.get(profileId);
  if (vm) {
    try {
      await vm.emulator.destroy();
    } catch {
      // Already destroyed.
    }
    vmSessions.delete(profileId);
    vmBootPromises.delete(profileId);
    const watchdog = vmBootWatchdogs.get(profileId);
    if (watchdog !== undefined) window.clearInterval(watchdog);
    vmBootWatchdogs.delete(profileId);
  }
  if (node) {
    const frame = node.querySelector<HTMLIFrameElement>('iframe');
    if (frame) frame.src = 'about:blank';
    node.remove();
    sessions.delete(id);
  }
  if ((id === 'blockly' || id === 'scratchvm') && activeAutomationWorkspace) {
    activeAutomationWorkspace.dispose();
    activeAutomationWorkspace = null;
    activeAutomationId = '';
  }
  if (id === 'sqlite' && sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  const orderIndex = sessionOrder.indexOf(id);
  if (orderIndex >= 0) sessionOrder.splice(orderIndex, 1);
  if (activeRuntimeId === id) activeRuntimeId = '';
  updateRunningPill();
}

async function stopAll(exceptId = '') {
  for (const id of Array.from(sessions.keys())) {
    if (id !== exceptId) await destroySession(id);
  }
}

async function panicStop() {
  await stopAll();
  if (activeAutomationWorkspace) {
    activeAutomationWorkspace.dispose();
    activeAutomationWorkspace = null;
  }
  if (sqliteDb) {
    sqliteDb.close();
    sqliteDb = null;
  }
  pyodide = null;
  pyodideLoading = null;
  runtimeStack.innerHTML = '';
  showCatalog();
  showToast('🚨 SAVE THE IPAD: alles zerstört.');
}

async function enforceLimit() {
  while (sessions.size >= 4 && sessionOrder.length) {
    const oldest = sessionOrder[0];
    if (oldest === activeRuntimeId && sessionOrder.length > 1) {
      sessionOrder.push(sessionOrder.shift()!);
    } else {
      await destroySession(oldest);
    }
  }
}

function externalVmUrl(profileId: string) {
  const ids: Record<string, string> = { arch: 'archlinux', reactos: 'reactos', android: 'android', freedos: 'freedos' };
  return V86_ROOT + '?profile=' + (ids[profileId] || profileId);
}

function vmScreenMarkup(profileId: string) {
  return '<div class="vm-toolbar">' +
    '<span class="vm-api-badge">VM API</span>' +
    '<button class="mini-button" data-vm-fullscreen="' + profileId + '">⛶ Vollbild</button>' +
    '<input class="vm-type-input" data-vm-type="' + profileId + '" placeholder="Text absichtlich an VM senden">' +
    '<button class="mini-button" data-vm-send="' + profileId + '">Text senden</button>' +
    '<button class="mini-button" data-vm-enter="' + profileId + '">Enter</button>' +
    '<input class="snapshot-name" data-snapshot-name="' + profileId + '" value="chaos1" maxlength="40">' +
    '<button class="mini-button" data-snapshot-save="' + profileId + '">💾 Snapshot</button>' +
    '<button class="mini-button" data-snapshot-load="' + profileId + '">↩ Laden</button>' +
    '<button class="mini-button" data-vm-shot="' + profileId + '">📸</button>' +
    '</div>' +
    '<div class="vm-diagnostics loading" data-vm-diag="' + profileId + '">' +
      '<span class="vm-diag-dot"></span>' +
      '<span class="vm-diag-copy"><strong data-vm-diag-title="' + profileId + '">VM wird vorbereitet…</strong><small data-vm-diag-detail="' + profileId + '">Warte auf v86-Downloads.</small></span>' +
      '<span class="vm-diag-meter"><i data-vm-diag-progress="' + profileId + '"></i></span>' +
      '<span class="vm-diag-actions" data-vm-diag-actions="' + profileId + '">' +
        '<button class="mini-button" data-vm-retry="' + profileId + '">↻ Neu versuchen</button>' +
        '<a class="mini-button" href="' + externalVmUrl(profileId) + '" target="_blank" rel="noreferrer">Extern öffnen ↗</a>' +
      '</span>' +
    '</div>' +
    '<div class="vm-screen-wrap"><div class="v86-screen" data-vm-screen="' + profileId + '"><div class="v86-text"></div><canvas style="display:none"></canvas></div><div class="virtual-cursor" data-vm-cursor="' + profileId + '"></div></div>' +
    '<div class="snapshot-list" data-snapshot-list="' + profileId + '"></div><div class="shot-gallery" data-shot-gallery="' + profileId + '"></div>';
}

function makeSessionShell(item: AppDef) {
  const shell = document.createElement('div');
  shell.className = 'runtime-session';
  shell.dataset.runtime = item.id;

  if (item.kind === 'iframe') {
    const frame = document.createElement('iframe');
    frame.className = 'runtime-frame';
    frame.title = item.title;
    frame.allow = 'clipboard-read; clipboard-write; fullscreen; camera; microphone';
    frame.referrerPolicy = 'no-referrer';
    frame.addEventListener('load', () => {
      if (activeRuntimeId === item.id) activeStatus.textContent = 'geladen';
    });
    frame.src = item.url || 'about:blank';
    shell.appendChild(frame);
  } else if (item.kind === 'controlled') {
    const profileId = runtimeProfileId(item.id);
    shell.innerHTML = vmScreenMarkup(profileId);
  } else if (item.kind === 'vmception') {
    const params = new URLSearchParams(location.search);
    const depth = Math.min(Number(params.get('depth') || '0') + 1, 8);
    shell.innerHTML = '<div class="vmception-info"><strong>VMception Depth ' + depth + '</strong><span>iPad → ' + Array.from({ length: depth + 1 }, (_, i) => 'BlockVM[' + i + ']').join(' → ') + '</span></div>';
    const frame = document.createElement('iframe');
    frame.className = 'runtime-frame';
    frame.title = 'VMception';
    frame.src = location.origin + location.pathname + '?depth=' + depth;
    shell.appendChild(frame);
  } else if (item.kind === 'automation') {
    const isScratch = item.id === 'scratchvm';
    shell.innerHTML = '<div class="internal-toolbar"><button class="button primary" data-run-automation="' + item.id + '">▶ Kette ausführen</button><button class="button secondary" data-clear-automation="' + item.id + '">Leeren</button><span>' + (isScratch ? 'Scratch-artige BlockVM-Palette. Der offizielle Scratch-Editor erlaubt keine beliebigen Drittanbieter-Blöcke, deshalb läuft die Bridge direkt hier.' : 'Blockly steuert die echten eingebetteten v86-VMs.') + '</span></div><div class="blockly-host ' + (isScratch ? 'scratchy' : '') + '" data-blockly-host="' + item.id + '"></div>';
  } else if (item.kind === 'sqlite') {
    shell.innerHTML = '<div class="sql-layout"><div class="sql-editor"><h3>SQLite WASM</h3><textarea id="sqlInput">CREATE TABLE IF NOT EXISTS scores (name TEXT, score INTEGER);\nINSERT INTO scores VALUES ("Dodo", 37);\nSELECT * FROM scores ORDER BY score DESC;</textarea><div class="sql-actions"><button class="button primary" id="runSql">Query ausführen</button><button class="button secondary" id="resetSql">DB zurücksetzen</button></div></div><div class="sql-result" id="sqlResult">SQLite wird beim ersten Query geladen.</div></div>';
  } else if (item.kind === 'python') {
    shell.innerHTML = '<div class="python-layout"><div class="python-editor"><h3>Python 3.14 · Pyodide</h3><textarea id="pythonInput">from pathlib import Path\nprint("BlockVM Python sagt hi 👀")\nprint("Shared Drive:", list(Path("/blockvm").glob("*")))</textarea><div class="sql-actions"><button class="button primary" id="runPython">▶ Run</button><button class="button secondary" id="syncPythonDrive">📁 Drive sync</button></div></div><pre class="python-output" id="pythonOutput">Pyodide wird beim ersten Run geladen.</pre></div>';
  } else if (item.kind === 'terminal') {
    shell.innerHTML = '<div class="terminal-app"><div class="terminal-output" id="terminalOutput">BlockVM V4 Terminal\nType "help"\n\n</div><form class="terminal-form" id="terminalForm"><span>$</span><input id="terminalInput" autocomplete="off" placeholder="vm start reactos"><button class="button primary">Run</button></form></div>';
  } else {
    shell.innerHTML = '<div class="drive-app"><div class="drive-create"><input id="driveName" placeholder="datei.txt"><textarea id="driveText" placeholder="Inhalt…"></textarea><button class="button primary" id="driveSaveText">Textdatei speichern</button><label class="button secondary upload-label">Datei hochladen<input id="driveUpload" type="file"></label></div><div><div class="drive-head"><h3>BlockVM Shared Drive</h3><span>IndexedDB · bleibt nach Reload</span></div><div class="drive-list" id="driveList"></div></div></div>';
  }

  runtimeStack.appendChild(shell);
  sessions.set(item.id, shell);
  sessionOrder.push(item.id);
  updateRunningPill();
  return shell;
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(1) + ' MB';
  if (bytes >= 1024) return Math.round(bytes / 1024) + ' KB';
  return Math.round(bytes) + ' B';
}

function describeVmAsset(fileName: string) {
  const lower = fileName.toLowerCase();
  if (lower.includes('bios')) return 'BIOS';
  if (lower.includes('state')) return 'VM-State';
  if (lower.includes('reactos')) return 'ReactOS-Image';
  if (lower.includes('android')) return 'Android-Image';
  if (lower.includes('freedos')) return 'FreeDOS-Image';
  if (lower.includes('arch')) return 'Arch-Dateisystem';
  if (lower.includes('.wasm')) return 'v86 WebAssembly';
  return 'VM-Datei';
}

function setVmDiagnostic(profileId: string, state: 'loading' | 'ok' | 'stalled' | 'error', title: string, detail: string, percent?: number) {
  const shell = findVmShell(profileId);
  const panel = shell?.querySelector<HTMLElement>('[data-vm-diag="' + profileId + '"]');
  const titleNode = shell?.querySelector<HTMLElement>('[data-vm-diag-title="' + profileId + '"]');
  const detailNode = shell?.querySelector<HTMLElement>('[data-vm-diag-detail="' + profileId + '"]');
  const bar = shell?.querySelector<HTMLElement>('[data-vm-diag-progress="' + profileId + '"]');
  if (!panel || !titleNode || !detailNode || !bar) return;
  panel.className = 'vm-diagnostics ' + state;
  titleNode.textContent = title;
  detailNode.textContent = detail;
  bar.style.width = Math.max(0, Math.min(100, percent ?? (state === 'ok' ? 100 : 0))) + '%';
}

async function bootControlledVm(profileId: string, shell: HTMLElement) {
  const existing = vmSessions.get(profileId);
  if (existing) return existing;
  const inFlight = vmBootPromises.get(profileId);
  if (inFlight) return inFlight;

  const profile = VM_PROFILES[profileId];
  if (!profile) throw new Error('Kein direktes VM-Profil für ' + profileId);

  const promise = (async () => {
    const screen = shell.querySelector<HTMLElement>('[data-vm-screen="' + profileId + '"]');
    if (!screen) throw new Error('VM-Screen fehlt');
    activeStatus.textContent = profile.title + ' lädt…';

    const options: V86Options = {
      wasm_path: V86_WASM,
      memory_size: 64 * 1024 * 1024,
      vga_memory_size: 8 * 1024 * 1024,
      screen_container: screen,
      bios: { url: V86_ROOT + 'bios/seabios.bin' },
      vga_bios: { url: V86_ROOT + 'bios/vgabios.bin' },
      autostart: true,
      ...profile.options,
    };
    setVmDiagnostic(profileId, 'loading', 'v86 startet…', 'Lade BIOS, VM-State und Betriebssystem-Image.');
    let lastDownloadActivity = performance.now();
    let ready = false;
    let lastFile = 'noch keine Datei gemeldet';

    const emulator = new V86(options);
    const touchDevice = navigator.maxTouchPoints > 0;
    emulator.keyboard_set_enabled(!touchDevice);
    emulator.mouse_set_enabled(true);
    const session: VmSession = { emulator, profileId, startedAt: performance.now(), cursorX: 320, cursorY: 240 };
    vmSessions.set(profileId, session);

    emulator.add_listener('download-progress', (event) => {
      lastDownloadActivity = performance.now();
      lastFile = event.file_name || lastFile;
      const percent = event.lengthComputable && event.total > 0 ? Math.round((event.loaded / event.total) * 100) : undefined;
      const amount = event.lengthComputable && event.total > 0 ? formatBytes(event.loaded) + ' / ' + formatBytes(event.total) : formatBytes(event.loaded);
      setVmDiagnostic(profileId, 'loading', describeVmAsset(lastFile) + ' wird geladen', lastFile + ' · ' + amount + (percent !== undefined ? ' · ' + percent + '%' : ''), percent);
      if (runtimeProfileId(activeRuntimeId) === profileId) activeStatus.textContent = profile.title + ' · ' + describeVmAsset(lastFile);
    });

    emulator.add_listener('download-error', (event) => {
      lastDownloadActivity = performance.now();
      lastFile = event.file_name || lastFile;
      setVmDiagnostic(profileId, 'error', 'Download fehlgeschlagen', describeVmAsset(lastFile) + ': ' + lastFile + '. Netzwerkfilter/CDN/CORS kann die Ursache sein.');
      if (runtimeProfileId(activeRuntimeId) === profileId) activeStatus.textContent = profile.title + ' · Downloadfehler';
    });

    emulator.add_listener('emulator-loaded', () => {
      lastDownloadActivity = performance.now();
      setVmDiagnostic(profileId, 'loading', 'Downloads fertig', 'v86 initialisiert jetzt die virtuelle Hardware.', 100);
    });

    emulator.add_listener('emulator-ready', () => {
      ready = true;
      const watchdog = vmBootWatchdogs.get(profileId);
      if (watchdog !== undefined) window.clearInterval(watchdog);
      vmBootWatchdogs.delete(profileId);
      emulator.keyboard_set_enabled(!touchDevice);
      emulator.mouse_set_enabled(true);
      setVmDiagnostic(profileId, 'ok', profile.title + ' ist bereit', touchDevice ? 'Touch = Maus. Text nur über „Text senden“.' : 'Tastatur und Maus sind aktiv.', 100);
      if (runtimeProfileId(activeRuntimeId) === profileId) activeStatus.textContent = profile.title + (touchDevice ? ' · Touch = Maus' : ' · Tastatur + Maus bereit');
    });

    const watchdog = window.setInterval(() => {
      if (ready) return;
      const idleMs = performance.now() - lastDownloadActivity;
      if (idleMs < 30000) return;
      window.clearInterval(watchdog);
      vmBootWatchdogs.delete(profileId);
      setVmDiagnostic(profileId, 'stalled', 'Boot hängt seit 30 Sekunden', 'Letzte Aktivität: ' + lastFile + '. Wahrscheinlich wurde eine externe VM-Datei blockiert oder der Tab hat zu wenig Ressourcen.');
      if (runtimeProfileId(activeRuntimeId) === profileId) activeStatus.textContent = profile.title + ' · Boot hängt';
    }, 3000);
    vmBootWatchdogs.set(profileId, watchdog);

    await renderSnapshots(profileId);
    return session;
  })();

  vmBootPromises.set(profileId, promise);
  try {
    return await promise;
  } finally {
    vmBootPromises.delete(profileId);
  }
}

function findVmShell(profileId: string) {
  return Array.from(sessions.values()).find((node) => node.querySelector('[data-vm-screen="' + profileId + '"]'));
}

function tapVm(profileId: string, clientX: number, clientY: number) {
  const vm = vmSessions.get(profileId);
  const shell = findVmShell(profileId);
  const screen = shell?.querySelector<HTMLElement>('[data-vm-screen="' + profileId + '"]');
  if (!vm || !screen) throw new Error('VM ist noch nicht bereit.');
  vm.emulator.mouse_set_enabled(true);
  const rect = screen.getBoundingClientRect();
  const x = Math.round(((clientX - rect.left) / Math.max(rect.width, 1)) * 640);
  const y = Math.round(((clientY - rect.top) / Math.max(rect.height, 1)) * 480);
  clickVm(x, y, profileId);
  activeStatus.textContent = VM_PROFILES[profileId]?.title + ' · Touch = Maus';
}

async function toggleVmFullscreen(profileId: string) {
  const shell = findVmShell(profileId);
  if (!shell) throw new Error('VM-Fenster fehlt.');

  if (shell.classList.contains('vm-faux-fullscreen')) {
    shell.classList.remove('vm-faux-fullscreen');
    document.body.classList.remove('vm-fullscreen-open');
    showToast('Vollbild beendet.');
    return;
  }

  const isIPadLike = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (!isIPadLike && document.fullscreenEnabled && shell.requestFullscreen) {
    try {
      await shell.requestFullscreen();
      return;
    } catch {
      // CSS fallback below.
    }
  }

  shell.classList.add('vm-faux-fullscreen');
  document.body.classList.add('vm-fullscreen-open');
  showToast('⛶ iPad-Vollbildmodus aktiv.');
}

function showOnly(id: string) {
  for (const [sessionId, node] of sessions) node.classList.toggle('active', sessionId === id);
}

async function openRuntime(id: string) {
  const item = getApp(id);
  if (!item) return;

  if (!tortureToggle.checked) await stopAll(id);
  if (!sessions.has(id)) {
    if (tortureToggle.checked) await enforceLimit();
    makeSessionShell(item);
  }

  activeRuntimeId = id;
  showOnly(id);
  activeIcon.textContent = item.icon;
  activeTitle.textContent = item.title;
  activeStatus.textContent = 'läuft';
  setHelper(item);

  if (item.externalUrl) {
    externalLink.href = item.externalUrl;
    externalLink.classList.remove('hidden');
  } else {
    externalLink.classList.add('hidden');
    externalLink.removeAttribute('href');
  }

  showStage();
  const shell = sessions.get(id)!;

  if (item.kind === 'controlled') await bootControlledVm(runtimeProfileId(id), shell);
  if (item.kind === 'automation') initAutomation(item.id);
  if (item.kind === 'files') await renderDrive();
  if (item.kind === 'sqlite') activeStatus.textContent = sqliteDb ? 'SQLite bereit' : 'WASM lädt beim ersten Query';
  if (item.kind === 'python') activeStatus.textContent = pyodide ? 'Python bereit' : 'Pyodide lädt beim ersten Run';
}

async function getActiveVm(preferredId?: string) {
  const profileId = preferredId || runtimeProfileId(activeRuntimeId);
  const existing = vmSessions.get(profileId);
  if (existing) return existing;
  if (VM_PROFILES[profileId]) {
    await openRuntime(profileId);
    return vmSessions.get(profileId) || null;
  }
  return null;
}

function sendVmText(text: string, profileId?: string) {
  const vm = profileId ? vmSessions.get(profileId) : vmSessions.get(runtimeProfileId(activeRuntimeId));
  if (!vm) throw new Error('Keine steuerbare VM aktiv.');
  vm.emulator.keyboard_send_text(text);
}

function sendVmKey(key: string, profileId?: string) {
  const vm = profileId ? vmSessions.get(profileId) : vmSessions.get(runtimeProfileId(activeRuntimeId));
  if (!vm) throw new Error('Keine steuerbare VM aktiv.');
  const scan: Record<string, number> = { enter: 0x1c, escape: 0x01, tab: 0x0f, space: 0x39, backspace: 0x0e };
  const code = scan[key.toLowerCase()];
  if (code === undefined) throw new Error('Unbekannte Taste: ' + key);
  vm.emulator.keyboard_send_scancodes([code, code | 0x80]);
}

function clickVm(x: number, y: number, profileId?: string) {
  const id = profileId || runtimeProfileId(activeRuntimeId);
  const vm = vmSessions.get(id);
  const shell = Array.from(sessions.values()).find((node) => node.querySelector('[data-vm-screen="' + id + '"]'));
  const screen = shell?.querySelector<HTMLElement>('[data-vm-screen="' + id + '"]');
  const canvas = screen?.querySelector<HTMLCanvasElement>('canvas');
  if (!vm || !screen || !canvas) throw new Error('Keine steuerbare VM aktiv.');
  const rect = screen.getBoundingClientRect();
  const px = Math.max(0, Math.min(639, x));
  const py = Math.max(0, Math.min(479, y));
  const clientX = rect.left + (px / 640) * rect.width;
  const clientY = rect.top + (py / 480) * rect.height;
  canvas.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX, clientY }));
  canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, clientX, clientY, button: 0, buttons: 1 }));
  canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, clientX, clientY, button: 0, buttons: 0 }));
  vm.cursorX = px;
  vm.cursorY = py;
  const cursor = shell?.querySelector<HTMLElement>('[data-vm-cursor="' + id + '"]');
  if (cursor) {
    cursor.style.left = (px / 640) * 100 + '%';
    cursor.style.top = (py / 480) * 100 + '%';
  }
}

async function saveSnapshot(profileId: string, name: string) {
  const vm = vmSessions.get(profileId);
  if (!vm) throw new Error('VM läuft nicht.');
  activeStatus.textContent = 'Snapshot wird gespeichert…';
  const state = await vm.emulator.save_state();
  const record: SnapshotRecord = {
    id: profileId + ':' + name,
    profileId,
    name,
    createdAt: Date.now(),
    size: state.byteLength,
    state,
  };
  await idbPut('snapshots', record);
  activeStatus.textContent = 'Snapshot gespeichert · ' + Math.round(state.byteLength / 1048576) + ' MB';
  await renderSnapshots(profileId);
  return record;
}

async function loadSnapshot(profileId: string, name: string) {
  let vm = vmSessions.get(profileId);
  if (!vm) {
    await openRuntime(profileId);
    vm = vmSessions.get(profileId);
  }
  if (!vm) throw new Error('VM konnte nicht gestartet werden.');
  const record = await idbGet<SnapshotRecord>('snapshots', profileId + ':' + name);
  if (!record) throw new Error('Snapshot nicht gefunden.');
  activeStatus.textContent = 'Snapshot wird geladen…';
  await vm.emulator.restore_state(record.state);
  activeStatus.textContent = 'Snapshot ' + name + ' geladen';
}

async function renderSnapshots(profileId: string) {
  const holder = document.querySelector<HTMLElement>('[data-snapshot-list="' + profileId + '"]');
  if (!holder) return;
  const all = await idbAll<SnapshotRecord>('snapshots');
  const list = all.filter((item) => item.profileId === profileId).sort((a, b) => b.createdAt - a.createdAt);
  holder.innerHTML = list.length ? list.map((item) => '<button class="snapshot-chip" data-quick-load="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + ' · ' + Math.round(item.size / 1048576) + ' MB</button>').join('') : '<span>Keine Snapshots.</span>';
}

function takeVmScreenshot(profileId?: string) {
  const id = profileId || runtimeProfileId(activeRuntimeId);
  const vm = vmSessions.get(id);
  if (!vm) throw new Error('Keine steuerbare VM aktiv.');
  const image = vm.emulator.screen_make_screenshot();
  image.classList.add('vm-shot');
  const gallery = document.querySelector<HTMLElement>('[data-shot-gallery="' + id + '"]');
  if (gallery) gallery.prepend(image);
  showToast('📸 Screenshot erstellt.');
}

async function listDriveFiles() {
  return (await idbAll<DriveFile>('files')).sort((a, b) => a.path.localeCompare(b.path));
}

async function saveDriveFile(path: string, data: Uint8Array) {
  const clean = path.trim().replace(/^\/+/, '');
  if (!clean) throw new Error('Dateiname fehlt.');
  await idbPut('files', { path: clean, data, updatedAt: Date.now() });
  return clean;
}

async function sendDriveFileToVm(path: string, profileId = 'arch') {
  const file = await idbGet<DriveFile>('files', path);
  if (!file) throw new Error('Datei nicht gefunden.');
  let vm = vmSessions.get(profileId);
  if (!vm) {
    await openRuntime(profileId);
    vm = vmSessions.get(profileId);
  }
  if (!vm) throw new Error('VM nicht verfügbar.');
  const safe = path.replace(/[^a-zA-Z0-9._-]/g, '_');
  await vm.emulator.create_file('/tmp/blockvm-' + safe, file.data);
  showToast('📁 Nach Arch: /tmp/blockvm-' + safe);
}

async function renderDrive() {
  const list = document.querySelector<HTMLDivElement>('#driveList');
  if (!list) return;
  const files = await listDriveFiles();
  list.innerHTML = '';
  if (!files.length) {
    list.innerHTML = '<div class="empty-state small">Noch keine Dateien.</div>';
    return;
  }
  for (const file of files) {
    const row = document.createElement('div');
    row.className = 'drive-row';
    row.innerHTML = '<span><strong>' + escapeHtml(file.path) + '</strong><small>' + file.data.byteLength + ' Bytes</small></span><span class="drive-actions"><button class="mini-button drive-to-vm">→ Arch</button><button class="mini-button drive-download">Download</button><button class="mini-button drive-delete">Löschen</button></span>';
    row.querySelector<HTMLButtonElement>('.drive-to-vm')!.addEventListener('click', () => void sendDriveFileToVm(file.path).catch((error) => showToast(String(error))));
    row.querySelector<HTMLButtonElement>('.drive-download')!.addEventListener('click', () => {
      const blob = new Blob([file.data]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.path.split('/').pop() || 'blockvm-file';
      a.click();
      URL.revokeObjectURL(url);
    });
    row.querySelector<HTMLButtonElement>('.drive-delete')!.addEventListener('click', () => void (async () => {
      await idbDelete('files', file.path);
      await renderDrive();
    })());
    list.appendChild(row);
  }
}

async function ensurePyodide() {
  if (pyodide) return pyodide;
  if (pyodideLoading) return pyodideLoading;
  pyodideLoading = loadPyodide({ indexURL: PYODIDE_INDEX });
  pyodide = await pyodideLoading;
  pyodide.FS.mkdirTree('/blockvm');
  await syncDriveToPython();
  return pyodide;
}

async function syncDriveToPython() {
  if (!pyodide) return;
  pyodide.FS.mkdirTree('/blockvm');
  const files = await listDriveFiles();
  for (const file of files) {
    const safe = file.path.replace(/[^a-zA-Z0-9._-]/g, '_');
    pyodide.FS.writeFile('/blockvm/' + safe, file.data);
  }
  showToast('🐍 Shared Drive → /blockvm synchronisiert');
}

async function runPythonCode(code: string) {
  const py = await ensurePyodide();
  const quoted = JSON.stringify(code);
  const wrapped = 'import io, sys\n_buf=io.StringIO()\n_oldout,_olderr=sys.stdout,sys.stderr\nsys.stdout=sys.stderr=_buf\ntry:\n    exec(' + quoted + ', globals())\nfinally:\n    sys.stdout,sys.stderr=_oldout,_olderr\n_buf.getvalue()';
  return String(await py.runPythonAsync(wrapped));
}

async function ensureSqlite() {
  if (sqliteDb) return sqliteDb;
  const SQL = await initSqlJs({ locateFile: (file) => 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.13.0/' + file });
  sqliteDb = new SQL.Database();
  return sqliteDb;
}

function renderSqlResults(results: ReturnType<Database['exec']>) {
  const output = document.querySelector<HTMLDivElement>('#sqlResult');
  if (!output) return;
  if (!results.length) {
    output.innerHTML = '<div class="sql-ok">✓ Query ausgeführt. Keine Ergebniszeilen.</div>';
    return;
  }
  output.innerHTML = '';
  for (const result of results) {
    const wrap = document.createElement('div');
    wrap.className = 'table-wrap';
    const table = document.createElement('table');
    table.innerHTML = '<thead><tr>' + result.columns.map((col) => '<th>' + escapeHtml(col) + '</th>').join('') + '</tr></thead><tbody>' + result.values.map((row) => '<tr>' + row.map((value) => '<td>' + escapeHtml(String(value ?? 'NULL')) + '</td>').join('') + '</tr>').join('') + '</tbody>';
    wrap.appendChild(table);
    output.appendChild(wrap);
  }
}

function automationBlocks() {
  if (Blockly.Blocks.blockvm_launch) return;
  Blockly.defineBlocksWithJsonArray([
    { type: 'blockvm_launch', message0: 'starte VM %1', args0: [{ type: 'field_dropdown', name: 'APP', options: [['Android', 'android'], ['ReactOS', 'reactos'], ['Arch Linux', 'arch'], ['FreeDOS', 'freedos']] }], previousStatement: null, nextStatement: null, colour: 260 },
    { type: 'blockvm_type', message0: 'tippe %1', args0: [{ type: 'field_input', name: 'TEXT', text: 'hello' }], previousStatement: null, nextStatement: null, colour: 190 },
    { type: 'blockvm_key', message0: 'drücke %1', args0: [{ type: 'field_dropdown', name: 'KEY', options: [['Enter', 'enter'], ['Escape', 'escape'], ['Tab', 'tab'], ['Space', 'space'], ['Backspace', 'backspace']] }], previousStatement: null, nextStatement: null, colour: 190 },
    { type: 'blockvm_click', message0: 'klicke x %1 y %2', args0: [{ type: 'field_number', name: 'X', value: 320, min: 0, max: 639 }, { type: 'field_number', name: 'Y', value: 240, min: 0, max: 479 }], previousStatement: null, nextStatement: null, colour: 190 },
    { type: 'blockvm_wait', message0: 'warte %1 ms', args0: [{ type: 'field_number', name: 'MS', value: 1000, min: 0, max: 60000 }], previousStatement: null, nextStatement: null, colour: 45 },
    { type: 'blockvm_snapshot', message0: 'snapshot speichern %1', args0: [{ type: 'field_input', name: 'NAME', text: 'chaos1' }], previousStatement: null, nextStatement: null, colour: 330 },
    { type: 'blockvm_screenshot', message0: 'screenshot', previousStatement: null, nextStatement: null, colour: 330 },
    { type: 'blockvm_stop', message0: 'stoppe aktive VM', previousStatement: null, nextStatement: null, colour: 0 },
    { type: 'blockvm_panic', message0: '🚨 SAVE THE IPAD', previousStatement: null, nextStatement: null, colour: 0 },
  ]);
}

function initAutomation(id: string) {
  if (activeAutomationWorkspace && activeAutomationId === id) return;
  if (activeAutomationWorkspace) activeAutomationWorkspace.dispose();
  automationBlocks();
  const host = document.querySelector<HTMLDivElement>('[data-blockly-host="' + id + '"]');
  if (!host) return;
  activeAutomationId = id;
  activeAutomationWorkspace = Blockly.inject(host, {
    toolbox: {
      kind: 'flyoutToolbox',
      contents: [
        { kind: 'block', type: 'blockvm_launch' },
        { kind: 'block', type: 'blockvm_type' },
        { kind: 'block', type: 'blockvm_key' },
        { kind: 'block', type: 'blockvm_click' },
        { kind: 'block', type: 'blockvm_wait' },
        { kind: 'block', type: 'blockvm_snapshot' },
        { kind: 'block', type: 'blockvm_screenshot' },
        { kind: 'block', type: 'blockvm_stop' },
        { kind: 'block', type: 'blockvm_panic' },
      ],
    },
    trashcan: true,
    scrollbars: true,
  });
  const saved = localStorage.getItem('blockvm:automation:' + id);
  if (saved) {
    try {
      Blockly.serialization.workspaces.load(JSON.parse(saved), activeAutomationWorkspace);
    } catch {
      localStorage.removeItem('blockvm:automation:' + id);
    }
  }
  activeAutomationWorkspace.addChangeListener(() => {
    if (activeAutomationWorkspace) localStorage.setItem('blockvm:automation:' + id, JSON.stringify(Blockly.serialization.workspaces.save(activeAutomationWorkspace)));
  });
}

async function runAutomation() {
  if (!activeAutomationWorkspace) return;
  let currentVm = '';
  for (const top of activeAutomationWorkspace.getTopBlocks(true)) {
    let block: Blockly.Block | null = top;
    while (block) {
      if (block.type === 'blockvm_launch') {
        currentVm = String(block.getFieldValue('APP') || '');
        await openRuntime(currentVm);
      } else if (block.type === 'blockvm_type') {
        sendVmText(String(block.getFieldValue('TEXT') || ''), currentVm || undefined);
      } else if (block.type === 'blockvm_key') {
        sendVmKey(String(block.getFieldValue('KEY') || 'enter'), currentVm || undefined);
      } else if (block.type === 'blockvm_click') {
        clickVm(Number(block.getFieldValue('X') || 0), Number(block.getFieldValue('Y') || 0), currentVm || undefined);
      } else if (block.type === 'blockvm_wait') {
        await new Promise((resolve) => window.setTimeout(resolve, Math.min(Number(block.getFieldValue('MS') || 0), 60000)));
      } else if (block.type === 'blockvm_snapshot') {
        const id = currentVm || runtimeProfileId(activeRuntimeId);
        await saveSnapshot(id, String(block.getFieldValue('NAME') || 'snapshot'));
      } else if (block.type === 'blockvm_screenshot') {
        takeVmScreenshot(currentVm || undefined);
      } else if (block.type === 'blockvm_stop') {
        if (currentVm) await destroySession(currentVm);
      } else if (block.type === 'blockvm_panic') {
        await panicStop();
      }
      block = block.getNextBlock();
    }
  }
}

function terminalWrite(text: string) {
  const output = document.querySelector<HTMLDivElement>('#terminalOutput');
  if (output) {
    output.textContent += text + '\n';
    output.scrollTop = output.scrollHeight;
  }
}

async function runTerminalCommand(raw: string) {
  const line = raw.trim();
  if (!line) return;
  terminalWrite('$ ' + line);
  const parts = line.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  try {
    if (cmd === 'help') {
      terminalWrite('vm start <arch|reactos|android|freedos>\nvm stop [id|all]\nvm type <text>\nvm key <enter|escape|tab|space>\nvm click <x> <y>\nvm snapshot save <name>\nvm snapshot load <name>\nvm screenshot\nopen <app>\nfs ls\nfs write <name> <text>\npython <code>\nsql <query>\ndepth\npanic');
    } else if (cmd === 'vm' && parts[1] === 'start') {
      await openRuntime(parts[2] || 'arch');
      terminalWrite('started ' + (parts[2] || 'arch'));
    } else if (cmd === 'vm' && parts[1] === 'stop') {
      if (parts[2] === 'all') await stopAll();
      else await destroySession(parts[2] || activeRuntimeId);
      terminalWrite('stopped');
    } else if (cmd === 'vm' && parts[1] === 'type') {
      sendVmText(line.split(' ').slice(2).join(' '));
      terminalWrite('typed');
    } else if (cmd === 'vm' && parts[1] === 'key') {
      sendVmKey(parts[2] || 'enter');
      terminalWrite('key sent');
    } else if (cmd === 'vm' && parts[1] === 'click') {
      clickVm(Number(parts[2] || 0), Number(parts[3] || 0));
      terminalWrite('clicked');
    } else if (cmd === 'vm' && parts[1] === 'snapshot' && parts[2] === 'save') {
      const id = runtimeProfileId(activeRuntimeId);
      await saveSnapshot(id, parts[3] || 'snapshot');
      terminalWrite('snapshot saved');
    } else if (cmd === 'vm' && parts[1] === 'snapshot' && parts[2] === 'load') {
      const id = runtimeProfileId(activeRuntimeId);
      await loadSnapshot(id, parts[3] || 'snapshot');
      terminalWrite('snapshot loaded');
    } else if (cmd === 'vm' && parts[1] === 'screenshot') {
      takeVmScreenshot();
      terminalWrite('screenshot captured');
    } else if (cmd === 'open') {
      await openRuntime(parts[1] || 'scratch');
      terminalWrite('opened ' + (parts[1] || 'scratch'));
    } else if (cmd === 'fs' && parts[1] === 'ls') {
      const files = await listDriveFiles();
      terminalWrite(files.length ? files.map((file) => file.path + ' (' + file.data.byteLength + ' B)').join('\n') : '(empty)');
    } else if (cmd === 'fs' && parts[1] === 'write') {
      const name = parts[2] || 'note.txt';
      const content = line.split(' ').slice(3).join(' ');
      await saveDriveFile(name, new TextEncoder().encode(content));
      terminalWrite('saved ' + name);
    } else if (cmd === 'python') {
      terminalWrite(await runPythonCode(line.slice(7)));
    } else if (cmd === 'sql') {
      const db = await ensureSqlite();
      const results = db.exec(line.slice(4));
      terminalWrite(JSON.stringify(results));
    } else if (cmd === 'depth') {
      terminalWrite(depthPath.textContent || 'BlockVM[0]');
    } else if (cmd === 'panic') {
      await panicStop();
      terminalWrite('panic complete');
    } else {
      terminalWrite('unknown command');
    }
  } catch (error) {
    terminalWrite('ERROR: ' + (error instanceof Error ? error.message : String(error)));
  }
}

runtimeStack.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;

  if (target.dataset.vmFullscreen) {
    void toggleVmFullscreen(target.dataset.vmFullscreen).catch((error) => showToast(String(error)));
  }
  if (target.dataset.vmRetry) {
    const profileId = target.dataset.vmRetry;
    const shell = findVmShell(profileId);
    const appId = shell?.dataset.runtime || profileId;
    void (async () => {
      await destroySession(appId);
      await openRuntime(appId);
    })().catch((error) => showToast(String(error)));
  }
  if (target.dataset.vmSend) {
    const input = document.querySelector<HTMLInputElement>('[data-vm-type="' + target.dataset.vmSend + '"]');
    if (input) {
      try {
        sendVmText(input.value, target.dataset.vmSend);
      } catch (error) {
        showToast(String(error));
      }
    }
  }
  if (target.dataset.vmEnter) {
    try {
      sendVmKey('enter', target.dataset.vmEnter);
    } catch (error) {
      showToast(String(error));
    }
  }
  if (target.dataset.snapshotSave) {
    const id = target.dataset.snapshotSave;
    const input = document.querySelector<HTMLInputElement>('[data-snapshot-name="' + id + '"]');
    void saveSnapshot(id, input?.value.trim() || 'snapshot').catch((error) => showToast(String(error)));
  }
  if (target.dataset.snapshotLoad) {
    const id = target.dataset.snapshotLoad;
    const input = document.querySelector<HTMLInputElement>('[data-snapshot-name="' + id + '"]');
    void loadSnapshot(id, input?.value.trim() || 'snapshot').catch((error) => showToast(String(error)));
  }
  if (target.dataset.quickLoad) {
    const [profileId, ...nameParts] = target.dataset.quickLoad.split(':');
    void loadSnapshot(profileId, nameParts.join(':')).catch((error) => showToast(String(error)));
  }
  if (target.dataset.vmShot) {
    try {
      takeVmScreenshot(target.dataset.vmShot);
    } catch (error) {
      showToast(String(error));
    }
  }
  if (target.dataset.runAutomation) {
    void runAutomation().catch((error) => showToast(String(error)));
  }
  if (target.dataset.clearAutomation) activeAutomationWorkspace?.clear();

  if (target.id === 'runSql') {
    void (async () => {
      const input = document.querySelector<HTMLTextAreaElement>('#sqlInput');
      const output = document.querySelector<HTMLDivElement>('#sqlResult');
      if (!input || !output) return;
      try {
        activeStatus.textContent = 'SQLite lädt…';
        const db = await ensureSqlite();
        renderSqlResults(db.exec(input.value));
        activeStatus.textContent = 'SQLite bereit';
      } catch (error) {
        output.textContent = 'SQLite-Fehler: ' + (error instanceof Error ? error.message : 'Unbekannter Fehler');
      }
    })();
  }
  if (target.id === 'resetSql') {
    sqliteDb?.close();
    sqliteDb = null;
    const output = document.querySelector<HTMLDivElement>('#sqlResult');
    if (output) output.textContent = 'DB zurückgesetzt.';
  }
  if (target.id === 'runPython') {
    void (async () => {
      const input = document.querySelector<HTMLTextAreaElement>('#pythonInput');
      const output = document.querySelector<HTMLPreElement>('#pythonOutput');
      if (!input || !output) return;
      try {
        output.textContent = 'Pyodide lädt / führt aus…';
        activeStatus.textContent = 'Python läuft…';
        output.textContent = await runPythonCode(input.value);
        activeStatus.textContent = 'Python bereit';
      } catch (error) {
        output.textContent = 'Python-Fehler: ' + (error instanceof Error ? error.message : String(error));
      }
    })();
  }
  if (target.id === 'syncPythonDrive') void syncDriveToPython();
  if (target.id === 'driveSaveText') {
    const name = document.querySelector<HTMLInputElement>('#driveName');
    const content = document.querySelector<HTMLTextAreaElement>('#driveText');
    if (name && content) void (async () => {
      await saveDriveFile(name.value || 'note.txt', new TextEncoder().encode(content.value));
      name.value = '';
      content.value = '';
      await renderDrive();
    })();
  }
});

runtimeStack.addEventListener('pointerup', (event) => {
  const target = event.target as HTMLElement;
  const screen = target.closest<HTMLElement>('[data-vm-screen]');
  const profileId = screen?.dataset.vmScreen;
  if (!profileId || event.pointerType === 'mouse') return;
  event.preventDefault();
  try {
    tapVm(profileId, event.clientX, event.clientY);
  } catch {
    // VM may still be booting.
  }
});

runtimeStack.addEventListener('change', (event) => {
  const target = event.target as HTMLInputElement;
  if (target.id === 'driveUpload' && target.files?.[0]) {
    const file = target.files[0];
    void (async () => {
      await saveDriveFile(file.name, new Uint8Array(await file.arrayBuffer()));
      await renderDrive();
      showToast('📁 ' + file.name + ' gespeichert');
    })();
  }
});

runtimeStack.addEventListener('submit', (event) => {
  const form = event.target as HTMLFormElement;
  if (form.id !== 'terminalForm') return;
  event.preventDefault();
  const input = document.querySelector<HTMLInputElement>('#terminalInput');
  if (!input) return;
  const value = input.value;
  input.value = '';
  void runTerminalCommand(value);
});

document.querySelector<HTMLButtonElement>('#backToCatalog')!.addEventListener('click', showCatalog);
document.querySelector<HTMLButtonElement>('#stopActive')!.addEventListener('click', () => {
  if (activeRuntimeId) void destroySession(activeRuntimeId);
  showCatalog();
});
document.querySelector<HTMLButtonElement>('#panicButton')!.addEventListener('click', () => void panicStop());
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) document.body.classList.remove('vm-fullscreen-open');
});
document.querySelector<HTMLButtonElement>('#homeButton')!.addEventListener('click', () => {
  appsView.classList.remove('hidden');
  projectsView.classList.add('hidden');
  showCatalog();
});
searchInput.addEventListener('input', renderCatalog);
tortureToggle.addEventListener('change', () => {
  if (!tortureToggle.checked && activeRuntimeId) void stopAll(activeRuntimeId);
});

function initials(name?: string, email?: string) {
  return (name || email || '?').trim().slice(0, 2).toUpperCase();
}
function setFeedback(message: string, kind: 'ok' | 'error' | '' = '') {
  projectFeedback.textContent = message;
  projectFeedback.className = 'feedback ' + kind;
}
function showProjects() {
  appsView.classList.add('hidden');
  projectsView.classList.remove('hidden');
  void refreshAccount();
}
async function beginSignIn() {
  try {
    const result = await auth.signIn({ scope: 'openid email profile offline_access' });
    currentUser = result.user;
    await refreshAccount();
    showProjects();
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === 'popup_closed') return;
    setFeedback(code === 'popup_blocked' ? 'Popup blockiert – erlaube Popups für BlockVM.' : 'Anmeldung fehlgeschlagen.', 'error');
    showProjects();
  }
}
async function refreshAccount() {
  currentUser = await auth.getUser();
  if (!currentUser) {
    authButton.textContent = 'Anmelden';
    authGate.classList.remove('hidden');
    projectArea.classList.add('hidden');
    projects = [];
    renderProjects();
    return;
  }
  authButton.textContent = currentUser.name || currentUser.email || 'Account';
  authGate.classList.add('hidden');
  projectArea.classList.remove('hidden');
  profileName.textContent = currentUser.name || 'BlockVM Account';
  profileEmail.textContent = currentUser.email || 'Angemeldet';
  profileAvatar.textContent = initials(currentUser.name, currentUser.email);
  await loadProjects();
}
async function loadProjects() {
  setFeedback('Projekte werden geladen…');
  try {
    const response = await api.get('/api/projects');
    projects = (response.data.projects || []) as Project[];
    renderProjects();
    setFeedback(projects.length ? '' : 'Noch keine Projekte.');
  } catch {
    setFeedback('Projekte konnten nicht geladen werden.', 'error');
  }
}
function renderProjects() {
  projectsGrid.innerHTML = '';
  for (const project of projects) {
    const def = getApp(project.workspace);
    const card = document.createElement('article');
    card.className = 'project-card';
    card.innerHTML = '<span class="project-icon">' + (def?.icon || '⚙️') + '</span><span class="project-info"><strong>' + escapeHtml(project.name) + '</strong><small>' + escapeHtml(def?.title || project.workspace) + '</small></span><span class="project-actions"><button class="mini-button open-project">Öffnen</button><button class="mini-button delete-project">Löschen</button></span>';
    card.querySelector<HTMLButtonElement>('.open-project')!.addEventListener('click', () => {
      appsView.classList.remove('hidden');
      projectsView.classList.add('hidden');
      void openRuntime(project.workspace);
    });
    card.querySelector<HTMLButtonElement>('.delete-project')!.addEventListener('click', async () => {
      try {
        await api.delete('/api/projects/' + encodeURIComponent(project.id));
        projects = projects.filter((item) => item.id !== project.id);
        renderProjects();
        setFeedback('Projekt gelöscht.', 'ok');
      } catch {
        setFeedback('Projekt konnte nicht gelöscht werden.', 'error');
      }
    });
    projectsGrid.appendChild(card);
  }
}
projectType.innerHTML = APPS.map((item) => '<option value="' + escapeHtml(item.id) + '">' + item.icon + ' ' + escapeHtml(item.title) + '</option>').join('');
projectForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = projectName.value.trim();
  if (!name) {
    setFeedback('Gib dem Projekt erst einen Namen.', 'error');
    return;
  }
  try {
    const response = await api.post('/api/projects', { name, workspace: projectType.value });
    projects.unshift(response.data.project as Project);
    projectName.value = '';
    renderProjects();
    setFeedback('Projekt gespeichert.', 'ok');
  } catch {
    setFeedback('Projekt konnte nicht gespeichert werden.', 'error');
  }
});
document.querySelector<HTMLButtonElement>('#projectsButton')!.addEventListener('click', showProjects);
document.querySelector<HTMLButtonElement>('#backFromProjects')!.addEventListener('click', () => {
  projectsView.classList.add('hidden');
  appsView.classList.remove('hidden');
});
authButton.addEventListener('click', () => currentUser ? showProjects() : void beginSignIn());
gateSignIn.addEventListener('click', () => void beginSignIn());
signOutButton.addEventListener('click', async () => {
  await auth.signOut();
  currentUser = null;
  await refreshAccount();
});

const depth = Math.min(Number(new URLSearchParams(location.search).get('depth') || '0'), 8);
depthPath.textContent = Array.from({ length: depth + 1 }, (_, i) => 'BlockVM[' + i + ']').join(' → ');
if (depth > 0) {
  document.title = 'BlockVM V4 · Depth ' + depth;
  document.querySelector<HTMLElement>('.brand-button small')!.textContent = 'VMception depth ' + depth;
}
if (depth >= 3 && sessionStorage.getItem('blockvm:depth3') !== '1') {
  sessionStorage.setItem('blockvm:depth3', '1');
  achievement.classList.remove('hidden');
  window.setTimeout(() => achievement.classList.add('hidden'), 4200);
}

let frameCount = 0;
let lastFpsAt = performance.now();
let lastFps = 60;
function hudLoop(now: number) {
  frameCount += 1;
  if (now - lastFpsAt >= 1000) {
    lastFps = Math.round((frameCount * 1000) / (now - lastFpsAt));
    frameCount = 0;
    lastFpsAt = now;
    const vmRam = Array.from(vmSessions.values()).reduce((sum, vm) => sum + Math.round((VM_PROFILES[vm.profileId]?.options.memory_size || 0) / 1048576), 0);
    const heavyCount = Array.from(sessions.keys()).filter((id) => getApp(id)?.heavy).length;
    const suffering = Math.min(100, vmSessions.size * 22 + heavyCount * 10 + Math.max(0, 45 - lastFps));
    hudFps.textContent = String(lastFps);
    hudRuntimes.textContent = String(sessions.size);
    hudRam.textContent = vmRam + ' MB';
    hudUptime.textContent = Math.floor((now - appStartedAt) / 1000) + 's';
    hudSuffering.textContent = String(suffering);
  }
  requestAnimationFrame(hudLoop);
}
requestAnimationFrame(hudLoop);

renderCategories();
renderCatalog();
void refreshAccount();
