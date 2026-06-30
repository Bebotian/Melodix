// ---------- State ----------

let state = {
  tracks: [],      // {path, title, artist, album, duration, cover}
  playlists: []     // {id, name, trackPaths: []}
};

let currentView = 'library';
let currentPlaylistId = null;
let queue = [];        // array of track paths, in play order for current context
let queueIndex = -1;
let isPlaying = false;
let shuffleOn = false;
let repeatMode = 'off'; // off | all | one
let songLibraryCollapsed = false;
let videoLibraryCollapsed = false;

function isVideo(track) {
  return track.type === 'video';
}

const audioEl = document.getElementById('audio-el');

// ---------- DOM refs ----------

const trackListEl = document.getElementById('track-list');
const videoListEl = document.getElementById('video-list');
const videoEmptyStateEl = document.getElementById('video-empty-state');
const playlistTrackListEl = document.getElementById('playlist-track-list');
const emptyStateEl = document.getElementById('empty-state');
const viewTitleEl = document.getElementById('view-title');
const searchInput = document.getElementById('search-input');
const playlistListEl = document.getElementById('playlist-list');
const trackCountLabel = document.getElementById('track-count-label');

const playBtn = document.getElementById('play-btn');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const nowTitle = document.getElementById('now-title');
const nowArtist = document.getElementById('now-artist');
const vinylEl = document.getElementById('vinyl');
const vinylCover = document.getElementById('vinyl-cover');
const seekBar = document.getElementById('seek-bar');
const timeCurrent = document.getElementById('time-current');
const timeDuration = document.getElementById('time-duration');
const volumeBar = document.getElementById('volume-bar');
const shuffleBtn = document.getElementById('shuffle-btn');
const repeatBtn = document.getElementById('repeat-btn');

const contextMenu = document.getElementById('context-menu');

// ---------- Init ----------

async function init() {
  const data = await window.melodix.loadLibrary();
  state.tracks = data.tracks || [];
  state.playlists = data.playlists || [];
  audioEl.volume = parseFloat(volumeBar.value);
  renderAll();
  bindEvents();
}

function persist() {
  window.melodix.saveLibrary(state);
}

function renderAll() {
  renderLibrary();
  renderVideoLibrary();
  renderPlaylistSidebar();
  const songCount = state.tracks.filter(t => !isVideo(t)).length;
  const videoCount = state.tracks.filter(isVideo).length;
  trackCountLabel.textContent = `${songCount} song${songCount === 1 ? '' : 's'} · ${videoCount} video${videoCount === 1 ? '' : 's'}`;
}

// ---------- Helpers ----------

function fmtTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

function findTrack(p) {
  return state.tracks.find(t => t.path === p);
}

function coverIconSvg() {
  return `<svg viewBox="0 0 24 24" width="16" height="16"><path d="M9 18V5l12-2v13" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/><circle cx="18" cy="16" r="3" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>`;
}

function filmIconSvg() {
  return `<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5" fill="none"/><path d="M10 9l6 3-6 3V9z" fill="currentColor"/></svg>`;
}

// ---------- Rendering: track rows ----------

function trackRowHTML(track, index) {
  const isPlayingRow = track.path === queue[queueIndex] && currentView === activeContextForTrack(track);
  const cover = track.cover
    ? `style="background-image:url('${track.cover.replace(/'/g, "%27")}')"`
    : '';
  const placeholderIcon = track.cover ? '' : (isVideo(track) ? filmIconSvg() : coverIconSvg());
  return `
    <div class="track-row ${isPlayingRow ? 'playing' : ''}" data-path="${encodeURIComponent(track.path)}">
      <span class="track-index">${isPlayingRow && isPlaying ? '♪' : index + 1}</span>
      <div class="track-cover" ${cover}>${placeholderIcon}</div>
      <div class="track-title-col">
        <span class="track-title">${escapeHtml(track.title)}</span>
        <span class="track-album">${escapeHtml(track.album)}</span>
      </div>
      <span class="track-artist">${escapeHtml(track.artist)}</span>
      <span class="track-duration">${isVideo(track) ? 'Video' : fmtTime(track.duration)}</span>
      <button class="track-menu-btn" data-menu="${encodeURIComponent(track.path)}">⋯</button>
    </div>`;
}

