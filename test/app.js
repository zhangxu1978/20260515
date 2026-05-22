const WEBDAV_URL = 'https://dav.jianguoyun.com/dav/我的坚果云/todolist.json';
const WEBDAV_USER = '1069133124@qq.com';
const WEBDAV_PASS = 'addrzszid4uxtn8k';

let todos = [];
let currentTab = 'pending';

// DOM
const todoInput = document.getElementById('todo-input');
const addBtn = document.getElementById('add-btn');
const todoList = document.getElementById('todo-list');
const emptyState = document.getElementById('empty-state');
const syncBtn = document.getElementById('sync-btn');
const syncStatus = document.getElementById('sync-status');
const pendingCount = document.getElementById('pending-count');
const doneCount = document.getElementById('done-count');
const tabs = document.querySelectorAll('.tab');

// 初始化
async function init() {
  // 先从本地加载
  const local = localStorage.getItem('todos');
  if (local) {
    try { todos = JSON.parse(local); } catch {}
  }
  render();
  // 从坚果云同步
  await pullFromCloud();
  bindEvents();
}

function bindEvents() {
  addBtn.addEventListener('click', addTodo);
  todoInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTodo();
  });
  syncBtn.addEventListener('click', manualSync);
  tabs.forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });
}

// 添加待办
function addTodo() {
  const text = todoInput.value.trim();
  if (!text) return;
  todos.unshift({
    id: Date.now(),
    text,
    done: false,
    createdAt: new Date().toISOString()
  });
  todoInput.value = '';
  saveLocal();
  render();
  pushToCloud();
}

// 切换完成状态
function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (todo) {
    todo.done = !todo.done;
    saveLocal();
    render();
    pushToCloud();
  }
}

// 删除
function deleteTodo(id) {
  const item = document.querySelector(`[data-id="${id}"]`);
  if (item) {
    item.classList.add('removing');
    setTimeout(() => {
      todos = todos.filter(t => t.id !== id);
      saveLocal();
      render();
      pushToCloud();
    }, 200);
  } else {
    todos = todos.filter(t => t.id !== id);
    saveLocal();
    render();
    pushToCloud();
  }
}

// 切换 tab
function switchTab(tab) {
  currentTab = tab;
  tabs.forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  render();
}

// 渲染列表
function render() {
  const pending = todos.filter(t => !t.done);
  const done = todos.filter(t => t.done);
  pendingCount.textContent = pending.length;
  doneCount.textContent = done.length;

  const items = currentTab === 'pending' ? pending : done;
  if (items.length === 0) {
    todoList.innerHTML = '';
    emptyState.style.display = 'block';
    emptyState.textContent = currentTab === 'pending' ? '暂无待办事项' : '暂无已完成事项';
    return;
  }
  emptyState.style.display = 'none';

  todoList.innerHTML = items.map(todo => {
    const date = new Date(todo.createdAt);
    const dateStr = `${date.getMonth()+1}/${date.getDate()}`;
    return `
      <li class="todo-item ${todo.done ? 'done' : ''}" data-id="${todo.id}">
        <div class="todo-checkbox ${todo.done ? 'checked' : ''}" onclick="toggleTodo(${todo.id})"></div>
        <span class="todo-text">${escapeHtml(todo.text)}</span>
        <span class="todo-date">${dateStr}</span>
        <button class="todo-delete" onclick="deleteTodo(${todo.id})">×</button>
      </li>
    `;
  }).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 本地存储
function saveLocal() {
  localStorage.setItem('todos', JSON.stringify(todos));
}

// WebDAV: 从坚果云拉取
async function pullFromCloud() {
  setSyncStatus('同步中...');
  syncBtn.classList.add('spinning');
  try {
    const resp = await fetch(WEBDAV_URL, {
      method: 'GET',
      headers: {
        'Authorization': 'Basic ' + btoa(WEBDAV_USER + ':' + WEBDAV_PASS)
      }
    });
    if (resp.ok) {
      const text = await resp.text();
      try {
        const data = JSON.parse(text);
        if (data.todos && Array.isArray(data.todos)) {
          todos = data.todos;
          saveLocal();
          render();
        }
      } catch {}
      setSyncStatus('已同步');
    } else if (resp.status === 404) {
      // 文件不存在，首次使用，推送到云端
      await pushToCloud();
    } else {
      setSyncStatus('同步失败: ' + resp.status);
    }
  } catch (e) {
    setSyncStatus('网络错误');
  }
  syncBtn.classList.remove('spinning');
}

// WebDAV: 推送到坚果云
async function pushToCloud() {
  try {
    const body = JSON.stringify({ todos }, null, 2);
    const resp = await fetch(WEBDAV_URL, {
      method: 'PUT',
      headers: {
        'Authorization': 'Basic ' + btoa(WEBDAV_USER + ':' + WEBDAV_PASS),
        'Content-Type': 'application/json'
      },
      body
    });
    if (resp.ok) {
      setSyncStatus('已同步');
    } else {
      setSyncStatus('保存失败: ' + resp.status);
    }
  } catch (e) {
    setSyncStatus('网络错误，已本地保存');
  }
}

// 手动同步
async function manualSync() {
  await pullFromCloud();
}

function setSyncStatus(text) {
  syncStatus.textContent = text;
}

// 注册 Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

init();
