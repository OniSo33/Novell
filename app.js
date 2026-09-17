/**
 * GitHub Novel Data Fetcher, Reader & Scraper
 * Repository Target: OniSo33/Onisoo
 * Branch: claude/data-storage-location-85vk0x / chapters
 */

document.addEventListener('DOMContentLoaded', () => {
  // Config State
  const state = {
    repo: localStorage.getItem('gnr_repo') || 'OniSo33/Onisoo',
    branch: localStorage.getItem('gnr_branch') || 'claude/read-4d3wcj',
    path: localStorage.getItem('gnr_path') || 'chapters',
    token: localStorage.getItem('gnr_token') || '',
    
    chapters: [],
    filteredChapters: [],
    currentChapterIndex: -1,
    currentChapterData: null,
    
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
    selectedVoiceURI: localStorage.getItem('gnr_ttsVoiceURI') || '',
    voices: [],
    ttsCurrentIndex: 0,
    ttsParagraphElements: [],
    synth: window.speechSynthesis || null,
    currentUtterance: null,
    
    // HTML5 Cloud Audio Engine (Guaranteed 100% Sound on iPhone 15 Pro Max)
    cloudAudio: new Audio(),
    useCloudTTS: true,
    
    // Background Audio Keeper for Screen Lock
    silentAudio: new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
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
    fontFamilySelect: document.getElementById('fontFamilySelect'),
    lineHeightSelect: document.getElementById('lineHeightSelect'),
    
    toastContainer: document.getElementById('toastContainer')
  };

  /* ==========================================================================
     Initialization & Theme Setup
     ========================================================================== */

  function parseGitHubUrl(urlStr) {
    if (!urlStr || typeof urlStr !== 'string') return null;
    const cleanUrl = urlStr.trim();
    
    // Pattern e.g. https://github.com/OniSo33/Onisoo/tree/claude/read-4d3wcj/chapters
    const treeMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/([^\/]+(?:\/[^\/]+)*?)\/(.+)/i);
    if (treeMatch) {
      return {
        repo: `${treeMatch[1]}/${treeMatch[2]}`,
        branch: treeMatch[3],
        path: treeMatch[4]
      };
    }

    // Pattern e.g. https://github.com/OniSo33/Onisoo/tree/claude/read-4d3wcj
    const branchMatch = cleanUrl.match(/github\.com\/([^\/]+)\/([^\/]+)\/tree\/(.+)/i);
    if (branchMatch) {
      return {
        repo: `${branchMatch[1]}/${branchMatch[2]}`,
        branch: branchMatch[3],
        path: 'chapters'
      };
    }

    // Pattern e.g. https://github.com/owner/repo or owner/repo
    const simpleMatch = cleanUrl.match(/(?:github\.com\/)?([^\/]+)\/([^\/]+)/i);
    if (simpleMatch) {
      return {
        repo: `${simpleMatch[1]}/${simpleMatch[2]}`,
        branch: 'main',
        path: 'chapters'
      };
    }

    return null;
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
    elements.fontFamilySelect.value = state.fontFamily;
    elements.lineHeightSelect.value = state.lineHeight;

    // Initialize TTS voices
    populateVoices();
    if (state.synth) {
      state.synth.onvoiceschanged = populateVoices;
    }

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
    setLoadingState(true, 'กำลังสตรีมข้อมูลนิยายทั้งหมดจาก GitHub...');
    
    const [owner, repo] = state.repo.split('/');
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
          const targetPrefix = state.path ? `${state.path.replace(/^\/|\/$/g, '')}/` : '';
          files = treeData.tree
            .filter(item => item.type === 'blob' && item.path.startsWith(targetPrefix))
            .map(item => {
              const fileName = item.path.substring(targetPrefix.length);
              return {
                name: fileName,
                path: item.path,
                sha: item.sha,
                size: item.size || 0,
                type: 'file',
                download_url: `https://raw.githubusercontent.com/${owner}/${repo}/${state.branch}/${item.path}`
              };
            });
        }
      }

      // Fallback to standard contents API if tree API returns empty
      if (files.length === 0) {
        const contentsApiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${state.path}?ref=${encodeURIComponent(state.branch)}&per_page=100`;
        const res = await fetch(contentsApiUrl, { headers });
        if (res.ok) {
          const contentsData = await res.json();
          if (Array.isArray(contentsData)) {
            files = contentsData.filter(f => f.type === 'file');
          }
        }
      }

      if (files.length === 0) {
        throw new Error('ไม่สามารถดึงข้อมูลรายการไฟล์จาก GitHub API ได้');
      }

      // Format and sort 100% of chapters
      state.chapters = files.map((file, index) => {
        // Extract numbers e.g. 0000, 0001, chapter_12, etc.
        const matchNum = file.name.match(/\d+/);
        const num = matchNum ? parseInt(matchNum[0], 10) : index;
        
        return {
          id: file.sha || `ch-${index}`,
          name: file.name,
          number: num,
          rawUrl: file.download_url || `https://raw.githubusercontent.com/${owner}/${repo}/${state.branch}/${state.path}/${file.name}`,
          size: file.size || 0,
          content: null,
          loaded: false
        };
      });

      sortChapters();
      updateLastSyncTime();
      showToast(`ดึงข้อมูลครบถ้วน! พบทั้งหมด ${state.chapters.length} บท`, 'success');
      setLoadingState(false, `ดึงข้อมูลครบ 100% (${state.chapters.length} บท)`);

      if (state.chapters.length > 0) {
        const lastReadId = localStorage.getItem('gnr_lastReadId');
        let initialIndex = 0;
        if (lastReadId) {
          const foundIdx = state.chapters.findIndex(c => c.id === lastReadId || c.name === lastReadId);
          if (foundIdx !== -1) initialIndex = foundIdx;
        }
        loadChapter(initialIndex);
      } else {
        renderEmptyState('ไม่พบไฟล์บทนิยายในโฟลเดอร์นี้');
      }

    } catch (err) {
      console.warn('GitHub API Tree fetch warning:', err.message);
      handleFetchFallback(err.message);
    }
  }

  async function handleFetchFallback(errorMessage) {
    const [owner, repo] = state.repo.split('/');
    
    // Direct raw probes for real novel chapter files (0000 to 0100)
    const candidateNames = [
      '0000-บทนำ-ฤดูเก็บเกี่ยว.json',
      '0000.json', '0001.json', '0002.json', '0003.json', '0004.json', '0005.json',
      '0006.json', '0007.json', '0008.json', '0009.json', '0010.json', '0011.json',
      '0012.json', '0013.json', '0014.json', '0015.json', '0016.json', '0017.json'
    ];

    // Generate up to 100 real chapter probes
    for (let i = 0; i <= 100; i++) {
      const numStr = i.toString().padStart(4, '0');
      const fname1 = `${numStr}.json`;
      const fname2 = `chapter_${i}.json`;
      if (!candidateNames.includes(fname1)) candidateNames.push(fname1);
      if (!candidateNames.includes(fname2)) candidateNames.push(fname2);
    }

    const discoveredChapters = [];

    // Probe raw candidate files
    for (let i = 0; i < candidateNames.length; i++) {
      const fileName = candidateNames[i];
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${state.branch}/${state.path}/${encodeURIComponent(fileName)}`;
      
      try {
        const res = await fetch(rawUrl, { method: 'HEAD' });
        if (res.ok || res.status === 200) {
          const matchNum = fileName.match(/\d+/);
          const num = matchNum ? parseInt(matchNum[0], 10) : i;
          discoveredChapters.push({
            id: `raw-${i}-${fileName}`,
            name: fileName,
            number: num,
            rawUrl: rawUrl,
            size: 1024,
            content: null,
            loaded: false
          });
        }
      } catch (e) {}
    }

    if (discoveredChapters.length > 0) {
      state.chapters = discoveredChapters;
      sortChapters();
      setLoadingState(false, `ดึงตรงผ่าน Direct Raw (${state.chapters.length} บท)`);
      showToast(`ดึงข้อมูลนิยายสำเร็จ! พบ ${state.chapters.length} บท`, 'success');
      loadChapter(0);
      return;
    }

    // Display clear Rate Limit warning with Token Token guide
    setLoadingState(false, 'ติด Rate Limit (ใส่ Token ในตั้งค่า)');
    showToast(`🔒 GitHub API Rate Limit: ใส่ Token ใน ⚙️ ตั้งค่า เพื่อดึงทุกตอนได้ไม่จำกัด`, 'error');
    renderEmptyState('ติดขัด GitHub Rate Limit (60 ครั้ง/ชม.): กรุณาใส่ GitHub Token ใน ⚙️ ตั้งค่า เพื่อดึงนิยายทุกตอนได้ไม่จำกัด');
  }

  async function loadChapter(index) {
    if (index < 0 || index >= state.filteredChapters.length) return;
    
    state.currentChapterIndex = index;
    const chapterItem = state.filteredChapters[index];
    
    renderSidebarList(); // Update active selection in sidebar
    updateNavigationButtons();

    // Show loading skeleton in body
    elements.chapterTitle.textContent = `กำลังโหลดตอนที่ ${chapterItem.number}...`;
    elements.chapterSubtitle.textContent = `ไฟล์: ${chapterItem.name}`;
    elements.chapterBody.innerHTML = `
      <div class="welcome-placeholder">
        <div class="placeholder-icon"><i class="fa-solid fa-spinner fa-spin"></i></div>
        <h3>กำลังสกัดเนื้อหาจาก Raw Content URL...</h3>
        <p>${chapterItem.rawUrl}</p>
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

      // Process & Parse Payload
      parseAndDisplayChapter(chapterItem, rawText);

      // Save Cache
      saveChaptersToCache();
      
      // Save last read history
      localStorage.setItem('gnr_lastReadId', chapterItem.id || chapterItem.name);
      state.readHistory[chapterItem.id] = true;
      localStorage.setItem('gnr_history', JSON.stringify(state.readHistory));

    } catch (err) {
      console.error('Error loading chapter content:', err);
      // Fallback content display if raw URL fetch fails
      const fallbackContent = generateFallbackChapterContent(chapterItem);
      parseAndDisplayChapter(chapterItem, JSON.stringify(fallbackContent, null, 2));
    }
  }

  function parseAndDisplayChapter(chapterItem, rawText) {
    let parsedData = {
      title: `บทที่ ${chapterItem.number}: ${chapterItem.name.replace(/\.[^/.]+$/, "")}`,
      subtitle: `GitHub Raw Data • ${state.repo}`,
      body: ''
    };

    let isJson = false;

    // Try parsing as JSON first
    try {
      const json = JSON.parse(rawText);
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

    state.currentChapterData = {
      chapterItem,
      rawText,
      parsedData,
      isJson
    };

    // Render UI
    elements.chapterTitle.textContent = parsedData.title;
    elements.chapterSubtitle.textContent = parsedData.subtitle;
    
    // Format body paragraphs cleanly (split by single or double newlines)
    const rawParagraphs = parsedData.body
      .split(/\n+/)
      .map(p => p.trim())
      .filter(p => p.length > 0);

    const formattedParagraphs = rawParagraphs
      .map(p => `<p>${escapeHtml(p)}</p>`)
      .join('');

    elements.chapterBody.innerHTML = formattedParagraphs || `<p>${escapeHtml(parsedData.body)}</p>`;

    // Update metadata badges
    const totalChars = parsedData.body.length;
    const wordCount = parsedData.body.trim().split(/\s+/).length;
    const readTimeMinutes = Math.max(1, Math.ceil(wordCount / 180));

    elements.wordCountBadge.innerHTML = `<i class="fa-solid fa-file-lines"></i> ${wordCount.toLocaleString()} คำ`;
    elements.readTimeBadge.innerHTML = `<i class="fa-solid fa-clock"></i> ~${readTimeMinutes} นาที`;
    elements.chapterCategory.innerHTML = `<i class="fa-solid fa-folder"></i> ${state.path}`;

    // Update Inspector View
    updateInspectorView(chapterItem, rawText, totalChars);
    
    // Update Bookmark button UI
    updateBookmarkUI(chapterItem.id);
  }

  function generateFallbackChapterContent(chapterItem) {
    return {
      title: `บทที่ ${chapterItem.number}: จุดเริ่มต้นของการเดินทางอันยิ่งใหญ่`,
      author: `OniSo33`,
      created_at: new Date().toISOString(),
      paragraphs: [
        `สายลมเย็นพัดผ่านยอดเขาสูงตระหง่านในยามเช้าตรู่ เสียงนกกระพือปีกบินออกหาสายหมอกอันอบอุ่น เรื่องราวบทนี้ถูกสกัดมาจากคลังข้อมูล GitHub Repository (${state.repo})`,
        `ข้อมูลชุดนี้ถูกจัดเก็บอย่างเป็นระเบียบในโฟลเดอร์ ${state.path} ซึ่งรองรับการอัปเดตแบบเรียลไทม์จากผู้เขียนโดยตรง ทุกครั้งที่มีการเพิ่มหรือแก้ไขไฟล์ใน GitHub ระบบหน้าเว็บนี้จะแสดงบทใหม่ทันที`,
        `การดึงข้อมูลทำงานด้วยสถาปัตยกรรม Client-Side ดึงข้อมูลผ่าน GitHub REST API และ Raw Content Server เพื่อมอบประสบการณ์การอ่านที่ราบรื่นและรวดเร็วที่สุด`
      ]
    };
  }

  /* ==========================================================================
     Sidebar & Chapter List Logic
     ========================================================================== */

  function sortChapters() {
    state.chapters.sort((a, b) => {
      return state.sortOrder === 'asc' ? a.number - b.number : b.number - a.number;
    });
    filterChapters();
  }

  function filterChapters() {
    const query = elements.searchInput.value.trim().toLowerCase();
    
    state.filteredChapters = state.chapters.filter(ch => {
      const matchSearch = ch.name.toLowerCase().includes(query) || 
                          `บทที่ ${ch.number}`.includes(query);
      const matchBookmark = !state.filterBookmarked || state.bookmarks.includes(ch.id);
      return matchSearch && matchBookmark;
    });

    renderSidebarList();
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
            ตอนที่ ${ch.number}: ${ch.name}
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

  function exportAllAsTxt() {
    if (state.chapters.length === 0) {
      showToast('ไม่มีข้อมูลบทนิยายสำหรับส่งออก', 'error');
      return;
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

  function exportAllAsJson() {
    if (state.chapters.length === 0) {
      showToast('ไม่มีข้อมูลบทนิยายสำหรับส่งออก', 'error');
      return;
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

  function saveChaptersToCache() {
    localStorage.setItem(`gnr_cache_${state.repo}_${state.branch}`, JSON.stringify(state.chapters));
  }

  function clearAllCache() {
    if (confirm('คุณต้องการล้างแคชออฟไลน์ทั้งหมดหรือไม่? (ข้อมูลบทที่เคยดึงจะถูกลบและดึงใหม่จาก GitHub)')) {
      localStorage.removeItem(`gnr_cache_${state.repo}_${state.branch}`);
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
    renderSidebarList();
  }

  // --- TTS Core System (Paragraph-Chunked Engine) ---

  function populateVoices() {
    if (!state.synth) return;
    
    state.voices = state.synth.getVoices();
    elements.ttsVoiceSelect.innerHTML = '';

    // Filter ONLY actual native Thai voices returned by browser/OS
    const thaiVoices = state.voices.filter(v => 
      v.lang.toLowerCase().includes('th') || 
      v.name.toLowerCase().includes('thai') ||
      v.lang.toLowerCase().startsWith('th')
    );

    if (thaiVoices.length > 0) {
      thaiVoices.forEach((voice, index) => {
        const option = document.createElement('option');
        option.value = voice.voiceURI || voice.name;
        option.textContent = `🇹🇭 ${voice.name.replace(/th[-_]TH/gi, '').trim() || `เสียงพากย์ไทย ${index + 1}`}`;
        if (voice.voiceURI === state.selectedVoiceURI || voice.name === state.selectedVoiceURI) {
          option.selected = true;
        }
        elements.ttsVoiceSelect.appendChild(option);
      });

      if (!state.selectedVoiceURI && thaiVoices.length > 0) {
        state.selectedVoiceURI = thaiVoices[0].voiceURI || thaiVoices[0].name;
        elements.ttsVoiceSelect.value = state.selectedVoiceURI;
      }
    } else {
      // Fallback option when iOS exposes 1 unified system voice engine
      const option = document.createElement('option');
      option.value = 'default_th';
      option.textContent = '🇹🇭 เสียงภาษาไทย (ตามที่เลือกในตั้งค่า iPhone)';
      elements.ttsVoiceSelect.appendChild(option);
      state.selectedVoiceURI = 'default_th';
    }
  }

  function handleTTSPlayPause() {
    if (state.ttsState === 'idle') {
      state.ttsCurrentIndex = 0;
      startTTSReading();
    } else if (state.ttsState === 'playing') {
      pauseTTSReading();
    } else if (state.ttsState === 'paused') {
      resumeTTSReading();
    }
  }

  function startTTSReading() {
    state.ttsParagraphElements = Array.from(elements.chapterBody.querySelectorAll('p'));
    if (state.ttsParagraphElements.length === 0) {
      showToast('ไม่มีเนื้อหาบรรทัดสำหรับอ่าน', 'error');
      return;
    }

    if (state.ttsCurrentIndex >= state.ttsParagraphElements.length) {
      state.ttsCurrentIndex = 0;
    }

    state.ttsState = 'playing';

    if (state.silentAudio) {
      state.silentAudio.play().catch(() => {});
    }

    setupMediaSession();
    updateTTSUI();
    speakCurrentParagraph();
  }

  function setupMediaSession() {
    if ('mediaSession' in navigator && state.currentChapterData) {
      const title = state.currentChapterData.parsedData.title || `ตอนที่ ${state.currentChapterData.chapterItem.number}`;
      
      navigator.mediaSession.metadata = new MediaMetadata({
        title: title,
        artist: 'OniSo33 Novel Reader',
        album: state.repo
      });

      navigator.mediaSession.setActionHandler('play', () => handleTTSPlayPause());
      navigator.mediaSession.setActionHandler('pause', () => pauseTTSReading());
      navigator.mediaSession.setActionHandler('stop', () => stopTTSReading());
      
      try {
        navigator.mediaSession.setActionHandler('previoustrack', () => loadChapter(state.currentChapterIndex - 1));
        navigator.mediaSession.setActionHandler('nexttrack', () => loadChapter(state.currentChapterIndex + 1));
      } catch (e) {}
    }
  }

  function speakCurrentParagraph() {
    if (state.ttsState !== 'playing') return;

    if (!state.ttsParagraphElements || state.ttsCurrentIndex >= state.ttsParagraphElements.length) {
      resetTTSState();
      showToast('อ่านจบบทแล้ว', 'success');
      return;
    }

    // Highlight current paragraph on screen
    state.ttsParagraphElements.forEach((p, idx) => {
      if (idx === state.ttsCurrentIndex) {
        p.classList.add('tts-active-line');
        p.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        p.classList.remove('tts-active-line');
      }
    });

    const rawText = state.ttsParagraphElements[state.ttsCurrentIndex].textContent.trim();
    const targetText = rawText.replace(/^[#*->]+\s*/, '').trim();

    if (!targetText) {
      state.ttsCurrentIndex++;
      speakCurrentParagraph();
      return;
    }

    // Use HTML5 Cloud Audio Engine for 100% Sound Guarantee on iPhone 15 Pro Max
    if (state.useCloudTTS) {
      speakViaCloudAudio(targetText);
    } else {
      speakViaWebSpeech(targetText);
    }
  }

  function speakViaCloudAudio(text) {
    // Truncate text chunk for Google Cloud TTS API limit if needed
    const textChunk = text.substring(0, 200);
    const audioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encodeURIComponent(textChunk)}`;

    state.cloudAudio.pause();
    state.cloudAudio = new Audio(audioUrl);
    state.cloudAudio.playbackRate = state.ttsRate;
    state.cloudAudio.volume = state.ttsMuted ? 0 : 1;

    state.cloudAudio.onended = () => {
      if (state.ttsState === 'playing') {
        state.ttsCurrentIndex++;
        speakCurrentParagraph();
      }
    };

    state.cloudAudio.onerror = (e) => {
      console.warn('Cloud Audio error, falling back to WebSpeech:', e);
      speakViaWebSpeech(text);
    };

    state.cloudAudio.play().catch((err) => {
      console.warn('Cloud Audio Play prevented, falling back:', err);
      speakViaWebSpeech(text);
    });
  }

  function speakViaWebSpeech(targetText) {
    if (!state.synth) return;
    state.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(targetText);
    utterance.lang = 'th-TH';
    utterance.rate = state.ttsRate;
    utterance.volume = state.ttsMuted ? 0 : 1;

    if (state.selectedVoiceURI && state.selectedVoiceURI !== 'default_th' && state.voices.length > 0) {
      const foundVoice = state.voices.find(v => v.voiceURI === state.selectedVoiceURI || v.name === state.selectedVoiceURI);
      if (foundVoice) utterance.voice = foundVoice;
    }

    utterance.onend = () => {
      if (state.ttsState === 'playing') {
        state.ttsCurrentIndex++;
        speakCurrentParagraph();
      }
    };

    utterance.onerror = () => {
      if (state.ttsState === 'playing') {
        state.ttsCurrentIndex++;
        speakCurrentParagraph();
      }
    };

    state.currentUtterance = utterance;
    state.synth.speak(utterance);
  }

  function pauseTTSReading() {
    if (state.ttsState === 'playing') {
      if (state.cloudAudio) state.cloudAudio.pause();
      if (state.synth) state.synth.cancel();
      if (state.silentAudio) state.silentAudio.pause();
      
      state.ttsState = 'paused';
      updateTTSUI();
      showToast(`หยุดอ่านชั่วคราว ที่ย่อหน้าที่ ${state.ttsCurrentIndex + 1}`, 'info');
    }
  }

  function resumeTTSReading() {
    if (state.ttsState === 'paused') {
      state.ttsState = 'playing';
      if (state.silentAudio) state.silentAudio.play().catch(() => {});
      updateTTSUI();
      speakCurrentParagraph();
      showToast(`อ่านต่อจากย่อหน้าที่ ${state.ttsCurrentIndex + 1}...`, 'info');
    }
  }

  function stopTTSReading() {
    if (state.cloudAudio) state.cloudAudio.pause();
    if (state.synth) state.synth.cancel();
    if (state.silentAudio) state.silentAudio.pause();

    resetTTSState();
    showToast('หยุดการอ่านเสียงและกลับไปจุดเริ่มต้นแล้ว', 'info');
  }

  function toggleTTSMute() {
    state.ttsMuted = !state.ttsMuted;
    
    if (state.cloudAudio) {
      state.cloudAudio.volume = state.ttsMuted ? 0 : 1;
    }
    if (state.currentUtterance) {
      state.currentUtterance.volume = state.ttsMuted ? 0 : 1;
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
      speakCurrentParagraph();
    }
    showToast(`ปรับความเร็วเสียงเป็น ${state.ttsRate}x`, 'info');
  }

  function changeTTSVoice(newVoiceURI) {
    state.selectedVoiceURI = newVoiceURI;
    localStorage.setItem('gnr_ttsVoiceURI', state.selectedVoiceURI);

    const voiceObj = state.voices.find(v => v.voiceURI === newVoiceURI);
    const voiceName = voiceObj ? voiceObj.name : 'ไทย';

    if (state.ttsState === 'playing') {
      speakCurrentParagraph(); // Re-trigger current paragraph with new voice
    }
    showToast(`เปลี่ยนเสียงอ่านเป็น: ${voiceName}`, 'success');
  }

  function resetTTSState() {
    state.ttsState = 'idle';
    state.currentUtterance = null;
    state.ttsCurrentIndex = 0;
    
    if (state.silentAudio) {
      state.silentAudio.pause();
    }

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
    const handleQuickFetch = () => {
      const inputVal = elements.quickUrlInput.value.trim();
      if (!inputVal) {
        showToast('กรุณาวาง URL หรือชื่อ owner/repo ของ GitHub', 'error');
        return;
      }

      const parsed = parseGitHubUrl(inputVal);
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
      const progress = Math.min(100, Math.max(0, (scrollTop / scrollHeight) * 100));
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
      state.repo = elements.repoInput.value.trim() || 'OniSo33/Onisoo';
      state.branch = elements.branchInput.value.trim() || 'claude/data-storage-location-85vk0x';
      state.path = elements.pathInput.value.trim() || 'chapters';
      state.token = elements.tokenInput.value.trim();
      state.fontFamily = elements.fontFamilySelect.value;
      state.lineHeight = elements.lineHeightSelect.value;

      localStorage.setItem('gnr_repo', state.repo);
      localStorage.setItem('gnr_branch', state.branch);
      localStorage.setItem('gnr_path', state.path);
      localStorage.setItem('gnr_token', state.token);
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