function activeContextForTrack() {
  return currentView; // simplistic — playing highlight resolved by queue match
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderLibrary() {
  const q = searchInput.value.trim().toLowerCase();
  let list = state.tracks.filter(t => !isVideo(t));
  if (q) {
    list = list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q));
  }
  const totalSongs = state.tracks.filter(t => !isVideo(t)).length;
  emptyStateEl.style.display = totalSongs === 0 ? 'flex' : 'none';
  trackListEl.style.display = (totalSongs === 0 || songLibraryCollapsed) ? 'none' : 'flex';
  trackListEl.innerHTML = list.map((t, i) => trackRowHTML(t, i)).join('');
  attachTrackRowEvents(trackListEl, list, 'library');
}

function renderVideoLibrary() {
  const q = searchInput.value.trim().toLowerCase();
  let list = state.tracks.filter(isVideo);
  if (q) {
    list = list.filter(t => t.title.toLowerCase().includes(q));
  }
  const totalVideos = state.tracks.filter(isVideo).length;
  videoEmptyStateEl.style.display = totalVideos === 0 ? 'flex' : 'none';
  videoListEl.style.display = (totalVideos === 0 || videoLibraryCollapsed) ? 'none' : 'flex';
  videoListEl.innerHTML = list.map((t, i) => trackRowHTML(t, i)).join('');
  attachVideoRowEvents(videoListEl, list);
}

function attachVideoRowEvents(container, list) {
  container.querySelectorAll('.track-row').forEach(row => {
    const p = decodeURIComponent(row.dataset.path);
    const open = () => openVideoModal(p);
    row.addEventListener('dblclick', open);
    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-menu-btn')) return;
      open();
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, p, 'library');
    });
  });
  container.querySelectorAll('.track-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      openContextMenu(rect.left, rect.bottom, decodeURIComponent(btn.dataset.menu), 'library');
    });
  });
}

function openVideoModal(path) {
  const track = findTrack(path);
  if (!track) return;
  if (isPlaying) togglePlay();
  const modal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player-el');
  document.getElementById('video-modal-title').textContent = track.title;
  videoEl.src = window.melodix.toFileUrl(track.path);
  modal.style.display = 'flex';
  videoEl.play().catch(() => {});
}

function closeVideoModal() {
  const modal = document.getElementById('video-player-modal');
  const videoEl = document.getElementById('video-player-el');
  videoEl.pause();
  videoEl.src = '';
  modal.style.display = 'none';
}

function renderPlaylistView(playlistId) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  viewTitleEl.textContent = pl.name;

  document.getElementById('playlist-header-name').textContent = pl.name;
  const count = pl.trackPaths.length;
  document.getElementById('playlist-header-count').textContent = `${count} song${count === 1 ? '' : 's'}`;
  const coverImg = document.getElementById('playlist-cover-img');
  const coverPlaceholder = document.getElementById('playlist-cover-placeholder');
  if (pl.cover) {
    coverImg.src = pl.cover;
    coverImg.style.display = 'block';
    coverPlaceholder.style.display = 'none';
  } else {
    coverImg.style.display = 'none';
    coverPlaceholder.style.display = 'block';
  }

  const list = pl.trackPaths.map(p => findTrack(p)).filter(Boolean);
  playlistTrackListEl.innerHTML = list.length
    ? list.map((t, i) => trackRowHTML(t, i)).join('')
    : `<div class="empty-state" style="display:flex"><div class="vinyl-empty"></div><h2>No songs yet</h2><p>Right-click a song in your Library and choose "Add to Playlist".</p></div>`;
  attachTrackRowEvents(playlistTrackListEl, list, 'playlist', playlistId);
}

async function changePlaylistCover(playlistId) {
  const dataUrl = await window.melodix.selectImage();
  if (!dataUrl) return;
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  pl.cover = dataUrl;
  persist();
  renderPlaylistSidebar();
  renderPlaylistView(playlistId);
}

function attachTrackRowEvents(container, list, context, playlistId) {
  container.querySelectorAll('.track-row').forEach(row => {
    const p = decodeURIComponent(row.dataset.path);
    row.addEventListener('dblclick', () => playFromList(list.map(t => t.path), list.findIndex(t => t.path === p), context, playlistId));
    row.addEventListener('click', (e) => {
      if (e.target.closest('.track-menu-btn')) return;
      playFromList(list.map(t => t.path), list.findIndex(t => t.path === p), context, playlistId);
    });
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openContextMenu(e.clientX, e.clientY, p, context, playlistId);
    });
  });
  container.querySelectorAll('.track-menu-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const rect = btn.getBoundingClientRect();
      openContextMenu(rect.left, rect.bottom, decodeURIComponent(btn.dataset.menu), context, playlistId);
    });
  });
}

