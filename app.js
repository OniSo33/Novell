/**
 * GitHub Novel Data Fetcher, Reader & Scraper
 * Repository Target: OniSo33/Onisoo
 * Branch: claude/read-4d3wcj / chapters
 */

document.addEventListener('DOMContentLoaded', () => {
  // Default Source (single place so settings reset and first load always agree)
  const DEFAULT_REPO = 'OniSo33/Onisoo';
  const DEFAULT_BRANCH = 'claude/read-4d3wcj';
  const DEFAULT_PATH = 'chapters';

  // Free voice (no sign-up) is the default; ResponsiveVoice is only used when an API key is set
  const FREE_DEFAULT_VOICE = 'auto';
  // 0.1s of real silence (a zero-length WAV fails to play on some browsers)
  const SILENT_WAV = 'data:audio/wav;base64,UklGRkQDAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YSADAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==';

  function getInitialVoice() {
    const saved = localStorage.getItem('gnr_ttsVoiceURI');
    if (!saved || saved === 'default_th') return FREE_DEFAULT_VOICE;
    if (saved.startsWith('rv_th') && !localStorage.getItem('gnr_rvKey')) return FREE_DEFAULT_VOICE;
    return saved;
  }

  // Config State
  const state = {
    repo: localStorage.getItem('gnr_repo') || DEFAULT_REPO,
    branch: localStorage.getItem('gnr_branch') || DEFAULT_BRANCH,
    path: localStorage.getItem('gnr_path') || DEFAULT_PATH,
    // Token lives only in this tab (sessionStorage) unless the user opts in to remember it
    token: sessionStorage.getItem('gnr_token') || localStorage.getItem('gnr_token') || '',
    rememberToken: !!localStorage.getItem('gnr_token'),
    rvKey: localStorage.getItem('gnr_rvKey') || '',
    
    chapters: [],
    filteredChapters: [],
    currentChapterIndex: -1,
    currentChapterItem: null,
    currentChapterData: null,
    chapterLoadToken: 0,
    chapterListToken: 0,
    
    bookmarks: JSON.parse(localStorage.getItem('gnr_bookmarks') || '[]'),
    readHistory: JSON.parse(localStorage.getItem('gnr_history') || '{}'),
    
    sortOrder: 'asc', // 'asc' or 'desc'
    filterBookmarked: false,
    
    fontSize: parseInt(localStorage.getItem('gnr_fontSize') || '18'),
    fontFamily: localStorage.getItem('gnr_fontFamily') || 'font-prompt',
    lineHeight: localStorage.getItem('gnr_lineHeight') || '1.9',
    theme: localStorage.getItem('gnr_theme') || 'theme-cyber-dark',
    
    ttsState: 'idle', // 'idle', 'playing', 'paused'
    ttsMuted: false,
    ttsRate: parseFloat(localStorage.getItem('gnr_ttsRate') || '1.0'),
    selectedVoiceURI: getInitialVoice(),
    voices: [],
    ttsCurrentIndex: 0,
    ttsParagraphElements: [],
    ttsSubChunks: [],
    ttsSubIndex: 0,
    synth: window.speechSynthesis || null,
    currentUtterance: null,
    ttsSession: 0, // Bumped on every stop so late callbacks from old audio are ignored
    ttsEngineAttempts: 0, // Engine fallbacks tried for the current chunk (prevents endless fallback loops)
    // Both resolved once per reading session (not per chunk) so the voice never flips mid-chapter —
    // the browser's voice list/order can be unstable (iOS re-reports it as enhanced voices finish
    // downloading), which otherwise made "auto" jump between engines or between two device voices
    ttsResolvedMode: null,
    ttsResolvedDeviceVoice: null,
    ttsStartAttempt: 0, // guards startTTSReading()'s async voice warm-up against a rapid double press
    
    // HTML5 Cloud Audio Engine & iOS Native Speech Engine
    cloudAudio: new Audio(),
    iosKeepAliveTimer: null,
    
    // Background Audio Keeper for Screen Lock
    silentAudio: new Audio(SILENT_WAV),
    cloudPrimed: false,
    audioWatchdog: null,
    wakeLock: null,
    ttsPrefetch: new Map()
  };
  state.silentAudio.loop = true;

  // DOM Elements Selector Cache
  const elements = {
    sidebar: document.getElementById('sidebar'),
    sidebarOverlay: document.getElementById('sidebarOverlay'),
    btnToggleSidebar: document.getElementById('btnToggleSidebar'),
    chapterList: document.getElementById('chapterList'),
    chapterCountBadge: document.getElementById('chapterCountBadge'),
    searchInput: document.getElementById('searchInput'),
    btnClearSearch: document.getElementById('btnClearSearch'),
    btnSortAsc: document.getElementById('btnSortAsc'),
    btnSortDesc: document.getElementById('btnSortDesc'),
    btnFilterBookmarked: document.getElementById('btnFilterBookmarked'),
    
    btnSync: document.getElementById('btnSync'),
    syncIcon: document.getElementById('syncIcon'),
    quickUrlInput: document.getElementById('quickUrlInput'),
    btnQuickFetch: document.getElementById('btnQuickFetch'),
    statusText: document.getElementById('statusText'),
    liveStatusPill: document.getElementById('liveStatusPill'),
    lastSyncTime: document.getElementById('lastSyncTime'),
    
    // View Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),
    
    // Reader Controls
    progressBar: document.getElementById('progressBar'),
    contentArea: document.querySelector('.content-area'),
    readerCard: document.getElementById('readerCard'),
    chapterTitle: document.getElementById('chapterTitle'),
    chapterSubtitle: document.getElementById('chapterSubtitle'),
    chapterCategory: document.getElementById('chapterCategory'),
    wordCountBadge: document.getElementById('wordCountBadge'),
    readTimeBadge: document.getElementById('readTimeBadge'),
    chapterBody: document.getElementById('chapterBody'),
    
    btnPrevChapter: document.getElementById('btnPrevChapter'),
    btnNextChapter: document.getElementById('btnNextChapter'),
    btnPrevChapterFooter: document.getElementById('btnPrevChapterFooter'),
    btnNextChapterFooter: document.getElementById('btnNextChapterFooter'),
    
    btnBookmark: document.getElementById('btnBookmark'),
    bookmarkIcon: document.getElementById('bookmarkIcon'),
    
    // TTS Elements
    btnTTSPlayPause: document.getElementById('btnTTSPlayPause'),
    btnTTSTest: document.getElementById('btnTTSTest'),
    ttsPlayIcon: document.getElementById('ttsPlayIcon'),
    ttsPlayText: document.getElementById('ttsPlayText'),
    btnTTSStop: document.getElementById('btnTTSStop'),
    btnTTSMute: document.getElementById('btnTTSMute'),
    ttsMuteIcon: document.getElementById('ttsMuteIcon'),
    ttsMuteText: document.getElementById('ttsMuteText'),
    ttsSpeedContainer: document.getElementById('ttsSpeedContainer'),
    ttsSpeedSelect: document.getElementById('ttsSpeedSelect'),
    ttsVoiceContainer: document.getElementById('ttsVoiceContainer'),
    ttsVoiceSelect: document.getElementById('ttsVoiceSelect'),
    
    btnFontInc: document.getElementById('btnFontInc'),
    btnFontDec: document.getElementById('btnFontDec'),
    fontSizeDisplay: document.getElementById('fontSizeDisplay'),
    themeDots: document.querySelectorAll('.theme-dot'),
    
    // Inspector Tab
    inspectFileName: document.getElementById('inspectFileName'),
    inspectFileSize: document.getElementById('inspectFileSize'),
    inspectCharCount: document.getElementById('inspectCharCount'),
    inspectRawUrl: document.getElementById('inspectRawUrl'),
    rawCodeViewer: document.getElementById('rawCodeViewer'),
    btnCopyRaw: document.getElementById('btnCopyRaw'),
    
    // Export Tab
    btnExportTxt: document.getElementById('btnExportTxt'),
    btnExportJson: document.getElementById('btnExportJson'),
    btnClearCache: document.getElementById('btnClearCache'),
    
    // Settings Modal
    btnSettings: document.getElementById('btnSettings'),
    settingsModal: document.getElementById('settingsModal'),
    btnCloseSettings: document.getElementById('btnCloseSettings'),
    btnSaveSettings: document.getElementById('btnSaveSettings'),
    repoInput: document.getElementById('repoInput'),
    branchInput: document.getElementById('branchInput'),
    pathInput: document.getElementById('pathInput'),
    tokenInput: document.getElementById('tokenInput'),
    rememberTokenCheck: document.getElementById('rememberTokenCheck'),
    rvKeyInput: document.getElementById('rvKeyInput'),
    fontFamilySelect: document.getElementById('fontFamilySelect'),
    lineHeightSelect: document.getElementById('lineHeightSelect'),
    
    branchNameLabel: document.getElementById('branchNameLabel'),
    repoNameLabel: document.getElementById('repoNameLabel'),

    toastContainer: document.getElementById('toastContainer')
  };

  /* ==========================================================================
     Initialization & Theme Setup
     ========================================================================== */

  function parseGitHubUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return null;
    const cleanUrl = urlStr.trim().replace(/[?#].*$/, '').replace(/\/+$/, '');

    // Pattern e.g. https://github.com/OniSo33/Onisoo/tree/claude/read-4d3wcj/chapters
    // Branch names may contain "/", so the branch/path split is resolved later (resolveTreeSegments)
    const treeMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/(.+)/i);
    if (treeMatch) {
      return {
        repo: `${treeMatch[1]}/${treeMatch[2].replace(/\.git$/i, '')}`,
        treeSegments: treeMatch[3].split('/').filter(Boolean).map(seg => decodeURIComponent(seg))
      };
    }

    // Pattern e.g. https://github.com/owner/repo or owner/repo
    const simpleMatch = cleanUrl.match(/(?:github\.com\/)?([^\/\s]+)\/([^\/\s]+)/i);
    if (simpleMatch) {
      return {
        repo: `${simpleMatch[1]}/${simpleMatch[2].replace(/\.git$/i, '')}`,
        // HEAD = the repository's default branch (works for both the API and raw URLs)
        branch: 'HEAD',
        path: DEFAULT_PATH
      };
    }

    return null;
  }

  // Finds which leading segments of a /tree/ URL form an existing branch (longest first)
  async function resolveTreeSegments(repo, segments) {
    const [owner, repoName] = repo.split('/');
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (state.token) headers['Authorization'] = `token ${state.token}`;

    for (let cut = segments.length; cut >= 1; cut--) {
      const branch = segments.slice(0, cut).join('/');
      try {
        const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}/branches/${encodeURIComponent(branch)}`, { headers });
        if (res.ok) {
          return { branch, path: segments.slice(cut).join('/') || DEFAULT_PATH };
        }
        if (res.status !== 404) break; // Rate limited or offline: use the heuristic below
      } catch (e) {
        break;
      }
    }

    // Heuristic when the API can't tell us: the last segment is the folder
    if (segments.length === 1) return { branch: segments[0], path: DEFAULT_PATH };
    return { branch: segments.slice(0, -1).join('/'), path: segments[segments.length - 1] };
  }

  function saveToken() {
    sessionStorage.removeItem('gnr_token');
    localStorage.removeItem('gnr_token');
    if (!state.token) return;
    if (state.rememberToken) {
      localStorage.setItem('gnr_token', state.token);
    } else {
      sessionStorage.setItem('gnr_token', state.token);
    }
  }

  // ResponsiveVoice needs a real API key; without one the other engines are used instead
  function loadResponsiveVoice(key) {
    if (!key || window.responsiveVoice || document.getElementById('rvScript')) return;
    const script = document.createElement('script');
    script.id = 'rvScript';
    script.src = `https://code.responsivevoice.org/responsivevoice.js?key=${encodeURIComponent(key)}`;
    script.onload = () => populateVoices();
    script.onerror = () => showToast('โหลด ResponsiveVoice ไม่สำเร็จ — ใช้เสียงระบบอื่นแทน', 'error');
    document.head.appendChild(script);
  }

  function init() {
    applyTheme(state.theme);
    applyTypography();
    setupEventListeners();
    
    // Populate settings inputs
    elements.repoInput.value = state.repo;
    elements.branchInput.value = state.branch;
    elements.pathInput.value = state.path;
    elements.tokenInput.value = state.token;
    elements.rememberTokenCheck.checked = state.rememberToken;
    elements.rvKeyInput.value = state.rvKey;
    loadResponsiveVoice(state.rvKey);
    elements.fontFamilySelect.value = state.fontFamily;
    elements.lineHeightSelect.value = state.lineHeight;

    // Initialize TTS voices
    populateVoices();
    if (state.synth) {
      state.synth.onvoiceschanged = populateVoices;
    }

    // Drop the cache key used by older versions (it did not include the folder path)
    localStorage.removeItem(`gnr_cache_${state.repo}_${state.branch}`);

    // Load initial chapter list
    fetchGitHubChapters();
  }

  function applyTheme(newTheme) {
    document.body.className = '';
    document.body.classList.add(newTheme);
    state.theme = newTheme;
    localStorage.setItem('gnr_theme', newTheme);
  }

  function applyTypography() {
    elements.chapterBody.style.fontSize = `${state.fontSize}px`;
    elements.fontSizeDisplay.textContent = `${state.fontSize}px`;
    
    elements.chapterBody.style.lineHeight = state.lineHeight;
    
    // Font family class
    elements.chapterBody.classList.remove('font-prompt', 'font-sarabun', 'font-inter');
    elements.chapterBody.classList.add(state.fontFamily);
  }

  /* ==========================================================================
     GitHub Data Engine (Fetch & Scrape)
     ========================================================================== */

  async function fetchGitHubChapters() {
    // A newer fetch (e.g. after switching repo) makes this one stale
    const fetchToken = ++state.chapterListToken;
    const isStale = () => fetchToken !== state.chapterListToken;
    setLoadingState(true, 'กำลังสตรีมข้อมูลนิยายทั้งหมดจาก GitHub...');
    // Show the source actually being read (these labels were hard-coded before)
    elements.repoNameLabel.textContent = state.repo;
    elements.branchNameLabel.textContent = state.branch;
    elements.branchNameLabel.title = `Branch: ${state.branch} / ${state.path}`;
    
    const [owner, repo] = state.repo.split('/');
    const cleanPath = state.path.replace(/^\/|\/$/g, '');
    // Use GitHub Git Trees API (recursive=1) to fetch 100% of all files in branch without pagination limits
    const treeApiUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(state.branch)}?recursive=1`;
    
    const headers = { 'Accept': 'application/vnd.github.v3+json' };
    if (state.token) {
      headers['Authorization'] = `token ${state.token}`;
    }

    try {
      let files = [];
      const treeResponse = await fetch(treeApiUrl, { headers });

      if (treeResponse.ok) {
        const treeData = await treeResponse.json();
        if (treeData && Array.isArray(treeData.tree)) {
          // Filter all items inside the target path directory
          const targetPrefix = cleanPath ? `${cleanPath}/` : '';
          files = treeData.tree
            .filter(item => item.type === 'blob' && item.path.startsWith(targetPrefix))
            .map(item => ({
              name: item.path.substring(targetPrefix.length),
              path: item.path,
              sha: item.sha,
              size: item.size || 0,
              download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${state.branch}/${item.path}`
            }));
        }
      }

      // Fallback to standard contents API if tree API returns empty
      if (files.length === 0) {
        const contentsApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${cleanPath}?ref=${encodeURIComponent(state.branch)}&per_page=100`;
        const res = await fetch(contentsApiUrl, { headers });
        if (res.ok) {
          const contentsData = await res.json();
          if (Array.isArray(contentsData)) {
            files = contentsData.filter(f => f.type === 'file');
          }
        }
      }

      if (isStale()) return;

      // Skip hidden helper files such as .gitkeep
      files = files.filter(f => !f.name.split('/').pop().startsWith('.'));

      if (files.length === 0) {
        throw new Error('ไม่สามารถดึงข้อมูลรายการไฟล์จาก GitHub API ได้');
      }

      // Format and sort 100% of chapters
      const cachedById = new Map((readChaptersCache() || []).map(c => [c.id, c]));
      state.chapters = files.map((file, index) => {
        // Extract numbers e.g. 0000, 0001, chapter_12, etc.
        const matchNum = file.name.match(/\d+/);
        const filePath = file.path || (cleanPath ? `${cleanPath}/${file.name}` : file.name);
        const chapter = {
          // File path is stable across edits (unlike the blob sha), so bookmarks survive updates
          id: filePath,
          sha: file.sha || '',
          name: file.name,
          number: matchNum ? parseInt(matchNum[0], 10) : index,
          rawUrl: file.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${state.branch}/${filePath}`,
          size: file.size || 0,
          content: null,
          loaded: false
        };

        // Reuse offline-cached content when the file has not changed since it was cached
        const cached = cachedById.get(chapter.id);
        if (cached && cached.content && cached.sha && cached.sha === chapter.sha) {
          chapter.content = cached.content;
          chapter.loaded = true;
        }
        return chapter;
      });

      migrateLegacyChapterIds(state.chapters);
      sortChapters();
      updateLastSyncTime();
      showToast(`ดึงข้อมูลครบถ้วน! พบทั้งหมด ${state.chapters.length} บท`, 'success');
      setLoadingState(false, `ดึงข้อมูลครบ 100% (${state.chapters.length} บท)`);
      saveChaptersToCache();
      openInitialChapter();

    } catch (err) {
      if (isStale()) return;
      console.warn('GitHub API Tree fetch warning:', err.message);
      await handleFetchFallback(isStale);
    }
  }

  // Older versions keyed bookmarks/history by blob sha, which changes on every edit.
  function migrateLegacyChapterIds(chapters) {
    const bySha = new Map(chapters.filter(c => c.sha).map(c => [c.sha, c.id]));
    if (bySha.size === 0) return;

    state.bookmarks = [...new Set(state.bookmarks.map(id => bySha.get(id) || id))];
    localStorage.setItem('gnr_bookmarks', JSON.stringify(state.bookmarks));

    Object.keys(state.readHistory).forEach(id => {
      const newId = bySha.get(id);
      if (newId) {
        delete state.readHistory[id];
        state.readHistory[newId] = true;
      }
    });
    localStorage.setItem('gnr_history', JSON.stringify(state.readHistory));

    const lastReadId = localStorage.getItem('gnr_lastReadId');
    if (lastReadId && bySha.has(lastReadId)) {
      localStorage.setItem('gnr_lastReadId', bySha.get(lastReadId));
    }
  }

  function openInitialChapter() {
    if (state.chapters.length === 0) {
      renderEmptyState('ไม่พบไฟล์บทนิยายในโฟลเดอร์นี้');
      return;
    }

    // Look up in the (possibly filtered) list that loadChapter indexes into
    const lastReadId = localStorage.getItem('gnr_lastReadId');
    let initialIndex = 0;
    if (lastReadId) {
      const foundIdx = state.filteredChapters.findIndex(c => c.id === lastReadId || c.name === lastReadId);
      if (foundIdx !== -1) initialIndex = foundIdx;
    }
    loadChapter(initialIndex);
  }

  async function handleFetchFallback(isStale) {
    // 1) Offline cache from the last successful sync of this repo/branch/path
    const cachedChapters = readChaptersCache();
    if (cachedChapters && cachedChapters.length > 0) {
      state.chapters = cachedChapters;
      sortChapters();
      setLoadingState(false, `ใช้ข้อมูลออฟไลน์ (${state.chapters.length} บท)`);
      showToast(`เชื่อมต่อ GitHub API ไม่ได้ — ใช้รายการบทที่บันทึกไว้ ${state.chapters.length} บท`, 'info');
      openInitialChapter();
      return;
    }

    // 2) Direct raw probes for common chapter file names (raw server has no API rate limit)
    setLoadingState(true, 'กำลังค้นหาไฟล์บทผ่าน Raw URL...');
    const [owner, repo] = state.repo.split('/');
    const cleanPath = state.path.replace(/^\/|\/$/g, '');
    const extensions = ['md', 'txt', 'json'];
    const candidatesFor = (n) => {
      const padded = n.toString().padStart(4, '0');
      const names = [];
      extensions.forEach(ext => {
        names.push(`${padded}.${ext}`, `chapter_${n}.${ext}`);
      });
      return names;
    };

    const discoveredChapters = [];
    const batchSize = 10;
    const maxGap = 20;
    let lastFound = -1;

    for (let start = 0; start <= 100; start += batchSize) {
      const probes = [];
      for (let n = start; n < start + batchSize && n <= 100; n++) {
        candidatesFor(n).forEach(fileName => {
          const filePath = cleanPath ? `${cleanPath}/${fileName}` : fileName;
          const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${state.branch}/${filePath}`;
          probes.push(
            fetch(rawUrl, { method: 'HEAD' })
              .then(res => (res.ok ? { n, fileName, filePath, rawUrl } : null))
              .catch(() => null)
          );
        });
      }

      const results = await Promise.all(probes);
      if (isStale()) return;
      results.filter(Boolean).forEach(hit => {
        lastFound = Math.max(lastFound, hit.n);
        discoveredChapters.push({
          id: hit.filePath,
          sha: '',
          name: hit.fileName,
          number: hit.n,
          rawUrl: hit.rawUrl,
          size: 0,
          content: null,
          loaded: false
        });
      });

      // Stop once we are well past the last chapter found
      if (start + batchSize - 1 > lastFound + maxGap) break;
    }

    if (discoveredChapters.length > 0) {
      state.chapters = discoveredChapters;
      sortChapters();
      setLoadingState(false, `ดึงตรงผ่าน Direct Raw (${state.chapters.length} บท)`);
      showToast(`ดึงข้อมูลนิยายสำเร็จ! พบ ${state.chapters.length} บท`, 'success');
      openInitialChapter();
      return;
    }

    // Display clear Rate Limit warning with Token guide
    setLoadingState(false, 'ติด Rate Limit (ใส่ Token ในตั้งค่า)');
    showToast(`🔒 GitHub API Rate Limit: ใส่ Token ใน ⚙️ ตั้งค่า เพื่อดึงทุกตอนได้ไม่จำกัด`, 'error');
    renderEmptyState('ติดขัด GitHub Rate Limit (60 ครั้ง/ชม.): กรุณาใส่ GitHub Token ใน ⚙️ ตั้งค่า เพื่อดึงนิยายทุกตอนได้ไม่จำกัด');
  }

  async function loadChapter(index) {
    if (index < 0 || index >= state.filteredChapters.length) return;
    
    // Guards against a slower earlier request overwriting the chapter the user picked last
    const loadToken = ++state.chapterLoadToken;

    // Never keep reading the previous chapter's paragraphs aloud over the new one
    if (state.ttsState !== 'idle') {
      resetTTSState();
    }

    state.currentChapterIndex = index;
    const chapterItem = state.filteredChapters[index];
    state.currentChapterItem = chapterItem;
    
    renderSidebarList(); // Update active selection in sidebar
    updateNavigationButtons();

    // Show loading skeleton in body
    elements.chapterTitle.textContent = `กำลังโหลดตอนที่ ${chapterItem.number}...`;
    elements.chapterSubtitle.textContent = `ไฟล์: ${chapterItem.name}`;
    elements.chapterBody.innerHTML = `
      <div class="welcome-placeholder">
        <div class="placeholder-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <h3>กำลังสกัดเนื้อหาจาก Raw Content URL...</h3>
        <p>${escapeHtml(chapterItem.rawUrl)}</p>
      </div>
    `;

    // Reset scroll position
    elements.contentArea.scrollTop = 0;

    try {
      let rawText = '';
      if (chapterItem.content) {
        rawText = chapterItem.content;
      } else {
        const response = await fetch(chapterItem.rawUrl);
        if (!response.ok) {
          throw new Error(`ไม่สามารถโหลดไฟล์ raw ได้ (${response.status})`);
        }
        rawText = await response.text();
        chapterItem.content = rawText;
        chapterItem.loaded = true;
      }

      if (loadToken !== state.chapterLoadToken) return;

      // Process & Parse Payload
      parseAndDisplayChapter(chapterItem, rawText);

      // Save Cache
      saveChaptersToCache();
      
      // Save last read history
      localStorage.setItem('gnr_lastReadId', chapterItem.id);
      state.readHistory[chapterItem.id] = true;
      localStorage.setItem('gnr_history', JSON.stringify(state.readHistory));
      renderSidebarList();

    } catch (err) {
      if (loadToken !== state.chapterLoadToken) return;
      console.error('Error loading chapter content:', err);
      renderChapterError(chapterItem, err.message);
    }
  }

  function parseAndDisplayChapter(chapterItem, rawText) {
    const baseName = chapterItem.name.replace(/\.[^/.]+$/, '');
    const isMarkdown = /\.(md|markdown)$/i.test(chapterItem.name);

    let parsedData = {
      title: `ตอนที่ ${chapterItem.number}: ${baseName}`,
      subtitle: `GitHub Raw Data • ${state.repo}`,
      body: ''
    };

    let isJson = false;

    // Try parsing as JSON first
    try {
      const json = JSON.parse(rawText);
      if (json === null || typeof json !== 'object') throw new Error('not a JSON object');
      isJson = true;
      parsedData.title = json.title || json.name || json.chapter_name || parsedData.title;
      parsedData.subtitle = json.subtitle || json.author || parsedData.subtitle;
      
      if (typeof json.content === 'string') {
        parsedData.body = json.content;
      } else if (Array.isArray(json.paragraphs)) {
        parsedData.body = json.paragraphs.join('\n\n');
      } else if (Array.isArray(json.content)) {
        parsedData.body = json.content.join('\n\n');
      } else {
        parsedData.body = JSON.stringify(json, null, 2);
      }
    } catch (e) {
      // Plain text or Markdown content
      parsedData.body = rawText;
    }

    let bodyHtml;
    if (!isJson && isMarkdown) {
      const md = renderMarkdown(parsedData.body);
      if (md.title) parsedData.title = md.title;
      bodyHtml = md.html;
    } else {
      // Format body paragraphs cleanly (split by single or double newlines)
      bodyHtml = parsedData.body
        .split(/\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 0)
        .map(p => `<p>${escapeHtml(p)}</p>`)
        .join('');
    }

    state.currentChapterData = {
      chapterItem,
      rawText,
      parsedData,
      isJson
    };

    // Render UI
    elements.chapterTitle.textContent = parsedData.title;
    elements.chapterSubtitle.textContent = parsedData.subtitle;
    elements.chapterBody.innerHTML = bodyHtml || `<p>${escapeHtml(parsedData.body)}</p>`;

    // Update metadata badges from the rendered text (no markdown symbols)
    const visibleText = elements.chapterBody.textContent;
    const wordCount = countWords(visibleText);
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));

    elements.wordCountBadge.innerHTML = `<i class="fa-solid fa-file-lines"></i> ${wordCount.toLocaleString()} คำ`;
    elements.readTimeBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ~${readTimeMinutes} นาที`;
    elements.chapterCategory.innerHTML = `<i class="fa-solid fa-folder"></i> ${escapeHtml(state.path)}`;

    // Update Inspector View
    updateInspectorView(chapterItem, rawText, parsedData.body.length);
    
    // Update Bookmark button UI
    updateBookmarkUI(chapterItem.id);
  }

  // Minimal Markdown renderer for chapter files: headings, dividers, quotes, lists, bold/italic/code
  function renderMarkdown(text) {
    let title = '';
    let seenContent = false;
    const blocks = [];

    text.split(/\n/).forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
      if (heading) {
        // The first H1 before any content is the chapter title
        if (heading[1].length === 1 && !title && !seenContent) {
          title = heading[2].replace(/\s*#+\s*$/, '').trim();
          return;
        }
        blocks.push(`<h3 class="md-heading">${renderInlineMarkdown(heading[2])}</h3>`);
      } else if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        blocks.push('<hr class="md-divider">');
      } else if (/^>\s?/.test(trimmed)) {
        blocks.push(`<blockquote class="md-quote"><p>${renderInlineMarkdown(trimmed.replace(/^>\s?/, ''))}</p></blockquote>`);
      } else if (/^[-*+]\s+/.test(trimmed)) {
        blocks.push(`<p class="md-list-item">• ${renderInlineMarkdown(trimmed.replace(/^[-*+]\s+/, ''))}</p>`);
      } else {
        blocks.push(`<p>${renderInlineMarkdown(trimmed)}</p>`);
      }
      seenContent = true;
    });

    return { title, html: blocks.join('') };
  }

  function renderInlineMarkdown(str) {
    return escapeHtml(str)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/\*([^*\s][^*]*)\*/g, '<em>$1</em>');
  }

  // Thai has no spaces between words, so use the word segmenter when the browser has one
  function countWords(text) {
    const cleanText = text.trim();
    if (!cleanText) return 0;
    if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
      let count = 0;
      const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
      for (const segment of segmenter.segment(cleanText)) {
        if (segment.isWordLike) count++;
      }
      return count;
    }
    return cleanText.split(/\s+/).length;
  }

  function renderChapterError(chapterItem, message) {
    state.currentChapterData = null;

    elements.chapterTitle.textContent = `โหลดตอนที่ ${chapterItem.number} ไม่สำเร็จ`;
    elements.chapterSubtitle.textContent = `ไฟล์: ${chapterItem.name}`;
    elements.chapterBody.innerHTML = `
      <div class="welcome-placeholder">
        <div class="placeholder-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
        <h3>ไม่สามารถโหลดเนื้อหาตอนนี้ได้</h3>
        <p>${escapeHtml(message)}</p>
        <p>${escapeHtml(chapterItem.rawUrl)}</p>
        <button type="button" class="btn btn-primary" id="btnRetryChapter">
          <i class="fa-solid fa-rotate-right"></i> ลองโหลดใหม่
        </button>
      </div>
    `;
    updateInspectorView(chapterItem, '', 0);
    elements.wordCountBadge.innerHTML = `<i class="fa-solid fa-file-lines"></i> - คำ`;
    elements.readTimeBadge.innerHTML = `<i class="fa-solid fa-clock"></i> - นาที`;

    const retryBtn = document.getElementById('btnRetryChapter');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        const idx = state.filteredChapters.indexOf(chapterItem);
        if (idx !== -1) loadChapter(idx);
      });
    }

    updateBookmarkUI(chapterItem.id);
  }

  /* ==========================================================================
     Sidebar & Chapter List Logic
     ========================================================================== */

  function sortChapters() {
    state.chapters.sort((a, b) => {
      const diff = state.sortOrder === 'asc' ? a.number - b.number : b.number - a.number;
      return diff !== 0 ? diff : a.name.localeCompare(b.name);
    });
    filterChapters();
  }

  function filterChapters() {
    const query = elements.searchInput.value.trim().toLowerCase();
    
    state.filteredChapters = state.chapters.filter(ch => {
      const label = `ตอนที่ ${ch.number} บทที่ ${ch.number} ${ch.name}`.toLowerCase();
      const matchSearch = !query || label.includes(query);
      const matchBookmark = !state.filterBookmarked || state.bookmarks.includes(ch.id);
      return matchSearch && matchBookmark;
    });

    // Keep the index pointing at the same chapter after the list changes (-1 if filtered out)
    state.currentChapterIndex = state.currentChapterItem
      ? state.filteredChapters.indexOf(state.currentChapterItem)
      : -1;

    renderSidebarList();
    updateNavigationButtons();
  }

  function renderSidebarList() {
    elements.chapterCountBadge.textContent = `${state.filteredChapters.length} บท`;
    elements.chapterList.innerHTML = '';

    if (state.filteredChapters.length === 0) {
      elements.chapterList.innerHTML = `
        <div class="welcome-placeholder" style="padding: 20px 10px;">
          <p style="font-size: 0.85rem;">ไม่พบบทนิยายที่ตรงกับเงื่อนไข</p>
        </div>
      `;
      return;
    }

    state.filteredChapters.forEach((ch, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = `chapter-item ${idx === state.currentChapterIndex ? 'active' : ''}`;
      
      const isBookmarked = state.bookmarks.includes(ch.id);
      const isRead = state.readHistory[ch.id];

      itemEl.innerHTML = `
        <div class="chapter-item-info">
          <div class="chapter-item-title">
            ${isBookmarked ? '<i class="fa-solid fa-bookmark" style="color:var(--accent-cyan); margin-right:4px;"></i>' : ''}
            ตอนที่ ${ch.number}: ${escapeHtml(ch.name)}
          </div>
          <div class="chapter-item-sub">
            ${isRead ? '<i class="fa-solid fa-check" style="color:#22c55e;"></i> อ่านแล้ว' : 'ยังไม่ได้อ่าน'}
          </div>
        </div>
        <div class="chapter-item-badge">#${ch.number}</div>
      `;

      itemEl.addEventListener('click', () => {
        loadChapter(idx);
        // Mobile auto collapse sidebar and overlay
        if (window.innerWidth <= 868) {
          elements.sidebar.classList.remove('open');
          if (elements.sidebarOverlay) elements.sidebarOverlay.classList.add('hidden');
        }
      });

      elements.chapterList.appendChild(itemEl);
    });
  }

  function updateNavigationButtons() {
    const hasPrev = state.currentChapterIndex > 0;
    const hasNext = state.currentChapterIndex < state.filteredChapters.length - 1;

    elements.btnPrevChapter.disabled = !hasPrev;
    elements.btnNextChapter.disabled = !hasNext;
    elements.btnPrevChapterFooter.disabled = !hasPrev;
    elements.btnNextChapterFooter.disabled = !hasNext;
  }

  /* ==========================================================================
     Data Inspector & Scraper View
     ========================================================================== */

  function updateInspectorView(chapterItem, rawText, charCount) {
    elements.inspectFileName.textContent = chapterItem.name;
    elements.inspectFileSize.textContent = `${(rawText.length / 1024).toFixed(2)} KB`;
    elements.inspectCharCount.textContent = charCount.toLocaleString();
    elements.inspectRawUrl.textContent = chapterItem.rawUrl;
    elements.inspectRawUrl.title = chapterItem.rawUrl;

    try {
      const formattedJson = JSON.stringify(JSON.parse(rawText), null, 2);
      elements.rawCodeViewer.textContent = formattedJson;
    } catch (e) {
      elements.rawCodeViewer.textContent = rawText;
    }
  }

  /* ==========================================================================
     Exporters & Cache Management
     ========================================================================== */

  // "Export all" must contain every chapter's real text, not just the ones already opened —
  // fetch whatever hasn't been read yet (in small concurrent batches) before building the file
  async function ensureAllChaptersLoaded(onProgress) {
    const missing = state.chapters.filter(ch => !ch.content);
    if (missing.length === 0) return { failed: 0 };

    let done = 0;
    let failed = 0;
    const batchSize = 8;
    for (let i = 0; i < missing.length; i += batchSize) {
      const batch = missing.slice(i, i + batchSize);
      await Promise.all(batch.map(async ch => {
        try {
          const res = await fetch(ch.rawUrl);
          if (res.ok) {
            ch.content = await res.text();
            ch.loaded = true;
          } else {
            failed++;
          }
        } catch (e) {
          failed++;
        }
        done++;
        if (onProgress) onProgress(done, missing.length);
      }));
    }
    saveChaptersToCache();
    return { failed };
  }

  async function exportAllAsTxt() {
    if (state.chapters.length === 0) {
      showToast('ไม่มีข้อมูลบทนิยายสำหรับส่งออก', 'error');
      return;
    }

    setLoadingState(true, 'กำลังดึงเนื้อหาทุกบทก่อนส่งออก...');
    const { failed } = await ensureAllChaptersLoaded((done, total) => {
      setLoadingState(true, `กำลังดึงเนื้อหาทุกบทก่อนส่งออก... (${done}/${total})`);
    });
    setLoadingState(false, `ดึงข้อมูลครบ 100% (${state.chapters.length} บท)`);
    if (failed > 0) {
      showToast(`โหลดเนื้อหาไม่สำเร็จ ${failed} บท จะถูกทำเครื่องหมายไว้ในไฟล์ที่ส่งออก`, 'error');
    }

    let fullText = `===================================================\n`;
    fullText += `นิยายสกัดจาก GitHub Repository: ${state.repo}\n`;
    fullText += `Branch: ${state.branch} | Path: ${state.path}\n`;
    fullText += `วันที่ส่งออก: ${new Date().toLocaleString('th-TH')}\n`;
    fullText += `===================================================\n\n`;

    state.chapters.forEach(ch => {
      fullText += `---------------------------------------------------\n`;
      fullText += `บทที่ ${ch.number}: ${ch.name}\n`;
      fullText += `---------------------------------------------------\n\n`;
      fullText += ch.content || `[ยังไม่ได้โหลดเนื้อหาบทนี้]`;
      fullText += `\n\n\n`;
    });

    downloadBlob(fullText, `${state.repo.replace('/', '_')}_all_chapters.txt`, 'text/plain;charset=utf-8');
    showToast('ดาวน์โหลดไฟล์ TXT รวมบทสำเร็จ!', 'success');
  }

  async function exportAllAsJson() {
    if (state.chapters.length === 0) {
      showToast('ไม่มีข้อมูลบทนิยายสำหรับส่งออก', 'error');
      return;
    }

    setLoadingState(true, 'กำลังดึงเนื้อหาทุกบทก่อนส่งออก...');
    const { failed } = await ensureAllChaptersLoaded((done, total) => {
      setLoadingState(true, `กำลังดึงเนื้อหาทุกบทก่อนส่งออก... (${done}/${total})`);
    });
    setLoadingState(false, `ดึงข้อมูลครบ 100% (${state.chapters.length} บท)`);
    if (failed > 0) {
      showToast(`โหลดเนื้อหาไม่สำเร็จ ${failed} บท จะมี content เป็น null ในไฟล์ที่ส่งออก`, 'error');
    }

    const jsonExport = {
      repository: state.repo,
      branch: state.branch,
      path: state.path,
      exported_at: new Date().toISOString(),
      total_chapters: state.chapters.length,
      chapters: state.chapters
    };

    const jsonStr = JSON.stringify(jsonExport, null, 2);
    downloadBlob(jsonStr, `${state.repo.replace('/', '_')}_dataset.json`, 'application/json;charset=utf-8');
    showToast('ดาวน์โหลดไฟล์ JSON Dataset สำเร็จ!', 'success');
  }

  function downloadBlob(content, filename, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function getCacheKey() {
    return `gnr_cache_${state.repo}_${state.branch}_${state.path}`;
  }

  function readChaptersCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(getCacheKey()) || 'null');
      return Array.isArray(cached) ? cached : null;
    } catch (e) {
      return null;
    }
  }

  function saveChaptersToCache() {
    const key = getCacheKey();
    try {
      localStorage.setItem(key, JSON.stringify(state.chapters));
    } catch (e) {
      // Storage full: keep at least the chapter list so the app still opens offline
      try {
        const listOnly = state.chapters.map(ch => ({ ...ch, content: null, loaded: false }));
        localStorage.setItem(key, JSON.stringify(listOnly));
      } catch (e2) {
        console.warn('Unable to save offline cache:', e2);
      }
    }
  }

  function clearAllCache() {
    if (confirm('คุณต้องการล้างแคชออฟไลน์ทั้งหมดหรือไม่? (ข้อมูลบทที่เคยดึงจะถูกลบและดึงใหม่จาก GitHub)')) {
      Object.keys(localStorage)
        .filter(key => key.startsWith('gnr_cache_'))
        .forEach(key => localStorage.removeItem(key));
      localStorage.removeItem('gnr_history');
      state.readHistory = {};
      showToast('ล้างแคชออฟไลน์เรียบร้อยแล้ว', 'info');
      fetchGitHubChapters();
    }
  }

  /* ==========================================================================
     Bookmarks & Text-To-Speech (TTS)
     ========================================================================== */

  function updateBookmarkUI(chapterId) {
    const isBookmarked = state.bookmarks.includes(chapterId);
    if (isBookmarked) {
      elements.btnBookmark.classList.add('active');
      elements.bookmarkIcon.className = 'fa-solid fa-bookmark';
    } else {
      elements.btnBookmark.classList.remove('active');
      elements.bookmarkIcon.className = 'fa-regular fa-bookmark';
    }
  }

  function toggleBookmark() {
    if (!state.currentChapterData) return;
    const chId = state.currentChapterData.chapterItem.id;
    const idx = state.bookmarks.indexOf(chId);
    
    if (idx === -1) {
      state.bookmarks.push(chId);
      showToast('เพิ่มเข้าในรายการคั่นหน้าแล้ว', 'success');
    } else {
      state.bookmarks.splice(idx, 1);
      showToast('ลบออกจากรายการคั่นหน้าแล้ว', 'info');
    }

    localStorage.setItem('gnr_bookmarks', JSON.stringify(state.bookmarks));
    updateBookmarkUI(chId);
    filterChapters(); // Re-apply the bookmark filter if it is active
  }

  // --- TTS Core System (Paragraph-Chunked Engine) ---
  //
  // Guarantees: every chunk is spoken exactly once and in order. A chunk only advances after its
  // engine reports it finished; if an engine silently drops or stalls a chunk, the same chunk is
  // re-spoken (never skipped). Screen Wake Lock keeps iPhone from auto-locking mid-chapter.

  function unlockAudioContextForIOS() {
    if (state.synth) {
      try {
        if (state.synth.paused) state.synth.resume();
      } catch (e) {}
    }
    if (state.silentAudio && state.silentAudio.paused && state.ttsState === 'playing') {
      state.silentAudio.play().catch(() => {});
    }
    // iOS only lets an <audio> element play from async callbacks if it was started once inside a tap.
    // We reuse one element for all cloud chunks, so prime it here while nothing is playing.
    const audio = state.cloudAudio;
    if (audio && !state.cloudPrimed && audio.paused && state.ttsState !== 'playing') {
      audio.muted = true;
      audio.src = SILENT_WAV;
      audio.play().then(() => {
        if (audio.src === SILENT_WAV) audio.pause();
        state.cloudPrimed = true;
      }).catch(() => {}).finally(() => {
        audio.muted = state.ttsMuted;
      });
    }
    if (window.responsiveVoice) {
      try {
        window.responsiveVoice.init();
      } catch (e) {}
    }
  }

  // Register global touch listener to prime iOS Safari WebKit audio context
  document.addEventListener('touchstart', unlockAudioContextForIOS, { passive: true });
  document.addEventListener('click', unlockAudioContextForIOS, { passive: true });

  const TTS_CHUNK_MAX = 150; // Cloud TTS services reject long text; also keeps iOS utterances short

  // Splits text into chunks <= maxLen without losing or reordering any characters.
  // Prefers whitespace/sentence boundaries, then Thai word boundaries, never splits a grapheme.
  function splitTextIntoSubChunks(text, maxLen = TTS_CHUNK_MAX) {
    if (!text || typeof text !== 'string') return [];
    const cleanText = text.trim();
    if (!cleanText) return [];
    if (cleanText.length <= maxLen) return [cleanText];

    const segmentBy = (str, granularity) => {
      if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
        return Array.from(new Intl.Segmenter('th', { granularity }).segment(str), s => s.segment);
      }
      return granularity === 'word' ? str.split(/(?<=\s)/) : Array.from(str);
    };

    // Pieces keep their trailing whitespace, so joining them reproduces the text exactly
    const pieces = [];
    cleanText.split(/(?<=\s)/).forEach(piece => {
      if (piece.length <= maxLen) {
        pieces.push(piece);
        return;
      }
      segmentBy(piece, 'word').forEach(word => {
        if (word.length <= maxLen) {
          pieces.push(word);
        } else {
          // A single "word" longer than maxLen: cut on grapheme boundaries (never inside a character cluster)
          let part = '';
          segmentBy(word, 'grapheme').forEach(g => {
            if ((part + g).length > maxLen && part) {
              pieces.push(part);
              part = '';
            }
            part += g;
          });
          if (part) pieces.push(part);
        }
      });
    });

    const chunks = [];
    let current = '';
    pieces.forEach(piece => {
      if ((current + piece).trim().length > maxLen && current.trim()) {
        chunks.push(current.trim());
        current = '';
      }
      current += piece;
    });
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  function clearAudioWatchdog() {
    if (state.audioWatchdog) {
      clearInterval(state.audioWatchdog);
      state.audioWatchdog = null;
    }
  }

  // resetProgress=false preserves the current paragraph/sub-chunk position (used by pause, so
  // resume continues the same sub-chunk instead of restarting the whole paragraph)
  function stopAllAudioEngines(resetProgress = true) {
    state.ttsSession++;
    state.ttsStartAttempt++; // cancel any startTTSReading() still waiting on warmUpVoices()
    state.ttsState = 'paused';
    if (resetProgress) {
      state.ttsSubChunks = [];
      state.ttsSubIndex = 0;
    }

    if (state.iosKeepAliveTimer) {
      clearInterval(state.iosKeepAliveTimer);
      state.iosKeepAliveTimer = null;
    }
    clearAudioWatchdog();

    // Detach callbacks from currentUtterance to prevent async event cascades
    if (state.currentUtterance) {
      state.currentUtterance.onend = null;
      state.currentUtterance.onerror = null;
      state.currentUtterance.onstart = null;
    }

    if (window.responsiveVoice) {
      try {
        window.responsiveVoice.cancel();
      } catch (e) {}
    }

    if (state.cloudAudio) {
      try {
        state.cloudAudio.onended = null;
        state.cloudAudio.onerror = null;
        state.cloudAudio.ontimeupdate = null;
        state.cloudAudio.pause();
      } catch (e) {}
    }

    if (state.synth) {
      try {
        state.synth.cancel();
      } catch (e) {}
    }

    if (state.silentAudio) {
      try {
        state.silentAudio.pause();
      } catch (e) {}
    }
  }

  function getThaiVoices() {
    if (!state.synth) return [];
    state.voices = state.synth.getVoices();
    return state.voices.filter(v =>
      v.lang.toLowerCase().replace('_', '-').startsWith('th') ||
      v.name.toLowerCase().includes('thai')
    );
  }

  // 'auto' = the device's own Thai voice when it has one (iPhone does: offline, free, no gaps),
  // otherwise the free SoundOfText MP3 service
  function resolveVoiceMode() {
    const mode = state.selectedVoiceURI || FREE_DEFAULT_VOICE;
    if (mode !== 'auto') return mode;
    return getThaiVoices().length > 0 ? 'native_th' : 'soundoftext_th';
  }

  // Cached wrappers around resolveVoiceMode()/the chosen device voice: call these during playback
  // instead of resolving fresh each chunk. Reset only at the start of a reading session or when the
  // user explicitly changes the voice — never mid-session — so the same voice reads a whole chapter.
  function getEffectiveMode() {
    if (!state.ttsResolvedMode) state.ttsResolvedMode = resolveVoiceMode();
    return state.ttsResolvedMode;
  }

  function getEffectiveDeviceVoice() {
    if (state.ttsResolvedDeviceVoice) return state.ttsResolvedDeviceVoice;
    const thaiVoices = getThaiVoices();
    const chosen = state.voices.find(v => v.voiceURI === state.selectedVoiceURI || v.name === state.selectedVoiceURI);
    const picked = chosen || thaiVoices[0] || null;
    if (picked) state.ttsResolvedDeviceVoice = picked;
    return picked;
  }

  function resetVoiceResolution() {
    state.ttsResolvedMode = null;
    state.ttsResolvedDeviceVoice = null;
  }

  const CLOUD_ONLY_MODES = new Set(['soundoftext_th', 'cloud_th', 'rv_th_female', 'rv_th_male']);

  // iOS reports an empty voice list for a moment after the page loads, before 'voiceschanged' fires
  // once. Starting to read during that gap would lock the session onto the wrong engine/voice for
  // its first chunk (still correct after this fix, but inconsistent chunk-to-chunk). Wait briefly for
  // the real voice list so the very first chunk resolves the same way as the rest of the session —
  // skipped when the selected mode never uses a device voice anyway.
  function warmUpVoices(timeoutMs = 800) {
    const mode = state.selectedVoiceURI || FREE_DEFAULT_VOICE;
    if (CLOUD_ONLY_MODES.has(mode)) return Promise.resolve();
    if (!state.synth || getThaiVoices().length > 0) return Promise.resolve();
    return new Promise(resolve => {
      let done = false;
      const prevHandler = state.synth.onvoiceschanged;
      const finish = () => {
        if (done) return;
        done = true;
        state.synth.onvoiceschanged = prevHandler;
        resolve();
      };
      state.synth.onvoiceschanged = (e) => {
        if (prevHandler) prevHandler(e);
        finish();
      };
      setTimeout(finish, timeoutMs);
    });
  }

  function populateVoices() {
    elements.ttsVoiceSelect.innerHTML = '';
    const addOption = (value, text) => {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      elements.ttsVoiceSelect.appendChild(option);
    };

    // Free engines (no API key needed)
    addOption('auto', '✅ อัตโนมัติ (แนะนำ — iPhone ใช้เสียงไทยในเครื่อง ฟรี ไม่ใช้เน็ต)');
    addOption('native_th', '📱 เสียงของเครื่อง (ฟรี — WebSpeech)');
    addOption('soundoftext_th', '🔊 เสียงอ่าน MP3 (ฟรี — SoundOfText, ต้องใช้เน็ต)');
    addOption('cloud_th', '☁️ เสียงอ่าน Google (ฟรี, ต้องใช้เน็ต)');

    // Extra Thai voices exposed by the browser/OS (free)
    getThaiVoices().forEach((voice, index) => {
      const cleanName = voice.name.replace(/th[-_]TH/gi, '').replace(/com\.apple\..*/gi, '').trim() || `เสียงพากย์ ${index + 1}`;
      addOption(voice.voiceURI || voice.name, `🍎 เสียงเครื่อง (ฟรี): ${cleanName}`);
    });

    // ResponsiveVoice needs a registered API key, so only offer it when one is set
    if (state.rvKey) {
      addOption('rv_th_female', '🇹🇭 เสียงผู้หญิง (ResponsiveVoice)');
      addOption('rv_th_male', '🇹🇭 เสียงผู้ชาย (ResponsiveVoice)');
    }

    elements.ttsVoiceSelect.value = state.selectedVoiceURI;
    if (elements.ttsVoiceSelect.value !== state.selectedVoiceURI && state.selectedVoiceURI.startsWith('rv_th')) {
      // ResponsiveVoice chosen earlier but no key anymore: switch to the free default
      state.selectedVoiceURI = FREE_DEFAULT_VOICE;
      localStorage.setItem('gnr_ttsVoiceURI', FREE_DEFAULT_VOICE);
      elements.ttsVoiceSelect.value = FREE_DEFAULT_VOICE;
    }
  }

  // Each engine falls back to another on error; cap the chain so a dead network can't loop forever
  function allowEngineAttempt() {
    state.ttsEngineAttempts++;
    if (state.ttsEngineAttempts <= 10) return true;
    if (state.ttsState !== 'idle') {
      resetTTSState();
      showToast('ไม่สามารถเล่นเสียงอ่านได้ — ตรวจสอบอินเทอร์เน็ต หรือเปลี่ยนระบบเสียง (หยุดไว้ที่ย่อหน้าเดิม ไม่ข้าม)', 'error');
    }
    return false;
  }

  // Keep the iPhone screen on while reading: a locked screen suspends the page and cuts the voice
  async function requestWakeLock() {
    if (!('wakeLock' in navigator) || state.wakeLock || document.visibilityState !== 'visible') return;
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (state.ttsState !== 'playing') {
        lock.release().catch(() => {});
        return;
      }
      state.wakeLock = lock;
      lock.addEventListener('release', () => {
        if (state.wakeLock === lock) state.wakeLock = null;
      });
    } catch (e) {}
  }

  function releaseWakeLock() {
    if (state.wakeLock) {
      state.wakeLock.release().catch(() => {});
      state.wakeLock = null;
    }
  }

  function speakWithMode(mode, text, onEnd) {
    if (mode.startsWith('rv_th')) {
      speakViaResponsiveVoice(text, mode === 'rv_th_male' ? 'Thai Male' : 'Thai Female', onEnd);
    } else if (mode === 'soundoftext_th') {
      speakViaSoundOfText(text, onEnd);
    } else if (mode === 'cloud_th') {
      speakViaCloudAudio(text, onEnd);
    } else {
      speakViaWebSpeech(text, onEnd);
    }
  }

  function handleTTSTest() {
    unlockAudioContextForIOS();
    showToast('🔊 กำลังทดสอบระบบเสียง...', 'info');

    // Testing mid-chapter must not lose the reading position: remember the state, speak the test
    // line, then either resume the same sub-chunk (was playing), stay paused, or go idle — never
    // restart the whole chapter the way returning to 'idle' here used to force on the next press.
    const testMsg = 'ทดสอบระบบเสียงอ่านภาษาไทยบน ไอโฟน สำเร็จแล้วครับ';
    const wasPlaying = state.ttsState === 'playing';
    const wasPaused = state.ttsState === 'paused';
    stopAllAudioEngines(false);
    state.ttsState = 'playing';
    updateTTSUI();
    state.ttsEngineAttempts = 0;
    speakWithMode(getEffectiveMode(), testMsg, () => {
      if (wasPlaying) {
        restartCurrentChunk();
      } else {
        state.ttsState = wasPaused ? 'paused' : 'idle';
        updateTTSUI();
      }
    });
  }

  function handleTTSPlayPause() {
    unlockAudioContextForIOS();
    if (state.ttsState === 'idle') {
      state.ttsCurrentIndex = 0;
      state.ttsSubIndex = 0;
      state.ttsSubChunks = [];
      startTTSReading();
    } else if (state.ttsState === 'playing') {
      pauseTTSReading();
    } else if (state.ttsState === 'paused') {
      resumeTTSReading();
    }
  }

  async function startTTSReading() {
    if (!state.currentChapterData) {
      showToast('ยังไม่มีเนื้อหาให้อ่าน', 'error');
      return;
    }

    const startToken = ++state.ttsStartAttempt;
    // Reflect "playing" immediately: instant button feedback, and it lets pause/stop/switching chapters
    // during the wait below cancel this call via stopAllAudioEngines() bumping ttsStartAttempt
    state.ttsState = 'playing';
    updateTTSUI();

    await warmUpVoices();
    // Superseded by a second press, a pause/stop, or a chapter change while we were waiting
    if (state.ttsStartAttempt !== startToken) return;

    // Title first, then every heading/paragraph in document order
    state.ttsParagraphElements = [
      elements.chapterTitle,
      ...elements.chapterBody.querySelectorAll('p, .md-heading')
    ];

    if (state.ttsCurrentIndex >= state.ttsParagraphElements.length) {
      state.ttsCurrentIndex = 0;
      state.ttsSubIndex = 0;
      state.ttsSubChunks = [];
    }

    stopAllAudioEngines();
    state.ttsPrefetch = new Map();
    resetVoiceResolution(); // fresh session: pick the engine/device voice once and keep it for the whole chapter
    setupMediaSession();
    beginPlayback();
  }

  function setupMediaSession() {
    if ('mediaSession' in navigator && state.currentChapterData) {
      const title = state.currentChapterData.parsedData.title || `ตอนที่ ${state.currentChapterData.chapterItem.number}`;
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'OniSo33 Novel Reader',
        album: state.repo
      });

      // Lock-screen Play must never act as Pause
      navigator.mediaSession.setActionHandler('play', () => {
        if (state.ttsState === 'paused') resumeTTSReading();
        else if (state.ttsState === 'idle') handleTTSPlayPause();
      });
      navigator.mediaSession.setActionHandler('pause', () => pauseTTSReading());
      navigator.mediaSession.setActionHandler('stop', () => stopTTSReading());
      
      try {
        navigator.mediaSession.setActionHandler('previoustrack', () => loadChapter(state.currentChapterIndex - 1));
        navigator.mediaSession.setActionHandler('nexttrack', () => loadChapter(state.currentChapterIndex + 1));
      } catch (e) {}
    }
  }

  // Strip symbols that should never be spoken aloud: leftover markdown syntax (a Thai voice reads
  // "*" as "ดอกจันทร์"/asterisk), whether it's a rendering gap or content from a non-Markdown source
  // (plain text/JSON chapters skip Markdown rendering entirely, so raw ** or # can reach here as-is)
  function stripForSpeech(text) {
    return text
      .replace(/[*_`#]/g, '')
      .replace(/^[>•]\s*/gm, '')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();
  }

  function getParagraphChunks(index) {
    const el = state.ttsParagraphElements[index];
    if (!el) return [];
    const targetText = stripForSpeech(el.textContent);
    return splitTextIntoSubChunks(targetText);
  }

  // Text of the chunk after the current one (for prefetching cloud audio so there is no gap)
  function peekNextChunkText() {
    if (state.ttsSubIndex + 1 < state.ttsSubChunks.length) return state.ttsSubChunks[state.ttsSubIndex + 1];
    for (let i = state.ttsCurrentIndex + 1; i < state.ttsParagraphElements.length; i++) {
      const chunks = getParagraphChunks(i);
      if (chunks.length > 0) return chunks[0];
    }
    return null;
  }

  function speakCurrentParagraph() {
    if (state.ttsState !== 'playing') return;

    // Walk forward over empty paragraphs (loop instead of recursion so long chapters can't overflow)
    while (!state.ttsSubChunks || state.ttsSubChunks.length === 0 || state.ttsSubIndex >= state.ttsSubChunks.length) {
      if (state.ttsSubChunks && state.ttsSubChunks.length > 0 && state.ttsSubIndex >= state.ttsSubChunks.length) {
        state.ttsCurrentIndex++;
      }
      if (!state.ttsParagraphElements || state.ttsCurrentIndex >= state.ttsParagraphElements.length) {
        resetTTSState();
        showToast('อ่านจบบทแล้ว', 'success');
        return;
      }
      state.ttsSubChunks = getParagraphChunks(state.ttsCurrentIndex);
      state.ttsSubIndex = 0;
      if (state.ttsSubChunks.length === 0) state.ttsCurrentIndex++;
    }

    // Highlight current paragraph on screen without auto-scrolling
    state.ttsParagraphElements.forEach((p, idx) => {
      p.classList.toggle('tts-active-line', idx === state.ttsCurrentIndex);
    });

    const subChunkText = state.ttsSubChunks[state.ttsSubIndex];
    const mode = getEffectiveMode();
    const session = state.ttsSession;
    state.ttsEngineAttempts = 0;

    const onSubChunkEnd = () => {
      // Ignore late callbacks from audio that was stopped/replaced (pause, speed or voice change)
      if (session === state.ttsSession && state.ttsState === 'playing') {
        state.ttsSubIndex++;
        speakCurrentParagraph();
      }
    };

    speakWithMode(mode, subChunkText, onSubChunkEnd);

    // Prepare the next chunk's audio while this one plays, so cloud voices don't pause between chunks
    if (mode === 'soundoftext_th') {
      const nextText = peekNextChunkText();
      if (nextText) getSoundOfTextUrl(nextText);
    }
  }

  function speakViaResponsiveVoice(targetText, voiceName = 'Thai Female', onEndCallback) {
    if (!allowEngineAttempt()) return;
    const session = state.ttsSession;
    if (window.responsiveVoice && typeof window.responsiveVoice.speak === 'function') {
      try {
        let started = false;
        let finished = false;
        const fallback = () => {
          if (finished || session !== state.ttsSession) return;
          finished = true;
          try { window.responsiveVoice.cancel(); } catch (e) {}
          speakViaSoundOfText(targetText, onEndCallback);
        };
        // An invalid API key or blocked voice makes ResponsiveVoice silently do nothing — don't hang forever
        const watchdog = setTimeout(() => {
          if (!started) fallback();
        }, 5000);

        window.responsiveVoice.speak(targetText, voiceName, {
          rate: state.ttsRate,
          volume: state.ttsMuted ? 0 : 1,
          onstart: () => {
            started = true;
          },
          onend: () => {
            clearTimeout(watchdog);
            if (finished || session !== state.ttsSession) return;
            finished = true;
            if (onEndCallback) onEndCallback();
          },
          onerror: () => {
            clearTimeout(watchdog);
            fallback();
          }
        });
        return;
      } catch (e) {
        console.warn('ResponsiveVoice error, falling back to SoundOfText:', e);
      }
    }
    speakViaSoundOfText(targetText, onEndCallback);
  }

  // SoundOfText renders asynchronously: create the sound, then poll until its MP3 is ready
  function getSoundOfTextUrl(text) {
    if (!state.ttsPrefetch) state.ttsPrefetch = new Map();
    if (state.ttsPrefetch.has(text)) return state.ttsPrefetch.get(text);

    const promise = (async () => {
      try {
        const res = await fetch('https://api.soundoftext.com/sounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ engine: 'Google', data: { text, voice: 'th-TH' } })
        });
        if (!res.ok) return '';
        const data = await res.json();
        if (!data.success || !data.id) return '';

        for (let i = 0; i < 20; i++) {
          const statusRes = await fetch(`https://api.soundoftext.com/sounds/${data.id}`);
          if (statusRes.ok) {
            const status = await statusRes.json();
            if (status.status === 'Done' && status.location) return status.location;
            if (status.status === 'Error') return '';
          }
          await new Promise(r => setTimeout(r, 300));
        }
      } catch (e) {}
      return '';
    })();

    // Failed lookups are not cached so a retry can try again
    promise.then(url => {
      if (!url) state.ttsPrefetch.delete(text);
    });
    state.ttsPrefetch.set(text, promise);
    return promise;
  }

  async function speakViaSoundOfText(targetText, onEndCallback) {
    if (!allowEngineAttempt()) return;
    const session = state.ttsSession;

    let audioUrl = await getSoundOfTextUrl(targetText);

    // Paused/stopped while waiting for the server: don't start playing afterwards
    if (session !== state.ttsSession) return;

    if (!audioUrl) {
      audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(targetText)}`;
    }

    playCloudAudio(audioUrl, targetText, onEndCallback);
  }

  function speakViaCloudAudio(targetText, onEndCallback) {
    if (!allowEngineAttempt()) return;
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(targetText)}`;
    playCloudAudio(audioUrl, targetText, onEndCallback);
  }

  function playCloudAudio(audioUrl, targetText, onEndCallback) {
    const session = state.ttsSession;

    // Reuse the one element that was unlocked by a tap (iOS blocks new Audio() from async code)
    const audio = state.cloudAudio;
    audio.onended = null;
    audio.onerror = null;
    audio.ontimeupdate = null;
    clearAudioWatchdog();
    audio.pause();
    audio.src = audioUrl;
    audio.muted = state.ttsMuted; // iOS ignores .volume, but honours .muted
    audio.defaultPlaybackRate = state.ttsRate;
    audio.playbackRate = state.ttsRate;

    let done = false;
    const fallback = () => {
      if (done || session !== state.ttsSession) return;
      done = true;
      clearAudioWatchdog();
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
      // Same chunk again on the device voice: nothing is skipped
      speakViaWebSpeech(targetText, onEndCallback);
    };

    // Stall detection: if playback makes no progress for 12s (network hiccup), retry this chunk
    let lastProgress = Date.now();
    audio.ontimeupdate = () => {
      lastProgress = Date.now();
    };
    state.audioWatchdog = setInterval(() => {
      if (session !== state.ttsSession) {
        clearAudioWatchdog();
        return;
      }
      if (!done && Date.now() - lastProgress > 12000) fallback();
    }, 2000);

    audio.onended = () => {
      if (done || session !== state.ttsSession) return;
      done = true;
      clearAudioWatchdog();
      if (onEndCallback) onEndCallback();
    };
    audio.onerror = fallback;
    audio.play().catch(fallback);
  }

  function speakViaWebSpeech(targetText, onEndCallback) {
    if (!allowEngineAttempt()) return;
    if (!state.synth) {
      speakViaSoundOfText(targetText, onEndCallback);
      return;
    }
    const synth = state.synth;
    const session = state.ttsSession;

    // Only cancel when something is actually queued: cancel() immediately followed by speak()
    // makes iOS Safari drop the new utterance, which would silently skip text
    if (state.currentUtterance) {
      state.currentUtterance.onend = null;
      state.currentUtterance.onerror = null;
      state.currentUtterance.onstart = null;
    }
    try {
      if (synth.speaking || synth.pending) synth.cancel();
      if (synth.paused) synth.resume();
    } catch (e) {}

    const utterance = new SpeechSynthesisUtterance(targetText);
    utterance.lang = 'th-TH';
    utterance.rate = state.ttsRate;
    utterance.volume = state.ttsMuted ? 0 : 1;

    // Pick a Thai voice explicitly (a specific one if chosen); iOS may otherwise use a non-Thai default.
    // Cached per session (getEffectiveDeviceVoice) so the same voice reads the whole chapter.
    const deviceVoice = getEffectiveDeviceVoice();
    if (deviceVoice) utterance.voice = deviceVoice;

    let started = false;
    let finished = false;
    let watchdog = null;
    const startedAt = Date.now();
    // Generous estimate of how long this chunk can take (Thai ~6 chars/sec at 1x, slow voices included)
    const expectedMs = Math.max(5000, (targetText.length / 6) * 1000 / state.ttsRate);

    const finish = () => {
      if (finished) return;
      finished = true;
      clearTimeout(watchdog);
      if (session !== state.ttsSession) return;
      if (onEndCallback) onEndCallback();
    };

    const retrySameChunk = () => {
      if (finished || session !== state.ttsSession) return;
      finished = true;
      clearTimeout(watchdog);
      speakViaWebSpeech(targetText, onEndCallback);
    };

    // iOS sometimes never fires onend (or drops the utterance entirely), so also watch synth.speaking:
    // - still speaking -> keep waiting
    // - was speaking and has been silent for 2 checks -> the chunk is done (onend was lost)
    // - never started within the expected time -> speak the same chunk again (never skip it)
    let silentTicks = 0;
    const tick = () => {
      if (finished || session !== state.ttsSession) return;
      const elapsed = Date.now() - startedAt;
      const busy = synth.speaking || synth.pending;
      if (synth.speaking) started = true;

      if (busy && (synth.paused || elapsed < expectedMs * 4 + 20000)) {
        silentTicks = 0;
        watchdog = setTimeout(tick, 1000);
        return;
      }
      if (busy) {
        retrySameChunk(); // stuck far beyond any reasonable duration
        return;
      }
      if (started) {
        silentTicks++;
        if (silentTicks >= 2) finish();
        else watchdog = setTimeout(tick, 1000);
        return;
      }
      if (elapsed < expectedMs + 3000) {
        watchdog = setTimeout(tick, 1000);
      } else {
        retrySameChunk();
      }
    };
    watchdog = setTimeout(tick, 1000);

    utterance.onstart = () => {
      started = true;
    };
    utterance.onend = () => {
      if (!started && Date.now() - startedAt < 150) {
        // Ended instantly without ever starting: iOS dropped it — speak it again
        retrySameChunk();
        return;
      }
      finish();
    };
    utterance.onerror = (e) => {
      if (finished || session !== state.ttsSession) return;
      finished = true;
      clearTimeout(watchdog);
      console.warn('WebSpeech error, retrying the same text:', e && e.error);
      // Transient errors (audio interruptions) usually clear on a second try with the same offline voice;
      // only then fall back to the online engines
      if (state.ttsEngineAttempts < 3) {
        speakViaWebSpeech(targetText, onEndCallback);
      } else {
        speakViaResponsiveVoice(targetText, 'Thai Female', onEndCallback);
      }
    };

    // Keep a reference: iOS garbage-collects unreferenced utterances and never fires onend
    state.currentUtterance = utterance;
    try {
      synth.speak(utterance);
    } catch (err) {
      finished = true;
      clearTimeout(watchdog);
      speakViaResponsiveVoice(targetText, 'Thai Female', onEndCallback);
    }
  }

  // Starts (or restarts) audio at the current paragraph/sub-chunk, including the lock-screen keep-alive
  function beginPlayback() {
    state.ttsState = 'playing';
    unlockAudioContextForIOS();
    requestWakeLock();

    if (state.iosKeepAliveTimer) clearInterval(state.iosKeepAliveTimer);
    state.iosKeepAliveTimer = setInterval(() => {
      if (state.ttsState === 'playing' && state.synth && state.synth.paused) {
        state.synth.resume();
      }
    }, 3000);

    if (state.silentAudio) state.silentAudio.play().catch(() => {});
    updateTTSUI();
    speakCurrentParagraph();
  }

  // Re-speak the current sub-chunk with new settings (speed/voice/mute) without skipping text
  function restartCurrentChunk() {
    stopAllAudioEngines(false); // keep ttsSubChunks/ttsSubIndex so playback resumes at the same sub-chunk
    beginPlayback();
  }

  // Coming back to the page (unlock, app switch): if the voice died while hidden, pick up the same chunk
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || state.ttsState !== 'playing') return;
    requestWakeLock();
    const synthBusy = state.synth && (state.synth.speaking || state.synth.pending) && !state.synth.paused;
    const audioBusy = state.cloudAudio && !state.cloudAudio.paused && !state.cloudAudio.ended;
    if (!synthBusy && !audioBusy) {
      restartCurrentChunk();
    }
  });

  function pauseTTSReading() {
    if (state.ttsState === 'playing') {
      stopAllAudioEngines(false); // keep position so resume continues the same sub-chunk, not the whole paragraph
      releaseWakeLock();
      state.ttsState = 'paused';
      updateTTSUI();
      showToast(`หยุดอ่านชั่วคราว ที่ย่อหน้าที่ ${state.ttsCurrentIndex + 1}`, 'info');
    }
  }

  function resumeTTSReading() {
    if (state.ttsState === 'paused') {
      // Resume re-reads the interrupted chunk from its start, so no words are lost
      restartCurrentChunk();
      showToast(`อ่านต่อจากย่อหน้าที่ ${state.ttsCurrentIndex + 1}...`, 'info');
    }
  }

  function stopTTSReading() {
    stopAllAudioEngines();
    resetTTSState();
    showToast('หยุดการอ่านเสียงและกลับไปจุดเริ่มต้นแล้ว', 'info');
  }

  function toggleTTSMute() {
    state.ttsMuted = !state.ttsMuted;
    
    const cloudPlaying = state.cloudAudio && !state.cloudAudio.paused;
    if (state.cloudAudio) {
      state.cloudAudio.muted = state.ttsMuted;
    }

    // Speech engines can't change volume mid-sentence, so re-speak the current chunk at the new volume
    if (state.ttsState === 'playing' && !cloudPlaying) {
      restartCurrentChunk();
    }

    updateTTSUI();
    showToast(state.ttsMuted ? 'ปิดเสียงอ่านแล้ว 🔇' : 'เปิดเสียงอ่านแล้ว 🔊', 'info');
  }

  function changeTTSSpeed(newRate) {
    state.ttsRate = parseFloat(newRate);
    localStorage.setItem('gnr_ttsRate', state.ttsRate);

    if (state.cloudAudio) {
      state.cloudAudio.playbackRate = state.ttsRate;
    }

    if (state.ttsState === 'playing') {
      // Stop the current voice first, otherwise the old and new speeds play on top of each other
      restartCurrentChunk();
    }
    showToast(`ปรับความเร็วเสียงเป็น ${state.ttsRate}x`, 'info');
  }

  function changeTTSVoice(newVoiceVal) {
    state.selectedVoiceURI = newVoiceVal;
    localStorage.setItem('gnr_ttsVoiceURI', newVoiceVal);
    resetVoiceResolution(); // an explicit voice change should take effect immediately, not the old cached one

    if (state.ttsState === 'playing') {
      restartCurrentChunk();
    }
    showToast(`เปลี่ยนระบบเสียงเป็น: ${elements.ttsVoiceSelect.options[elements.ttsVoiceSelect.selectedIndex]?.text || newVoiceVal}`, 'success');
  }

  function resetTTSState() {
    stopAllAudioEngines();
    releaseWakeLock();
    state.ttsState = 'idle';
    state.currentUtterance = null;
    state.ttsCurrentIndex = 0;
    
    // Remove all highlights
    if (state.ttsParagraphElements) {
      state.ttsParagraphElements.forEach(p => p.classList.remove('tts-active-line'));
    }
    
    updateTTSUI();
  }

  function updateTTSUI() {
    elements.ttsSpeedContainer.classList.remove('hidden');
    elements.ttsVoiceContainer.classList.remove('hidden');

    if (state.ttsState === 'playing') {
      elements.ttsPlayIcon.className = 'fa-solid fa-pause';
      elements.ttsPlayText.textContent = 'ชั่วคราว';
    } else if (state.ttsState === 'paused') {
      elements.ttsPlayIcon.className = 'fa-solid fa-play';
      elements.ttsPlayText.textContent = 'เล่นต่อ';
    } else {
      elements.ttsPlayIcon.className = 'fa-solid fa-play';
      elements.ttsPlayText.textContent = 'อ่านให้ฟัง';
    }

    // Mute button icon and text
    if (state.ttsMuted) {
      elements.ttsMuteIcon.className = 'fa-solid fa-volume-xmark';
      elements.btnTTSMute.classList.add('active');
      if (elements.ttsMuteText) elements.ttsMuteText.textContent = 'ปิดเสียง';
    } else {
      elements.ttsMuteIcon.className = 'fa-solid fa-volume-high';
      elements.btnTTSMute.classList.remove('active');
      if (elements.ttsMuteText) elements.ttsMuteText.textContent = 'เปิดเสียง';
    }

    // Speed selector value
    elements.ttsSpeedSelect.value = state.ttsRate.toString();
  }

  /* ==========================================================================
     Event Listeners & UI Binding
     ========================================================================== */

  function setupEventListeners() {
    // Sidebar Toggle & Mobile Overlay
    const toggleSidebarDrawer = () => {
      const isOpen = elements.sidebar.classList.toggle('open');
      if (elements.sidebarOverlay) {
        elements.sidebarOverlay.classList.toggle('hidden', !isOpen);
      }
    };

    elements.btnToggleSidebar.addEventListener('click', toggleSidebarDrawer);
    if (elements.sidebarOverlay) {
      elements.sidebarOverlay.addEventListener('click', () => {
        elements.sidebar.classList.remove('open');
        elements.sidebarOverlay.classList.add('hidden');
      });
    }

    // Quick URL Fetcher
    const handleQuickFetch = async () => {
      const inputVal = elements.quickUrlInput.value.trim();
      if (!inputVal) {
        showToast('กรุณาวาง URL หรือชื่อ owner/repo ของ GitHub', 'error');
        return;
      }

      const parsed = parseGitHubUrl(inputVal);
      if (parsed && parsed.treeSegments) {
        setLoadingState(true, 'กำลังตรวจสอบ branch จากลิงก์...');
        Object.assign(parsed, await resolveTreeSegments(parsed.repo, parsed.treeSegments));
      }
      if (parsed) {
        state.repo = parsed.repo;
        state.branch = parsed.branch;
        state.path = parsed.path;

        localStorage.setItem('gnr_repo', state.repo);
        localStorage.setItem('gnr_branch', state.branch);
        localStorage.setItem('gnr_path', state.path);

        elements.repoInput.value = state.repo;
        elements.branchInput.value = state.branch;
        elements.pathInput.value = state.path;

        showToast(`สลับไปยัง ${state.repo} (${state.branch})`, 'success');
        fetchGitHubChapters();
      } else {
        showToast('รูปแบบ URL ไม่ถูกต้อง', 'error');
      }
    };

    elements.btnQuickFetch.addEventListener('click', handleQuickFetch);
    elements.quickUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleQuickFetch();
    });

    // Refresh Sync
    elements.btnSync.addEventListener('click', () => {
      elements.syncIcon.classList.add('fa-spin');
      fetchGitHubChapters().then(() => {
        setTimeout(() => elements.syncIcon.classList.remove('fa-spin'), 600);
      });
    });

    // Search Input
    elements.searchInput.addEventListener('input', () => {
      if (elements.searchInput.value.length > 0) {
        elements.btnClearSearch.classList.remove('hidden');
      } else {
        elements.btnClearSearch.classList.add('hidden');
      }
      filterChapters();
    });

    elements.btnClearSearch.addEventListener('click', () => {
      elements.searchInput.value = '';
      elements.btnClearSearch.classList.add('hidden');
      filterChapters();
    });

    // Sort buttons
    elements.btnSortAsc.addEventListener('click', () => {
      state.sortOrder = 'asc';
      elements.btnSortAsc.classList.add('active');
      elements.btnSortDesc.classList.remove('active');
      sortChapters();
    });

    elements.btnSortDesc.addEventListener('click', () => {
      state.sortOrder = 'desc';
      elements.btnSortDesc.classList.add('active');
      elements.btnSortAsc.classList.remove('active');
      sortChapters();
    });

    // Filter bookmarked
    elements.btnFilterBookmarked.addEventListener('click', () => {
      state.filterBookmarked = !state.filterBookmarked;
      elements.btnFilterBookmarked.classList.toggle('active', state.filterBookmarked);
      filterChapters();
    });

    // Navigation buttons
    const prevHandler = () => loadChapter(state.currentChapterIndex - 1);
    const nextHandler = () => loadChapter(state.currentChapterIndex + 1);

    elements.btnPrevChapter.addEventListener('click', prevHandler);
    elements.btnNextChapter.addEventListener('click', nextHandler);
    elements.btnPrevChapterFooter.addEventListener('click', prevHandler);
    elements.btnNextChapterFooter.addEventListener('click', nextHandler);

    // Reader Bookmark & TTS
    elements.btnBookmark.addEventListener('click', toggleBookmark);
    elements.btnTTSPlayPause.addEventListener('click', handleTTSPlayPause);
    if (elements.btnTTSTest) {
      elements.btnTTSTest.addEventListener('click', handleTTSTest);
    }
    elements.btnTTSStop.addEventListener('click', stopTTSReading);
    elements.btnTTSMute.addEventListener('click', toggleTTSMute);
    elements.ttsSpeedSelect.addEventListener('change', (e) => changeTTSSpeed(e.target.value));
    elements.ttsVoiceSelect.addEventListener('change', (e) => changeTTSVoice(e.target.value));
    elements.ttsVoiceSelect.addEventListener('focus', populateVoices);
    elements.ttsVoiceSelect.addEventListener('click', populateVoices);

    // Font size adjustments
    elements.btnFontInc.addEventListener('click', () => {
      if (state.fontSize < 32) {
        state.fontSize += 2;
        localStorage.setItem('gnr_fontSize', state.fontSize);
        applyTypography();
      }
    });

    elements.btnFontDec.addEventListener('click', () => {
      if (state.fontSize > 12) {
        state.fontSize -= 2;
        localStorage.setItem('gnr_fontSize', state.fontSize);
        applyTypography();
      }
    });

    // Theme selector dots
    elements.themeDots.forEach(dot => {
      dot.addEventListener('click', () => {
        const theme = dot.getAttribute('data-theme');
        applyTheme(theme);
      });
    });

    // Tab switching
    elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        
        elements.tabBtns.forEach(b => b.classList.remove('active'));
        elements.tabContents.forEach(c => c.classList.remove('active'));
        
        btn.classList.add('active');
        document.getElementById(targetTab).classList.add('active');
      });
    });

    // Scroll reading progress
    elements.contentArea.addEventListener('scroll', () => {
      const scrollTop = elements.contentArea.scrollTop;
      const scrollHeight = elements.contentArea.scrollHeight - elements.contentArea.clientHeight;
      const progress = scrollHeight > 0 ? Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100)) : 0;
      elements.progressBar.style.width = `${progress}%`;
    });

    // Inspector Copy Raw
    elements.btnCopyRaw.addEventListener('click', () => {
      const code = elements.rawCodeViewer.textContent;
      navigator.clipboard.writeText(code).then(() => {
        showToast('คัดลอก JSON ดิบเรียบร้อยแล้ว!', 'success');
      }).catch(err => {
        showToast('ไม่สามารถคัดลอกได้', 'error');
      });
    });

    // Exporter Actions
    elements.btnExportTxt.addEventListener('click', exportAllAsTxt);
    elements.btnExportJson.addEventListener('click', exportAllAsJson);
    elements.btnClearCache.addEventListener('click', clearAllCache);

    // Settings Modal
    elements.btnSettings.addEventListener('click', () => {
      elements.settingsModal.classList.remove('hidden');
    });

    elements.btnCloseSettings.addEventListener('click', () => {
      elements.settingsModal.classList.add('hidden');
    });

    elements.btnSaveSettings.addEventListener('click', () => {
      state.repo = elements.repoInput.value.trim() || DEFAULT_REPO;
      state.branch = elements.branchInput.value.trim() || DEFAULT_BRANCH;
      state.path = elements.pathInput.value.trim() || DEFAULT_PATH;
      state.token = elements.tokenInput.value.trim();
      state.rememberToken = elements.rememberTokenCheck.checked;
      const newRvKey = elements.rvKeyInput.value.trim();
      state.fontFamily = elements.fontFamilySelect.value;
      state.lineHeight = elements.lineHeightSelect.value;

      localStorage.setItem('gnr_repo', state.repo);
      localStorage.setItem('gnr_branch', state.branch);
      localStorage.setItem('gnr_path', state.path);
      saveToken();
      if (newRvKey !== state.rvKey) {
        state.rvKey = newRvKey;
        localStorage.setItem('gnr_rvKey', state.rvKey);
        if (window.responsiveVoice) {
          showToast('เปลี่ยน ResponsiveVoice Key แล้ว — รีเฟรชหน้าเว็บเพื่อใช้คีย์ใหม่', 'info');
        } else {
          loadResponsiveVoice(state.rvKey);
        }
        populateVoices();
      }
      localStorage.setItem('gnr_fontFamily', state.fontFamily);
      localStorage.setItem('gnr_lineHeight', state.lineHeight);

      applyTypography();
      elements.settingsModal.classList.add('hidden');
      showToast('บันทึกการตั้งค่าแล้ว กำลังโหลดข้อมูลใหม่...', 'success');
      fetchGitHubChapters();
    });
  }

  /* ==========================================================================
     Helper Utilities & Toasts
     ========================================================================== */

  function setLoadingState(isLoading, text) {
    elements.statusText.textContent = text;
    if (isLoading) {
      elements.liveStatusPill.style.borderColor = 'rgba(0, 242, 254, 0.4)';
    } else {
      elements.liveStatusPill.style.borderColor = 'rgba(34, 197, 94, 0.4)';
    }
  }

  function updateLastSyncTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    elements.lastSyncTime.textContent = `อัปเดตล่าสุด: ${timeStr}`;
  }

  function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<i class="fa-solid ${type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-info-circle'}"></i> ${escapeHtml(message)}`;
    
    elements.toastContainer.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  }

  function renderEmptyState(message) {
    elements.chapterList.innerHTML = `
      <div class="welcome-placeholder" style="padding: 30px 10px;">
        <i class="fa-solid fa-folder-open" style="font-size: 2rem; color: var(--text-muted);"></i>
        <p style="margin-top: 8px; font-size: 0.85rem;">${escapeHtml(message)}</p>
      </div>
    `;
  }

  function escapeHtml(str) {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Start Application
  init();
});
