// Khai báo biến toàn cục và khởi tạo socket
const socket = io();
const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
let myUsername = '';
let myScore = 0;
let mySocketId = null;
let currentTurn = null;
let handsCount = {};
let winners = [];
let sortMode = 0; // 0: mặc định, 1: theo bậc, 2: theo chất
let originalHand = [];
let playersOrder = [];
let myIndex = 0;
let betAmount = 50;
let isRoomOwner = false;
let playerUsernames = [];

// Lấy username và điểm từ server, hiển thị lên giao diện, gửi tên khi join game
fetch('/get-username')
  .then(res => res.json())
  .then(data => {
    myUsername = data.username;
    myScore = data.score ?? 0;
    showUserInfo();
    socket.emit('joinTienLen', myUsername);
  });

function showUserInfo() {
  let infoDiv = document.getElementById('user-info');
  if (!infoDiv) {
    infoDiv = document.createElement('div');
    infoDiv.id = 'user-info';
    infoDiv.style.textAlign = 'center';
    infoDiv.style.fontWeight = 'bold';
    infoDiv.style.margin = '10px';
    document.body.prepend(infoDiv);
  }
  infoDiv.textContent = `Tên: ${myUsername} | Điểm: ${typeof myScore === 'number' ? myScore : 0}`;
}

// Hàm xử lý bài
function getRankValue(card) {
  return rankOrder.indexOf(card.slice(0, -1));
}
function getSuit(card) {
  return card.slice(-1);
}
function isSingle(cards) {
  return cards.length === 1;
}
function isPair(cards) {
  return cards.length === 2 && getRankValue(cards[0]) === getRankValue(cards[1]);
}
function isTriple(cards) {
  return cards.length === 3 &&
    getRankValue(cards[0]) === getRankValue(cards[1]) &&
    getRankValue(cards[1]) === getRankValue(cards[2]);
}
function isFourOfAKind(cards) {
  return cards.length === 4 &&
    getRankValue(cards[0]) === getRankValue(cards[1]) &&
    getRankValue(cards[1]) === getRankValue(cards[2]) &&
    getRankValue(cards[2]) === getRankValue(cards[3]);
}
function isStraight(cards) {
  if (cards.length < 3) return false;
  const values = cards.map(getRankValue).sort((a, b) => a - b);
  if (values.includes(rankOrder.length - 1)) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}
function isConsecutivePairs(cards) {
  if (cards.length < 6 || cards.length % 2 !== 0) return false;
  const values = cards.map(getRankValue).sort((a, b) => a - b);
  for (let i = 0; i < cards.length; i += 2) {
    if (values[i] !== values[i + 1]) return false;
    if (i > 0 && values[i] !== values[i - 2] + 1) return false;
    if (values[i] === rankOrder.length - 1) return false;
  }
  return true;
}
function getHandType(cards) {
  if (isSingle(cards)) return { type: 'single', value: getRankValue(cards[0]) };
  if (isPair(cards)) return { type: 'pair', value: getRankValue(cards[0]) };
  if (isTriple(cards)) return { type: 'triple', value: getRankValue(cards[0]) };
  if (isFourOfAKind(cards)) return { type: 'four', value: getRankValue(cards[0]) };
  if (isStraight(cards)) return { type: 'straight', value: Math.max(...cards.map(getRankValue)) };
  if (isConsecutivePairs(cards)) return { type: 'consecutive_pairs', value: Math.max(...cards.map(getRankValue)) };
  return { type: 'invalid' };
}

// Xử lý chọn bài
function setupCardSelection() {
  document.querySelectorAll('#my-cards .card').forEach(card => {
    card.addEventListener('click', () => {
      card.classList.toggle('selected');
    });
  });
}

// Xử lý đánh bài
function playSelected() {
  const selectedCards = Array.from(document.querySelectorAll('#my-cards .card.selected')).map(card => card.textContent);
  if (selectedCards.length === 0) return;
  const handType = getHandType(selectedCards);
  if (handType.type === 'invalid') {
    alert('Bộ bài không hợp lệ!');
    return;
  }
  socket.emit('playCards', { cards: selectedCards });
}

// Xử lý bỏ lượt
function passTurn() {
  socket.emit('passTurn');
}

// Sắp xếp bài
function sortHand() {
  sortMode = (sortMode + 1) % 3; // 0 -> 1 -> 2 -> 0 ...
  let hand = Array.from(document.querySelectorAll('#my-cards .card')).map(card => card.textContent);
  if (sortMode === 1) {
    // Sắp theo bậc
    hand.sort((a, b) => getRankValue(a) - getRankValue(b));
  } else if (sortMode === 2) {
    // Sắp theo chất
    const suitOrder = ['♠', '♣', '♦', '♥'];
    hand.sort((a, b) => {
      const suitA = suitOrder.indexOf(getSuit(a));
      const suitB = suitOrder.indexOf(getSuit(b));
      if (suitA !== suitB) return suitA - suitB;
      return getRankValue(a) - getRankValue(b);
    });
  } else {
    // Quay lại mặc định
    hand = [...originalHand];
  }
  renderHand(hand);
}