// ---------- Playback ----------

function playFromList(paths, index, context, playlistId) {
  queue = paths;
  queueIndex = index;
  currentView = context === 'playlist' ? 'playlist' : 'library';
  loadAndPlay(queue[queueIndex]);
}

function loadAndPlay(path) {
  const track = findTrack(path);
  if (!track) return;
  audioEl.src = window.melodix.toFileUrl(track.path);
  audioEl.play().catch(() => {});
  isPlaying = true;
  updatePlayerUI(track);
  refreshActiveLists();
}

function updatePlayerUI(track) {
  nowTitle.textContent = track.title;
  nowArtist.textContent = track.artist;
  if (track.cover) {
    vinylCover.src = track.cover;
    vinylCover.style.display = 'block';
  } else {
    vinylCover.style.display = 'none';
  }
  vinylEl.classList.toggle('spinning', isPlaying);
  playIcon.style.display = isPlaying ? 'none' : 'block';
  pauseIcon.style.display = isPlaying ? 'block' : 'none';
}

function togglePlay() {
  if (!queue[queueIndex]) return;
  if (isPlaying) {
    audioEl.pause();
    isPlaying = false;
  } else {
    audioEl.play().catch(() => {});
    isPlaying = true;
  }
  vinylEl.classList.toggle('spinning', isPlaying);
  playIcon.style.display = isPlaying ? 'none' : 'block';
  pauseIcon.style.display = isPlaying ? 'block' : 'none';
  refreshActiveLists();
}

function playNext(auto) {
  if (queue.length === 0) return;
  if (repeatMode === 'one' && auto) {
    loadAndPlay(queue[queueIndex]);
    return;
  }
  if (shuffleOn) {
    queueIndex = Math.floor(Math.random() * queue.length);
  } else {
    queueIndex++;
    if (queueIndex >= queue.length) {
      if (repeatMode === 'all') queueIndex = 0;
      else { queueIndex = queue.length - 1; isPlaying = false; vinylEl.classList.remove('spinning'); return; }
    }
  }
  loadAndPlay(queue[queueIndex]);
}

function playPrev() {
  if (queue.length === 0) return;
  if (audioEl.currentTime > 3) { audioEl.currentTime = 0; return; }
  queueIndex--;
  if (queueIndex < 0) queueIndex = repeatMode === 'all' ? queue.length - 1 : 0;
  loadAndPlay(queue[queueIndex]);
}

function refreshActiveLists() {
  if (currentView === 'library') { renderLibrary(); renderVideoLibrary(); }
  else if (currentView === 'playlist' && currentPlaylistId) renderPlaylistView(currentPlaylistId);
}

audioEl.addEventListener('timeupdate', () => {
  if (!audioEl.duration) return;
  seekBar.value = (audioEl.currentTime / audioEl.duration) * 100;
  timeCurrent.textContent = fmtTime(audioEl.currentTime);
  timeDuration.textContent = fmtTime(audioEl.duration);
});
audioEl.addEventListener('ended', () => playNext(true));

seekBar.addEventListener('input', () => {
  if (audioEl.duration) audioEl.currentTime = (seekBar.value / 100) * audioEl.duration;
});
volumeBar.addEventListener('input', () => { audioEl.volume = parseFloat(volumeBar.value); });

// ---------- Playlists ----------

function renderPlaylistSidebar() {
  playlistListEl.innerHTML = state.playlists.map(pl => `
    <div class="playlist-item ${currentView === 'playlist' && currentPlaylistId === pl.id ? 'active' : ''}" data-id="${pl.id}">
      <span class="pl-thumb" ${pl.cover ? `style="background-image:url('${pl.cover.replace(/'/g, "%27")}')"` : ''}></span>
      <span class="pl-name">${escapeHtml(pl.name)}</span>
      <span class="pl-count">${pl.trackPaths.length}</span>
      <button class="pl-del" data-del="${pl.id}" title="Delete playlist">×</button>
    </div>`).join('');

  playlistListEl.querySelectorAll('.playlist-item').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.pl-del')) return;
      openPlaylist(el.dataset.id);
    });
  });
  playlistListEl.querySelectorAll('.pl-del').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = btn.dataset.del;
      state.playlists = state.playlists.filter(p => p.id !== id);
      persist();
      if (currentPlaylistId === id) switchView('library');
      renderPlaylistSidebar();
    });
  });
}

