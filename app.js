// ==================== 1. 状态配置中心 ====================
const defaultSettings = {
  defaultFolderId: 'root',
  hiddenFolders: []
};

let currentSettings = { ...defaultSettings };
let currentPath = [];
let tempSelectedHomeId = '';
let tempHiddenFolderIds = [];

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await initDefaultPath();
  initSettingsModal();
});

async function loadSettings() {
  const res = await chrome.storage.local.get(['settings']);
  if (res.settings) {
    currentSettings = {
      defaultFolderId: res.settings.defaultFolderId || 'root',
      hiddenFolders: res.settings.hiddenFolders || []
    };
  }
}

async function initDefaultPath() {
  const tree = await chrome.bookmarks.getTree();
  const rootNode = tree[0];

  if (currentSettings.defaultFolderId === 'root' || currentSettings.defaultFolderId === rootNode.id) {
    currentPath = [{ id: rootNode.id, title: "根目录" }];
    renderCurrentFolder();
    return;
  }

  try {
    const pathNodes = [];
    let currentId = currentSettings.defaultFolderId;
    while (currentId) {
      const nodeArray = await chrome.bookmarks.get(currentId);
      if (nodeArray && nodeArray[0]) {
        const node = nodeArray[0];
        const showTitle = node.id === rootNode.id ? "根目录" : (node.title || "未命名");
        pathNodes.unshift({ id: node.id, title: showTitle });
        currentId = node.parentId;
      } else { break; }
    }
    currentPath = pathNodes;
  } catch (e) {
    currentPath = [{ id: rootNode.id, title: "根目录" }];
  }
  renderCurrentFolder();
}

// ==================== 2. 高清图标获取与防模糊兜底（三重保障版） ====================
function getChromeFavicon(pageUrl) {
  // 第一重：浏览器本地内核缓存（速度最快）
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '64'); 
  return url.toString();
}

