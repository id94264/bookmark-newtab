// 设置配置
let settings = {
  showFolders: [],
  defaultView: 'bookmarkBar'
};

// 加载设置
function loadSettings() {
  const saved = localStorage.getItem('bookmarkSettings');
  if (saved) {
    settings = JSON.parse(saved);
  }
}

// 保存设置
function saveSettings() {
  localStorage.setItem('bookmarkSettings', JSON.stringify(settings));
}

// 更新时间显示
function updateTime() {
  const now = new Date();
  const timeDisplay = document.getElementById('timeDisplay');
  
  const timeStr = now.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false 
  });
  
  const dateStr = now.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long'
  });
  
  timeDisplay.innerHTML = `
    <div class="time-large">${timeStr}</div>
    <div class="date-small">${dateStr}</div>
  `;
}

// 统计书签数量
function countBookmarks(node) {
  let count = 0;
  if (node.url) return 1;
  if (node.children) {
    for (const child of node.children) {
      count += countBookmarks(child);
    }
  }
  return count;
}

// 收集所有文件夹
function collectFolders(node, folders = []) {
  if (!node.url && node.title) {
    folders.push({
      id: node.id,
      title: node.title,
      count: countBookmarks(node)
    });
  }
  if (node.children) {
    for (const child of node.children) {
      collectFolders(child, folders);
    }
  }
  return folders;
}

// ==================== 最终修复版：直接控制显示/隐藏 ====================
function renderBookmarks(bookmarkNodes, container, level = 0) {
  for (const bookmark of bookmarkNodes) {
    // 默认只显示书签栏（根级别）
    if (settings.defaultView === 'bookmarkBar' && level === 0 && 
        bookmark.title !== '书签栏' && bookmark.title !== 'Bookmarks bar') {
      continue;
    }
    
    // ====== 1. 渲染文件夹 ======
    if (!bookmark.url && bookmark.children) {
      const folderDiv = document.createElement('div');
      folderDiv.className = 'bookmark-folder';
      
      const header = document.createElement('div');
      header.className = 'folder-header';
      header.innerHTML = `
        <span class="folder-icon">📂</span>
        <span class="folder-title">${bookmark.title || '未命名文件夹'}</span>
        <span class="folder-count">(${countBookmarks(bookmark)})</span>
        <span class="folder-arrow">▼</span>
      `;
      
      const content = document.createElement('div');
      content.className = 'folder-content';
      
      // 递归渲染子内容
      renderBookmarks(bookmark.children, content, level + 1);
      
      folderDiv.appendChild(header);
      folderDiv.appendChild(content);
      container.appendChild(folderDiv);
      
      // ====== 关键修复：直接控制显示/隐藏 ======
      const isRootBookmarkBar = (level === 0 && 
        (bookmark.title === '书签栏' || bookmark.title === 'Bookmarks bar'));
      
      // 默认状态：根书签栏展开，其他折叠
      let isExpanded = isRootBookmarkBar;
      
      // 直接设置display！不依赖CSS类
      content.style.display = isExpanded ? 'block' : 'none';
      
      const arrow = folderDiv.querySelector('.folder-arrow');
      arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      
      // ====== 点击事件：直接切换display ======
      header.onclick = function() {
        isExpanded = !isExpanded;
        content.style.display = isExpanded ? 'block' : 'none';
        arrow.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)';
      };
    }
    
    // ====== 2. 渲染书签链接 ======
    else if (bookmark.url) {
      const link = document.createElement('a');
      link.className = 'bookmark-link';
      link.href = bookmark.url;
      link.target = '_blank';
      
      try {
        const url = new URL(bookmark.url);
        const favicon = document.createElement('img');
        favicon.className = 'favicon';
        favicon.src = `https://www.google.com/s2/favicons?domain=${url.hostname}&sz=64`;
        favicon.onerror = function() {
          this.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23999"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>';
        };
        link.appendChild(favicon);
      } catch (e) {}
      
      const title = document.createElement('span');
      title.className = 'bookmark-title';
      title.textContent = bookmark.title || bookmark.url;
      link.appendChild(title);
      
      container.appendChild(link);
    }
  }
}