function openPlaylist(id) {
  currentPlaylistId = id;
  switchView('playlist');
  renderPlaylistView(id);
}

function createPlaylist(name) {
  const pl = { id: 'pl_' + Date.now(), name: name || 'New Playlist', trackPaths: [], cover: null };
  state.playlists.push(pl);
  persist();
  renderPlaylistSidebar();
  return pl;
}

function addTrackToPlaylist(playlistId, trackPath) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  if (!pl.trackPaths.includes(trackPath)) pl.trackPaths.push(trackPath);
  persist();
  renderPlaylistSidebar();
  if (currentView === 'playlist' && currentPlaylistId === playlistId) renderPlaylistView(playlistId);
}

function removeTrackFromPlaylist(playlistId, trackPath) {
  const pl = state.playlists.find(p => p.id === playlistId);
  if (!pl) return;
  pl.trackPaths = pl.trackPaths.filter(p => p !== trackPath);
  persist();
  renderPlaylistSidebar();
  renderPlaylistView(playlistId);
}

function removeTrackFromLibrary(trackPath) {
  const track = findTrack(trackPath);
  if (!track) return;
  const confirmed = confirm(`Remove "${track.title}" from your library?\n\nThis only removes it from Melodix — the file itself stays on your computer.`);
  if (!confirmed) return;

  // Stop playback if this track is currently playing
  const wasPlaying = queue[queueIndex] === trackPath;
  if (wasPlaying) {
    audioEl.pause();
    audioEl.src = '';
    isPlaying = false;
    nowTitle.textContent = 'Nothing playing';
    nowArtist.textContent = '—';
    vinylCover.style.display = 'none';
    vinylEl.classList.remove('spinning');
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
    seekBar.value = 0;
    timeCurrent.textContent = '0:00';
    timeDuration.textContent = '0:00';
  }

  // Remove from the queue, keeping the play cursor sensible
  const removedIndex = queue.indexOf(trackPath);
  if (removedIndex !== -1) {
    queue.splice(removedIndex, 1);
    if (removedIndex < queueIndex) queueIndex--;
    else if (removedIndex === queueIndex) queueIndex = Math.min(queueIndex, queue.length - 1);
  }

  // Remove from the library and from every playlist
  state.tracks = state.tracks.filter(t => t.path !== trackPath);
  state.playlists.forEach(pl => { pl.trackPaths = pl.trackPaths.filter(p => p !== trackPath); });

  persist();
  renderAll();
  refreshActiveLists();
}

// ---------- View switching ----------

function switchView(view) {
  currentView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const refreshLabel = document.getElementById('refresh-library-label');
  const refreshBtn = document.getElementById('refresh-library-btn');

  if (view === 'library') {
    document.getElementById('view-library').classList.add('active');
    document.querySelector('.nav-item[data-view="library"]').classList.add('active');
    viewTitleEl.textContent = 'Library';
    renderLibrary();
    renderVideoLibrary();
    refreshLabel.textContent = 'Refresh Library';
    refreshBtn.title = 'Re-read tags and cover art for every song';
  } else if (view === 'import') {
    document.getElementById('view-import').classList.add('active');
    document.querySelector('.nav-item[data-view="import"]').classList.add('active');
    viewTitleEl.textContent = 'Add Media';
    refreshLabel.textContent = 'Refresh Library';
    refreshBtn.title = 'Re-read tags and cover art for every song';
  } else if (view === 'playlist') {
    document.getElementById('view-playlist').classList.add('active');
    refreshLabel.textContent = 'Refresh Playlist';
    refreshBtn.title = 'Re-read tags and cover art for songs in this playlist';
  }
  renderPlaylistSidebar();
}

// ---------- Context menu ----------