function getGoogleFaviconService(pageUrl) {
  // 第二重：谷歌官方全球高清 Favicon 镜像（专门解决 Google、Outlook 等大厂网站不显示的问题）
  try {
    const domain = new URL(pageUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
  } catch(e) {
    return '';
  }
}

function getHighResFallback(pageUrl) {
  // 第三重：国内备用高清无损图标接口（用于加速和兜底小众网站）
  try {
    const domain = new URL(pageUrl).hostname;
    return `https://api.iowen.cn/favicon/${domain}.png`;
  } catch(e) {
    return '';
  }
}

const FOLDER_SVG = `
  <svg class="folder-icon" viewBox="0 0 24 24">
    <path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/>
  </svg>
`;

// ==================== 3. 主界面渲染 ====================
async function renderCurrentFolder() {
  const container = document.getElementById('bookmarks-container');
  container.innerHTML = '';
  renderBreadcrumb();

  const currentFolderId = currentPath[currentPath.length - 1].id;
  let nodes = [];
  try {
    const result = await chrome.bookmarks.getSubTree(currentFolderId);
    nodes = result[0].children || [];
  } catch (e) {
    const tree = await chrome.bookmarks.getTree();
    nodes = tree[0].children;
  }

  nodes.forEach(node => {
    if (currentSettings.hiddenFolders.includes(node.id)) return;

    const card = document.createElement('a');
    card.className = 'item-card';

    if (node.url) {
      card.href = node.url;
      card.target = '_blank';

      const img = document.createElement('img');
      img.className = 'bookmark-icon';
      img.src = getChromeFavicon(node.url);
      
      // 级联兜底：1次报错进谷歌服务，2次报错进国内接口，3次报错进地球占位
      img.onerror = () => {
        if (!img.dataset.retryStage) {
          img.dataset.retryStage = "1";
          img.src = getGoogleFaviconService(node.url);
        } else if (img.dataset.retryStage === "1") {
          img.dataset.retryStage = "2";
          img.src = getHighResFallback(node.url);
        } else {
          img.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ccc"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>';
        }
      };

      const title = document.createElement('span');
      title.className = 'item-title';
      title.innerText = node.title || new URL(node.url).hostname;

      card.appendChild(img);
      card.appendChild(title);
    } else {
      card.innerHTML = FOLDER_SVG;
      const title = document.createElement('span');
      title.className = 'item-title';
      title.innerText = node.title || '未命名文件夹';
      card.appendChild(title);

      card.addEventListener('click', (e) => {
        e.preventDefault();
        currentPath.push({ id: node.id, title: node.title });
        renderCurrentFolder();
      });
    }
    container.appendChild(card);
  });

  if (container.children.length === 0) {
    container.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: #888; padding: 40px;">该文件夹下没有可显示的内容</div>';
  }
}

function renderBreadcrumb() {
  const nav = document.getElementById('breadcrumb');
  nav.innerHTML = '';

  currentPath.forEach((pathNode, index) => {
    const span = document.createElement('span');
    span.className = 'breadcrumb-item';
    span.innerText = pathNode.title || '未命名';
    
    if (index < currentPath.length - 1) {
      span.addEventListener('click', () => {
        currentPath = currentPath.slice(0, index + 1);
        renderCurrentFolder();
      });
      nav.appendChild(span);

      const separator = document.createElement('span');
      separator.className = 'breadcrumb-separator';
      separator.innerText = '>';
      nav.appendChild(separator);
    } else {
      nav.appendChild(span);
    }
  });
}

// ==================== 4. 分离设置面板与独立树状图控制 ====================
async function initSettingsModal() {
  const btn = document.getElementById('settings-btn');
  const modal = document.getElementById('settings-modal');
  const saveBtn = document.getElementById('save-settings');
  
  const homeHeader = document.getElementById('toggle-home-tree');
  const homeContainer = document.getElementById('home-tree-container');
  const rangeHeader = document.getElementById('toggle-range-tree');
  const rangeContainer = document.getElementById('range-tree-container');

  // 1. 绑定抽屉折叠展开点击事件
  homeHeader.addEventListener('click', () => handleDrawer(homeHeader, homeContainer));
  rangeHeader.addEventListener('click', () => handleDrawer(rangeHeader, rangeContainer));

  function handleDrawer(header, container) {
    const group = header.parentElement;
    const isExpanded = group.classList.toggle('expanded');
    container.classList.toggle('hidden', !isExpanded);
  }

  btn.addEventListener('click', async () => {
    modal.classList.remove('hidden');
    homeContainer.innerHTML = '';
    rangeContainer.innerHTML = '';
    
    // 重置抽屉状态
    document.querySelectorAll('.setting-group').forEach(g => g.classList.remove('expanded'));
    homeContainer.classList.add('hidden');
    rangeContainer.classList.add('hidden');

    tempSelectedHomeId = currentSettings.defaultFolderId;
    tempHiddenFolderIds = [...currentSettings.hiddenFolders];

    const tree = await chrome.bookmarks.getTree();
    const virtualRoot = { id: 'root', title: '根目录 (/)', children: tree[0].children };

    // 分别渲染相互独立的交互树状图
    homeContainer.appendChild(renderHomeTree(virtualRoot, 0));
    rangeContainer.appendChild(renderRangeTree(virtualRoot, 0));
  });

  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  saveBtn.addEventListener('click', async () => {
    currentSettings.defaultFolderId = tempSelectedHomeId;
    currentSettings.hiddenFolders = tempHiddenFolderIds;
    await chrome.storage.local.set({ settings: currentSettings });
    modal.classList.add('hidden');
    await initDefaultPath();
  });
}

// 独立函数 A：构建“设置默认首页”的树状图（纯单选，无复选框）
function renderHomeTree(node, depth) {
  const container = document.createElement('div');
  container.className = 'tree-node-wrapper';
  container.style.paddingLeft = `${depth * 16}px`;

  const row = document.createElement('div');
  row.className = 'tree-node';
  if (node.id === tempSelectedHomeId) row.classList.add('is-home-active');

  const nameLabel = document.createElement('span');
  nameLabel.className = 'tree-folder-name';
  nameLabel.innerText = node.id === 'root' ? node.title : `📁 ${node.title || '未命名'}`;
  
  nameLabel.addEventListener('click', () => {
    const lastActive = document.querySelector('.is-home-active');
    if (lastActive) lastActive.classList.remove('is-home-active');
    row.classList.add('is-home-active');
    tempSelectedHomeId = node.id;
  });

  row.appendChild(nameLabel);
  container.appendChild(row);

  if (node.children) {
    node.children.forEach(child => {
      if (!child.url && child.children) container.appendChild(renderHomeTree(child, depth + 1));
    });
  }
  return container;
}

// 独立函数 B：构建“设置显示范围”的树状图（纯复选框控制，默认全选）
function renderRangeTree(node, depth) {
  const container = document.createElement('div');
  container.className = 'tree-node-wrapper';
  container.style.paddingLeft = `${depth * 16}px`;

  const row = document.createElement('div');
  row.className = 'tree-node';

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.className = 'tree-node-checkbox';
  checkbox.checked = !tempHiddenFolderIds.includes(node.id);
  if (node.id === 'root') checkbox.style.visibility = 'hidden';

  checkbox.addEventListener('change', () => {
    if (!checkbox.checked) {
      if (!tempHiddenFolderIds.includes(node.id)) tempHiddenFolderIds.push(node.id);
    } else {
      tempHiddenFolderIds = tempHiddenFolderIds.filter(id => id !== node.id);
    }
  });

  const nameLabel = document.createElement('span');
  nameLabel.className = 'tree-folder-name';
  nameLabel.innerText = node.id === 'root' ? node.title : `📁 ${node.title || '未命名'}`;

  row.appendChild(checkbox);
  row.appendChild(nameLabel);
  container.appendChild(row);

  if (node.children) {
    node.children.forEach(child => {
      if (!child.url && child.children) container.appendChild(renderRangeTree(child, depth + 1));
    });
  }
  return container;
}