// Render lại bài
function renderHand(hand) {
  // Lưu lại các lá đang được chọn
  const selected = new Set(Array.from(document.querySelectorAll('#my-cards .card.selected')).map(card => card.textContent));
  const myCardsDiv = document.getElementById('my-cards');
  myCardsDiv.innerHTML = '';
  hand.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = card;
    if (selected.has(card)) cardDiv.classList.add('selected');
    cardDiv.addEventListener('click', () => {
      cardDiv.classList.toggle('selected');
    });
    myCardsDiv.appendChild(cardDiv);
  });
}

// Lắng nghe các sự kiện từ server
socket.on('connect', () => {
  mySocketId = socket.id;
});

socket.on('roomJoined', ({ room, seat }) => {
  // Nếu là người đầu tiên vào phòng (seat === 1), cho phép chọn mức cược
  isRoomOwner = (seat === 1);
  if (isRoomOwner) {
    document.getElementById('bet-select-container').style.display = '';
  } else {
    document.getElementById('bet-select-container').style.display = 'none';
  }
});

// Khi chủ phòng xác nhận mức cược
if (document.getElementById('confirm-bet-btn')) {
  document.getElementById('confirm-bet-btn').onclick = function() {
    let inputValue = parseInt(document.getElementById('bet-amount-input').value);
    let selectValue = parseInt(document.getElementById('bet-amount-select').value);
    let chosenBet = inputValue > 0 ? inputValue : selectValue;
    socket.emit('setBetAmount', chosenBet);
    document.getElementById('bet-select-container').style.display = 'none';
  };
}

// Nhận mức cược từ server
socket.on('betAmount', (amount) => {
  betAmount = amount;
  document.getElementById('bet-info').textContent = `Mức cược: ${betAmount}`;
});

socket.on('betAmountError', (data) => {
  alert(data.message || 'Có người chơi không đủ điểm để đặt cược này!');
  document.getElementById('bet-select-container').style.display = '';
});

socket.on('dealCards', ({ hand, players, yourIndex, betAmount: serverBetAmount, usernames }) => {
  sortMode = 0;
  originalHand = [...hand];
  renderHand(hand);
  if (players) playersOrder = players;
  if (typeof yourIndex === 'number') myIndex = yourIndex;
  if (Array.isArray(usernames)) playerUsernames = usernames;
  if (serverBetAmount) {
    betAmount = serverBetAmount;
    document.getElementById('bet-info').textContent = `Mức cược: ${betAmount}`;
  }
  updatePlayerNamesUI();
});

function updatePlayerNamesUI() {
  // Vị trí: bottom (mình), right, top, left
  const positions = ['bottom', 'right', 'top', 'left'];
  for (let i = 0; i < 4; i++) {
    const pos = positions[i];
    const nameDiv = document.querySelector(`.player.${pos} .name`);
    if (!nameDiv) continue;
    if (playerUsernames.length === 4) {
      // Xoay theo vị trí của mình
      const idx = (myIndex + i) % 4;
      nameDiv.textContent = idx === myIndex ? 'Bạn' : playerUsernames[idx];
    } else {
      nameDiv.textContent = pos === 'bottom' ? 'Bạn' : `Người chơi ${i+1}`;
    }
  }
}

socket.on('playResult', ({ success, message, tableCards }) => {
  if (!success) {
    alert(message || 'Đánh bài không hợp lệ!');
    return;
  }
  const tableDiv = document.getElementById('table-cards');
  tableDiv.innerHTML = '';
  tableCards.forEach(card => {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'card';
    cardDiv.textContent = card;
    tableDiv.appendChild(cardDiv);
  });
  // Nếu là lượt của mình và mình vừa đánh, xóa các lá đã đánh khỏi tay
  if (mySocketId === currentTurn) {
    const selectedCards = Array.from(document.querySelectorAll('#my-cards .card.selected')).map(card => card.textContent);
    originalHand = originalHand.filter(card => !selectedCards.includes(card));
    renderHand(originalHand);
    setupCardSelection();
    updateHandsCountUI();
  }
});

socket.on('nextTurn', (data) => {
  currentTurn = data.currentTurn;
  handsCount = data.handsCount || {};
  winners = data.winners || [];
  if (data.players) playersOrder = data.players;
  updateTurnUI();
  updateHandsCountUI();
  if (mySocketId === currentTurn) {
    setupCardSelection();
  }
});