function openContextMenu(x, y, trackPath, context, playlistId) {
  contextTrackPath = trackPath;
  const playlistItems = state.playlists.map(pl =>
    `<div class="context-menu-item" data-add-pl="${pl.id}">${escapeHtml(pl.name)}</div>`).join('');

  let removeItem = '';
  if (context === 'playlist' && playlistId) {
    removeItem = `<div class="context-menu-sep"></div><div class="context-menu-item" data-remove-pl="${playlistId}">Remove from this playlist</div>`;
  }

  contextMenu.innerHTML = `
    <div class="context-menu-item" data-refresh="1">⟳ Refresh metadata &amp; cover art</div>
    <div class="context-menu-sep"></div>
    <div class="context-menu-label">Add to Playlist</div>
    ${playlistItems || '<div class="context-menu-item" style="color:var(--text-faint)">No playlists yet</div>'}
    <div class="context-menu-sep"></div>
    <div class="context-menu-item" data-new-pl="1">+ New Playlist…</div>
    ${removeItem}
    <div class="context-menu-sep"></div>
    <div class="context-menu-item" data-remove-lib="1">🗑 Remove from Library</div>
  `;
  contextMenu.style.left = Math.min(x, window.innerWidth - 210) + 'px';
  contextMenu.style.top = Math.min(y, window.innerHeight - 200) + 'px';
  contextMenu.classList.add('open');

  contextMenu.querySelectorAll('[data-add-pl]').forEach(el => {
    el.addEventListener('click', () => {
      addTrackToPlaylist(el.dataset.addPl, contextTrackPath);
      closeContextMenu();
    });
  });
  const refreshEl = contextMenu.querySelector('[data-refresh]');
  if (refreshEl) refreshEl.addEventListener('click', () => {
    closeContextMenu();
    refreshTrack(contextTrackPath);
  });
  const newPlEl = contextMenu.querySelector('[data-new-pl]');
  if (newPlEl) newPlEl.addEventListener('click', () => {
    closeContextMenu();
    promptNewPlaylist(contextTrackPath);
  });
  const removeEl = contextMenu.querySelector('[data-remove-pl]');
  if (removeEl) removeEl.addEventListener('click', () => {
    removeTrackFromPlaylist(removeEl.dataset.removePl, contextTrackPath);
    closeContextMenu();
  });
  const removeLibEl = contextMenu.querySelector('[data-remove-lib]');
  if (removeLibEl) removeLibEl.addEventListener('click', () => {
    closeContextMenu();
    removeTrackFromLibrary(contextTrackPath);
  });
}

function closeContextMenu() {
  contextMenu.classList.remove('open');
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.context-menu')) closeContextMenu();
});

// ---------- New playlist modal ----------

function promptNewPlaylist(trackPathToAdd) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal-box">
      <h3>New Playlist</h3>
      <input type="text" id="new-pl-input" placeholder="Playlist name" maxlength="60" />
      <div class="modal-actions">
        <button class="secondary-btn" id="new-pl-cancel">Cancel</button>
        <button class="primary-btn" id="new-pl-create">Create</button>
      </div>
    </div>`;
  document.body.appendChild(backdrop);
  const input = backdrop.querySelector('#new-pl-input');
  input.focus();

  function close() { document.body.removeChild(backdrop); }
  backdrop.querySelector('#new-pl-cancel').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  function create() {
    const name = input.value.trim();
    if (!name) return;
    const pl = createPlaylist(name);
    if (trackPathToAdd) addTrackToPlaylist(pl.id, trackPathToAdd);
    close();
  }
  backdrop.querySelector('#new-pl-create').addEventListener('click', create);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') create(); if (e.key === 'Escape') close(); });
}

// ---------- Import ----------

async function importPaths(paths) {
  if (!paths || paths.length === 0) return;
  const expanded = await window.melodix.expandPaths(paths);
  const newPaths = expanded.filter(p => !state.tracks.some(t => t.path === p));
  if (newPaths.length === 0) return;

  const progressEl = document.getElementById('import-progress');
  const fillEl = document.getElementById('progress-fill');
  const labelEl = document.getElementById('progress-label');
  progressEl.style.display = 'block';
  labelEl.textContent = `Reading tags… 0 / ${newPaths.length}`;

  // Read metadata in small batches for progress feedback
  const batchSize = 8;
  const results = [];
  for (let i = 0; i < newPaths.length; i += batchSize) {
    const batch = newPaths.slice(i, i + batchSize);
    const meta = await window.melodix.readMetadata(batch);
    results.push(...meta);
    const done = Math.min(i + batchSize, newPaths.length);
    fillEl.style.width = `${(done / newPaths.length) * 100}%`;
    labelEl.textContent = `Reading tags… ${done} / ${newPaths.length}`;
  }

  state.tracks = state.tracks.concat(results);
  persist();
  renderAll();

  setTimeout(() => { progressEl.style.display = 'none'; fillEl.style.width = '0%'; }, 600);
  switchView('library');
}

// ---------- Refresh metadata ----------

async function refreshTrack(path) {
  const track = findTrack(path);
  if (!track) return;
  const exists = await window.melodix.fileExists(path);
  if (!exists) {
    alert(`Can't find this file anymore on disk:\n${path}`);
    return;
  }
  const [fresh] = await window.melodix.readMetadata([path]);
  if (!fresh) return;
  Object.assign(track, fresh, { path: track.path });
  persist();
  renderAll();
  refreshActiveLists();
  if (queue[queueIndex] === path) updatePlayerUI(track);
}

