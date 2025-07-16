let currentUser = '';
let nickname = '';
let onlineUsers = [];

// 🌐 Lấy username hiện tại từ session
fetch('/get-username')
  .then(res => res.json())
  .then(data => {
    currentUser = data.username || 'Ẩn danh';
    nickname = data.nickname || currentUser;
    document.getElementById('nickname-display').innerText = nickname;
    socket.emit('user_connected', nickname);
  });

// 📩 Gửi tin nhắn
document.getElementById('send-btn').addEventListener('click', sendMessage);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') sendMessage();
});

function sendMessage() {
  const input = document.getElementById('chat-input');
  const msg = input.value.trim();
  if (!msg) return;

  socket.emit('chat_message', { message: msg, username: currentUser, nickname });
  input.value = '';
}

// 💬 Nhận tin nhắn
socket.on('chat_message', (data) => {
  addMessage(data);
});

function addMessage(data) {
  const box = document.getElementById('chat-box');
  const div = document.createElement('div');
  div.classList.add('message');
  div.classList.add(data.username === currentUser ? 'me' : 'other');
  div.innerHTML = `<strong>${data.nickname || data.username}</strong><br>${data.message}`;
  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

// 🔄 Load lại tin nhắn cũ khi vào
fetch('/api/chat')
  .then(res => res.json())
  .then(data => data.forEach(addMessage));

// 👥 Nhận danh sách user online
socket.on('update_online_users', (users) => {
  onlineUsers = users;
  const list = document.getElementById('user-list');
  list.innerHTML = '';
  users.forEach(u => {
    const item = document.createElement('div');
    item.classList.add('user');
    item.innerText = u.nickname || u.username;
    list.appendChild(item);
  });
  document.getElementById('online-count').innerText = users.length;
});

// ✏️ Đổi biệt danh
document.getElementById('nickname-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const newNick = document.getElementById('nickname-input').value.trim();
  if (!newNick) return;

  const res = await fetch('/api/chat/nickname', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: newNick })
  });
  const data = await res.json();
  if (data.success) {
    nickname = newNick;
    document.getElementById('nickname-display').innerText = nickname;
    socket.emit('nickname_updated', { username: currentUser, nickname });
  }
});