socket.on('playerWin', ({ winner, winners }) => {
  alert((winner === mySocketId ? 'Bạn' : 'Một người chơi') + ' đã chiến thắng!');
  updateWinnersUI(winners);
});

socket.on('gameOver', ({ winners, score }) => {
  let msg = 'Kết thúc ván!\n';
  winners.forEach((pid, idx) => {
    msg += `Thứ hạng ${idx + 1}: ${(pid === mySocketId ? 'Bạn' : 'Người chơi khác')} (Điểm: ${score[pid]})\n`;
  });
  alert(msg);
});

socket.on('updateScore', (newScore) => {
  myScore = newScore;
  showUserInfo();
  console.log('[Tiến lên] Nhận điểm mới:', newScore);
});

socket.on('updateHandsCount', (data) => {
  handsCount = data.handsCount;
  if (data.players) playersOrder = data.players;
  updateHandsCountUI();
});

socket.on('scoreChanged', (allScore) => {
  // Xóa popup cũ nếu có
  document.querySelectorAll('.points-popup-bg').forEach(e => e.remove());
  // Tạo popup
  const bg = document.createElement('div');
  bg.className = 'points-popup-bg';
  const popup = document.createElement('div');
  popup.className = 'points-popup';
  popup.innerHTML = `<button class="close-btn" title="Đóng">&times;</button><h3>Cập nhật điểm sau ván</h3><ul></ul>`;
  const ul = popup.querySelector('ul');
  for (const [username, score] of Object.entries(allScore)) {
    const li = document.createElement('li');
    li.textContent = `${username}: ${score}`;
    ul.appendChild(li);
    if (username === myUsername) {
      myScore = score;
      showUserInfo();
    }
  }
  popup.querySelector('.close-btn').onclick = () => bg.remove();
  bg.appendChild(popup);
  document.body.appendChild(bg);
});

// Thêm xử lý nút Rời phòng
if (document.getElementById('leave-room-btn')) {
  document.getElementById('leave-room-btn').onclick = function() {
    if (confirm('Bạn chắc chắn muốn rời phòng?')) {
      socket.emit('leaveRoom');
    }
  };
}

socket.on('leftRoom', () => {
  window.location.href = '/bet/dashboard';
});

// Chỉ cho phép bấm Đánh/Bỏ lượt khi đến lượt mình
function updateTurnUI() {
  const isMyTurn = (mySocketId === currentTurn);
  document.querySelectorAll('.btn').forEach(btn => {
    if (btn.textContent.includes('Đánh') || btn.textContent.includes('Bỏ lượt')) {
      btn.disabled = !isMyTurn;
    }
  });
  let turnMsg = document.getElementById('turn-msg');
  if (!turnMsg) {
    turnMsg = document.createElement('div');
    turnMsg.id = 'turn-msg';
    turnMsg.style.textAlign = 'center';
    turnMsg.style.fontWeight = 'bold';
    turnMsg.style.margin = '10px';
    document.body.prepend(turnMsg);
  }
  turnMsg.textContent = isMyTurn ? 'Đến lượt bạn!' : 'Đang chờ người khác...';
}

// Hiển thị số bài còn lại của từng người chơi
function updateHandsCountUI() {
  const positions = ['bottom', 'right', 'top', 'left'];
  if (!playersOrder.length) return;
  positions.forEach((pos, i) => {
    let el = document.getElementById(`hand-count-${pos}`);
    if (!el) {
      el = document.createElement('div');
      el.id = `hand-count-${pos}`;
      el.style.textAlign = 'center';
      el.style.fontWeight = 'bold';
      el.style.margin = '4px';
      const playerDiv = document.querySelector(`.player.${pos}`);
      if (playerDiv) playerDiv.appendChild(el);
    }
    const pid = playersOrder[(myIndex + i) % 4];
    el.textContent = pid && handsCount[pid] !== undefined ? `Còn: ${handsCount[pid]} lá` : '';
  });
}

// Hiển thị danh sách người thắng
function updateWinnersUI(winners) {
  if (winners && winners.length) {
    let msg = 'Đã về đích: ' + winners.map(pid => pid === mySocketId ? 'Bạn' : 'Người chơi khác').join(', ');
    alert(msg);
  }
}

// Gán lại sự kiện cho nút Bỏ lượt
function setupPassButton() {
  document.querySelectorAll('.btn').forEach(btn => {
    if (btn.textContent.includes('Bỏ lượt')) {
      btn.onclick = passTurn;
    }
  });
}

// Khởi tạo các sự kiện khi DOM đã sẵn sàng
window.onload = function() {
  setupCardSelection();
  setupPassButton();
  document.querySelectorAll('.btn').forEach(btn => {
    if (btn.textContent.includes('Sắp bài')) {
      btn.onclick = sortHand;
    }
  });
};