async function refreshTracksByPaths(paths, returnView, returnPlaylistId) {
  if (paths.length === 0) return;

  const progressEl = document.getElementById('import-progress');
  const fillEl = document.getElementById('progress-fill');
  const labelEl = document.getElementById('progress-label');
  const wasOnImport = currentView === 'import';
  if (!wasOnImport) switchView('import');
  progressEl.style.display = 'block';
  labelEl.textContent = `Refreshing tags… 0 / ${paths.length}`;

  const batchSize = 8;
  const updated = [];
  for (let i = 0; i < paths.length; i += batchSize) {
    const batch = paths.slice(i, i + batchSize);
    const meta = await window.melodix.readMetadata(batch);
    updated.push(...meta);
    const done = Math.min(i + batchSize, paths.length);
    fillEl.style.width = `${(done / paths.length) * 100}%`;
    labelEl.textContent = `Refreshing tags… ${done} / ${paths.length}`;
  }

  const byPath = new Map(updated.map(t => [t.path, t]));
  state.tracks = state.tracks.map(t => byPath.has(t.path) ? { ...t, ...byPath.get(t.path) } : t);
  persist();
  renderAll();

  if (returnView === 'playlist' && returnPlaylistId) {
    openPlaylist(returnPlaylistId);
  } else {
    refreshActiveLists();
  }
  const playing = findTrack(queue[queueIndex]);
  if (playing) updatePlayerUI(playing);

  setTimeout(() => { progressEl.style.display = 'none'; fillEl.style.width = '0%'; }, 600);
}

async function refreshAllTracks() {
  await refreshTracksByPaths(state.tracks.map(t => t.path), 'library', null);
}

async function refreshCurrentPlaylistTracks() {
  const pl = state.playlists.find(p => p.id === currentPlaylistId);
  if (!pl) return;
  await refreshTracksByPaths(pl.trackPaths.slice(), 'playlist', pl.id);
}

// ---------- Drag & drop ----------

let dragCounter = 0;

function setupDragDrop() {
  const overlay = document.getElementById('drop-overlay');

  window.addEventListener('dragenter', (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer.types.includes('Files')) overlay.classList.add('active');
  });
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('dragleave', (e) => {
    dragCounter--;
    if (dragCounter <= 0) { overlay.classList.remove('active'); dragCounter = 0; }
  });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    dragCounter = 0;
    overlay.classList.remove('active');
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    const paths = files.map(f => window.melodix.getPathForFile(f)).filter(Boolean);
    await importPaths(paths);
  });

  // Dedicated import dropzone gets the same handling visually
  const dz = document.getElementById('import-dropzone');
  dz.addEventListener('dragover', (e) => { e.preventDefault(); dz.classList.add('drag-over'); });
  dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
  dz.addEventListener('drop', () => dz.classList.remove('drag-over'));
}

// ---------- Custom titlebar ----------