// 搜索书签
function searchBookmarks(query) {
  const bookmarksTree = document.getElementById('bookmarksTree');
  const allLinks = bookmarksTree.querySelectorAll('.bookmark-link');
  const allFolders = bookmarksTree.querySelectorAll('.bookmark-folder');
  
  if (!query.trim()) {
    allLinks.forEach(link => link.style.display = '');
    allFolders.forEach(folder => folder.style.display = '');
    return;
  }
  
  query = query.toLowerCase();
  
  allLinks.forEach(link => {
    const title = link.querySelector('.bookmark-title').textContent.toLowerCase();
    const url = link.href.toLowerCase();
    if (title.includes(query) || url.includes(query)) {
      link.style.display = '';
      let parent = link.parentElement;
      while (parent) {
        if (parent.classList && parent.classList.contains('bookmark-folder')) {
          parent.style.display = '';
          const content = parent.querySelector('.folder-content');
          const arrow = parent.querySelector('.folder-arrow');
          if (content) content.style.display = 'block';
          if (arrow) arrow.style.transform = 'rotate(0deg)';
        }
        parent = parent.parentElement;
      }
    } else {
      link.style.display = 'none';
    }
  });
  
  allFolders.forEach(folder => {
    const content = folder.querySelector('.folder-content');
    if (!content) return;
    const visibleLinks = content.querySelectorAll('.bookmark-link:not([style*="display: none"])');
    const visibleFolders = content.querySelectorAll(':scope > .bookmark-folder:not([style*="display: none"])');
    folder.style.display = (visibleLinks.length === 0 && visibleFolders.length === 0) ? 'none' : '';
  });
}

// 渲染设置面板文件夹列表
function renderFolderList() {
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    const folders = collectFolders(bookmarkTreeNodes[0]);
    const folderList = document.getElementById('folderList');
    folderList.innerHTML = '';
    
    folders.forEach(folder => {
      const label = document.createElement('label');
      label.className = 'folder-option';
      label.innerHTML = `
        <input type="checkbox" value="${folder.id}" ${settings.showFolders.includes(folder.id) ? 'checked' : ''}>
        <span>${folder.title}</span>
        <small>(${folder.count})</small>
      `;
      folderList.appendChild(label);
    });
  });
}

// 打开/关闭设置
function openSettings() {
  document.getElementById('settingsModal').classList.add('show');
  document.querySelector(`input[name="displayMode"][value="${settings.defaultView}"]`).checked = true;
  renderFolderList();
}

function closeSettings() {
  document.getElementById('settingsModal').classList.remove('show');
}

// 应用设置
function applySettings() {
  const displayMode = document.querySelector('input[name="displayMode"]:checked').value;
  const checkedFolders = Array.from(document.querySelectorAll('.folder-option input:checked')).map(cb => cb.value);
  
  settings.defaultView = displayMode;
  settings.showFolders = checkedFolders;
  saveSettings();
  closeSettings();
  
  document.getElementById('bookmarksTree').innerHTML = '';
  loadAndRenderBookmarks();
}

// 加载并渲染
function loadAndRenderBookmarks() {
  chrome.bookmarks.getTree((bookmarkTreeNodes) => {
    const bookmarksTree = document.getElementById('bookmarksTree');
    renderBookmarks(bookmarkTreeNodes[0].children, bookmarksTree);
  });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  updateTime();
  setInterval(updateTime, 1000);
  loadAndRenderBookmarks();
  
  // 搜索
  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchBookmarks(e.target.value);
  });
  
  // 点击时间区域打开设置
  document.getElementById('timeDisplay').addEventListener('click', openSettings);
  document.getElementById('closeSettings').addEventListener('click', closeSettings);
  document.getElementById('applySettings').addEventListener('click', applySettings);
  
  // 点击外部关闭
  document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') closeSettings();
  });
  
  // ESC关闭
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSettings();
  });
});