function setupTitlebar() {
  document.getElementById('titlebar-minimize').addEventListener('click', () => window.melodix.windowMinimize());
  document.getElementById('titlebar-close').addEventListener('click', () => window.melodix.windowClose());

  const maximizeIcon = document.getElementById('titlebar-maximize-icon');
  const restoreIcon = document.getElementById('titlebar-restore-icon');
  const maximizeBtn = document.getElementById('titlebar-maximize');

  function setMaximizedIcon(isMaximized) {
    maximizeIcon.style.display = isMaximized ? 'none' : 'block';
    restoreIcon.style.display = isMaximized ? 'block' : 'none';
    maximizeBtn.title = isMaximized ? 'Restore' : 'Maximize';
  }

  maximizeBtn.addEventListener('click', () => window.melodix.windowMaximizeToggle());
  window.melodix.windowIsMaximized().then(setMaximizedIcon);
  window.melodix.onWindowMaximizedState(setMaximizedIcon);

  // Double-clicking the drag region also toggles maximize, matching native title bars
  document.getElementById('titlebar').addEventListener('dblclick', (e) => {
    if (e.target.closest('.titlebar-controls')) return;
    window.melodix.windowMaximizeToggle();
  });
}

// ---------- Event binding ----------

function bindEvents() {
  setupTitlebar();

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => switchView(el.dataset.view));
  });
  document.getElementById('new-playlist-btn').addEventListener('click', () => promptNewPlaylist(null));
  document.getElementById('playlist-cover-btn').addEventListener('click', () => {
    if (currentPlaylistId) changePlaylistCover(currentPlaylistId);
  });
  document.getElementById('empty-add-btn').addEventListener('click', () => switchView('import'));
  const emptyAddVideoBtn = document.getElementById('empty-add-video-btn');
  if (emptyAddVideoBtn) emptyAddVideoBtn.addEventListener('click', () => switchView('import'));

  const toggleSongBtn = document.getElementById('toggle-song-library-btn');
  toggleSongBtn.addEventListener('click', () => {
    songLibraryCollapsed = !songLibraryCollapsed;
    toggleSongBtn.classList.toggle('collapsed', songLibraryCollapsed);
    document.getElementById('toggle-song-library-label').textContent = songLibraryCollapsed ? 'Show' : 'Hide';
    renderLibrary();
  });

  const toggleVideoBtn = document.getElementById('toggle-video-library-btn');
  toggleVideoBtn.addEventListener('click', () => {
    videoLibraryCollapsed = !videoLibraryCollapsed;
    toggleVideoBtn.classList.toggle('collapsed', videoLibraryCollapsed);
    document.getElementById('toggle-video-library-label').textContent = videoLibraryCollapsed ? 'Show' : 'Hide';
    renderVideoLibrary();
  });

  document.getElementById('video-modal-close').addEventListener('click', closeVideoModal);
  document.getElementById('video-player-modal').addEventListener('click', (e) => {
    if (e.target.id === 'video-player-modal') closeVideoModal();
  });

  document.getElementById('pick-files-btn').addEventListener('click', async () => {
    const paths = await window.melodix.selectFiles();
    await importPaths(paths);
  });
  document.getElementById('pick-folder-btn').addEventListener('click', async () => {
    const paths = await window.melodix.selectFolder();
    if (paths) await importPaths(paths);
  });

  searchInput.addEventListener('input', () => { renderLibrary(); renderVideoLibrary(); });
  document.getElementById('refresh-library-btn').addEventListener('click', () => {
    if (currentView === 'playlist') refreshCurrentPlaylistTracks();
    else refreshAllTracks();
  });

  playBtn.addEventListener('click', togglePlay);
  document.getElementById('next-btn').addEventListener('click', () => playNext(false));
  document.getElementById('prev-btn').addEventListener('click', playPrev);
  shuffleBtn.addEventListener('click', () => { shuffleOn = !shuffleOn; shuffleBtn.classList.toggle('active', shuffleOn); });
  repeatBtn.addEventListener('click', () => {
    repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    repeatBtn.classList.toggle('active', repeatMode !== 'off');
    repeatBtn.title = repeatMode === 'one' ? 'Repeat One' : repeatMode === 'all' ? 'Repeat All' : 'Repeat';
  });

  document.getElementById('add-to-playlist-btn').addEventListener('click', (e) => {
    if (!queue[queueIndex]) return;
    const rect = e.currentTarget.getBoundingClientRect();
    openContextMenu(rect.left, rect.top - 10, queue[queueIndex], 'library');
  });

  setupDragDrop();

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.activeElement.tagName !== 'INPUT') {
      e.preventDefault();
      togglePlay();
    }
  });
}

init();
