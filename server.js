require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const app = express();
const http = require('http');
const { Server } = require('socket.io');

// 🧠 MODELS
const User = require('./models/User');

// 🛣️ ROUTES
const authRoutes = require('./routes/auth');
const betRoutes = require('./routes/bet');
const adminRoutes = require('./routes/admin');
const chatRoutes = require('./routes/chat');

// ✅ MIDDLEWARE
app.use(express.urlencoded({ extended: true }));    // hỗ trợ form
app.use(express.json());                            // hỗ trợ JSON (fetch API)
app.use(express.static(path.join(__dirname, 'public'))); // file tĩnh
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// 🔐 SESSION
app.use(session({
    secret: 'secret-key', 
    resave: false,
    saveUninitialized: true
}));

console.log("MONGO_URL:", process.env.MONGO_URL);

// 🌐 DATABASE
mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('✅ Đã kết nối MongoDB'))
    .catch(err => console.error('❌ MongoDB connection error:', err));

// 🔁 ROUTING
app.get('/', (req, res) => {
    res.redirect('/bet/dashboard');
});

app.use('/', authRoutes);
app.use('/bet', betRoutes);
app.use('/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/bet', express.static('public')); 

//  API: Trả lại username từ session (dùng cho chat)
app.get('/get-username', async (req, res) => {
  if (!req.session?.user?.username) return res.json({ username: 'Ẩn danh', score: 0 });
  const user = await User.findOne({ username: req.session.user.username });
  res.json({ username: user.username, score: user.score ?? 0 });
});

// Quản lý các phòng chờ
const waitingPlayers = [];
let roomCounter = 1;

function createDeck() {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
  const deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push(rank + suit);
    }
  }
  return deck;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Lưu trạng thái bàn chơi cho từng phòng
const gameRooms = {}; // { roomName: { tableCards: [] } }

const server = http.createServer(app);
const io = new Server(server);

// Hàm kiểm tra loại bài Tiến lên
const rankOrder = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A', '2'];
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
  // Không cho phép có '2' trong sảnh
  if (values.includes(rankOrder.length - 1)) return false;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i - 1] + 1) return false;
  }
  return true;
}
function isConsecutivePairs(cards) {
  if (cards.length < 6 || cards.length % 2 !== 0) return false;
  // Không cho phép có '2' trong đôi thông
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

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);
  // Ở đây sẽ xử lý logic phòng, chia bài, v.v.

  socket.on('joinTienLen', (username) => {
    console.log('joinTienLen:', username, socket.id);
    // Lưu username vào socket để đồng bộ điểm sau này
    socket.data = socket.data || {};
    socket.data.username = username;
    // Lưu thông tin người chơi vào hàng đợi
    waitingPlayers.push({ socket, username });
    console.log('waitingPlayers:', waitingPlayers.map(p => p.username + ':' + p.socket.id));

    // Nếu đủ 4 người, tạo phòng mới
    if (waitingPlayers.length >= 4) {
      const roomName = `tienlen_room_${roomCounter++}`;
      const players = waitingPlayers.splice(0, 4);
      console.log('Tạo phòng:', roomName, 'players:', players.map(p => p.username + ':' + p.socket.id));

      // Thêm từng người vào phòng
      players.forEach((player, idx) => {
        player.socket.join(roomName);
        // Gửi thông báo cho client: đã vào phòng, kèm vị trí (idx)
        player.socket.emit('roomJoined', { room: roomName, seat: idx + 1 });
      });

      // Thông báo cho cả phòng: game ready
      io.to(roomName).emit('gameReady', { room: roomName });

      // Chia bài ngẫu nhiên
      let deck = createDeck();
      deck = shuffle(deck);
      const hands = [[], [], [], []];
      for (let i = 0; i < 52; i++) {
        hands[i % 4].push(deck[i]);
      }
      // Khởi tạo trạng thái phòng chơi trước
      gameRooms[roomName] = {
        tableCards: [],
        players: players.map(p => p.socket.id), // Lưu danh sách socketId của 4 người chơi
        currentTurn: players[0].socket.id, // Người đầu tiên đi trước (có thể random nếu muốn)
        passed: [], // Danh sách socketId đã bỏ lượt trong vòng hiện tại
        hands: {}, // { socketId: [bài của người chơi] }
        winners: [], // Danh sách người đã thắng
        lastPlayed: players[0].socket.id, // Người vừa đánh cuối cùng
        betAmount: 50 // Giá trị mặc định, sẽ được cập nhật nếu chủ phòng chọn
      };
      // Lưu bài cho từng người chơi
      players.forEach((player, idx) => {
        gameRooms[roomName].hands[player.socket.id] = hands[idx];
      });
      // Gửi bài cho từng người chơi trong phòng
      const usernames = players.map(p => p.username);
      players.forEach((player, idx) => {
        player.socket.emit('dealCards', { hand: hands[idx], players: players.map(p => p.socket.id), yourIndex: idx, betAmount: gameRooms[roomName].betAmount, usernames });
      });

      // Gửi thông báo lượt đầu tiên cho cả phòng
      io.to(roomName).emit('nextTurn', {
        currentTurn: gameRooms[roomName].currentTurn,
        handsCount: getHandsCount(gameRooms[roomName]),
        winners: gameRooms[roomName].winners,
        players: gameRooms[roomName].players
      });
    }
  });

  // Xử lý sự kiện đánh bài
  socket.on('playCards', ({ cards }) => {
    // Xác định phòng của người chơi
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('tienlen_room_'));
    if (rooms.length === 0) return;
    const room = rooms[0];
    const game = gameRooms[room];
    if (!game) return;

    // Chỉ cho phép người có lượt được đánh
    if (socket.id !== game.currentTurn) {
      socket.emit('playResult', { success: false, message: 'Chưa đến lượt bạn!' });
      return;
    }

    // Kiểm tra hợp lệ bộ bài theo luật Tiến lên
    const handType = getHandType(cards);
    if (handType.type === 'invalid') {
      socket.emit('playResult', { success: false, message: 'Bộ bài không hợp lệ!' });
      return;
    }

    // So sánh với bài trên bàn (bao gồm luật đặc biệt)
    const tableCards = game.tableCards;
    if (tableCards.length > 0) {
      const tableType = getHandType(tableCards);
      // === LUẬT ĐẶC BIỆT ===
      if (tableType.type === 'single' && getRankValue(tableCards[0]) === rankOrder.length - 1) { // Bàn là 2
        if (handType.type === 'four') {
          game.tableCards = cards;
          game.passed = [];
          game.lastPlayed = socket.id;
          removeCards(game.hands[socket.id], cards);
          io.to(room).emit('playResult', { success: true, tableCards: cards });
          io.to(room).emit('updateHandsCount', { handsCount: getHandsCount(game), players: game.players });
          checkWinAndNextTurn(room, socket.id);
          return;
        }
        if (handType.type === 'consecutive_pairs' && cards.length >= 6) {
          game.tableCards = cards;
          game.passed = [];
          game.lastPlayed = socket.id;
          removeCards(game.hands[socket.id], cards);
          io.to(room).emit('playResult', { success: true, tableCards: cards });
          io.to(room).emit('updateHandsCount', { handsCount: getHandsCount(game), players: game.players });
          checkWinAndNextTurn(room, socket.id);
          return;
        }
      }
      if (tableType.type === 'consecutive_pairs' && tableCards.length >= 6) {
        if (handType.type === 'four') {
          game.tableCards = cards;
          game.passed = [];
          game.lastPlayed = socket.id;
          removeCards(game.hands[socket.id], cards);
          io.to(room).emit('playResult', { success: true, tableCards: cards });
          io.to(room).emit('updateHandsCount', { handsCount: getHandsCount(game), players: game.players });
          checkWinAndNextTurn(room, socket.id);
          return;
        }
      }
      if (tableType.type === 'four' && handType.type === 'four') {
        if (handType.value > tableType.value) {
          game.tableCards = cards;
          game.passed = [];
          game.lastPlayed = socket.id;
          removeCards(game.hands[socket.id], cards);
          io.to(room).emit('playResult', { success: true, tableCards: cards });
          io.to(room).emit('updateHandsCount', { handsCount: getHandsCount(game), players: game.players });
          checkWinAndNextTurn(room, socket.id);
          return;
        } else {
          socket.emit('playResult', { success: false, message: 'Tứ quý của bạn nhỏ hơn!' });
          return;
        }
      }
      // === KẾT THÚC LUẬT ĐẶC BIỆT ===
      if (handType.type !== tableType.type || cards.length !== tableCards.length) {
        socket.emit('playResult', { success: false, message: 'Bạn phải đánh cùng loại và cùng số lá với bài trên bàn!' });
        return;
      }
      if (handType.value <= tableType.value) {
        socket.emit('playResult', { success: false, message: 'Bài bạn đánh chưa đủ lớn để chặt bài trên bàn!' });
        return;
      }
    }
    // Nếu bàn trống hoặc hợp lệ
    game.tableCards = cards;
    game.passed = [];
    game.lastPlayed = socket.id;
    removeCards(game.hands[socket.id], cards);
    io.to(room).emit('playResult', { success: true, tableCards: cards });
    io.to(room).emit('updateHandsCount', { handsCount: getHandsCount(game), players: game.players });
    checkWinAndNextTurn(room, socket.id);
  });

  // Xử lý sự kiện bỏ lượt
  socket.on('passTurn', () => {
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('tienlen_room_'));
    if (rooms.length === 0) return;
    const room = rooms[0];
    const game = gameRooms[room];
    if (!game) return;
    if (socket.id !== game.currentTurn) {
      socket.emit('playResult', { success: false, message: 'Chưa đến lượt bạn!' });
      return;
    }
    if (!game.passed.includes(socket.id)) game.passed.push(socket.id);
    // Nếu 3 người liên tiếp bỏ lượt (chỉ còn 1 người chưa pass), bàn trống, người vừa đánh cuối cùng được đi đầu
    if (game.passed.length >= game.players.length - 1) {
      game.tableCards = [];
      game.passed = [];
      game.currentTurn = game.lastPlayed;
      io.to(room).emit('playResult', { success: true, tableCards: [] });
      io.to(room).emit('nextTurn', {
        currentTurn: game.currentTurn,
        handsCount: getHandsCount(game),
        winners: game.winners
      });
      return;
    }
    // Chuyển lượt cho người tiếp theo chưa pass
    nextTurn(room, true);
  });

  socket.on('setBetAmount', async (amount) => {
    // Tìm phòng của socket
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('tienlen_room_'));
    if (rooms.length === 0) return;
    const room = rooms[0];
    if (!gameRooms[room]) return;
    // Chỉ chủ phòng mới được set
    if (gameRooms[room].players[0] === socket.id) {
      const bet = parseInt(amount) || 50;
      // Kiểm tra điểm của tất cả người chơi
      let allOk = true;
      let notEnoughPlayers = [];
      for (const pid of gameRooms[room].players) {
        const playerSocket = io.sockets.sockets.get(pid);
        let username = null;
        if (playerSocket && playerSocket.data && playerSocket.data.username) {
          username = playerSocket.data.username;
        }
        if (!username) continue;
        const user = await User.findOne({ username });
        if (!user || user.score < bet) {
          allOk = false;
          notEnoughPlayers.push(username || pid);
        }
      }
      if (!allOk) {
        socket.emit('betAmountError', { message: `Có người chơi không đủ điểm (${notEnoughPlayers.join(', ')}) để đặt cược ${bet}` });
        return;
      }
      gameRooms[room].betAmount = bet;
      io.to(room).emit('betAmount', gameRooms[room].betAmount);
    }
  });

  // Xử lý sự kiện rời phòng
  socket.on('leaveRoom', () => {
    // Tìm phòng của socket
    const rooms = Array.from(socket.rooms).filter(r => r.startsWith('tienlen_room_'));
    if (rooms.length === 0) {
      socket.emit('leftRoom');
      return;
    }
    const room = rooms[0];
    // Rời phòng socket.io
    socket.leave(room);
    // Log người chơi rời phòng
    const username = socket.data && socket.data.username ? socket.data.username : 'Ẩn danh';
    console.log(`[Tiến lên] ${username} (${socket.id}) đã rời phòng ${room}`);
    // Xóa khỏi danh sách players trong gameRooms
    if (gameRooms[room]) {
      gameRooms[room].players = gameRooms[room].players.filter(pid => pid !== socket.id);
      // Nếu là người cuối cùng thì xóa luôn phòng
      if (gameRooms[room].players.length === 0) {
        delete gameRooms[room];
      }
    }
    socket.emit('leftRoom');
  });
});

// Hàm chuyển lượt cho phòng
function nextTurn(room, skipPassed = false) {
  const game = gameRooms[room];
  if (!game) return;
  const players = game.players.filter(pid => !game.winners.includes(pid));
  let idx = players.indexOf(game.currentTurn);
  let nextIdx = (idx + 1) % players.length;
  // Nếu skipPassed, tìm người chưa pass
  if (skipPassed) {
    let tries = 0;
    while (game.passed.includes(players[nextIdx]) && tries < players.length) {
      nextIdx = (nextIdx + 1) % players.length;
      tries++;
    }
  }
  game.currentTurn = players[nextIdx];
  io.to(room).emit('nextTurn', {
    currentTurn: game.currentTurn,
    handsCount: getHandsCount(game),
    winners: game.winners
  });
}

// Hàm loại bỏ các lá bài đã đánh khỏi tay người chơi
function removeCards(hand, cards) {
  for (const card of cards) {
    const idx = hand.indexOf(card);
    if (idx !== -1) hand.splice(idx, 1);
  }
}

// Hàm trả về số bài còn lại của từng người
function getHandsCount(game) {
  const result = {};
  for (const pid of game.players) {
    result[pid] = game.hands[pid] ? game.hands[pid].length : 0;
  }
  return result;
}

// Kiểm tra thắng cuộc và chuyển lượt
async function checkWinAndNextTurn(room, playerId) {
  const game = gameRooms[room];
  if (!game) return;
  if (game.hands[playerId] && game.hands[playerId].length === 0 && !game.winners.includes(playerId)) {
    game.winners.push(playerId);
    io.to(room).emit('playerWin', { winner: playerId, winners: game.winners });
    // Nếu chỉ còn 1 người chưa thắng, kết thúc ván
    const activePlayers = game.players.filter(pid => !game.winners.includes(pid));
    if (activePlayers.length === 1) {
      game.winners.push(activePlayers[0]);
      io.to(room).emit('playerWin', { winner: activePlayers[0], winners: game.winners });

      // --- CẬP NHẬT ĐIỂM SAU VÁN TIẾN LÊN ---
      const bet = game.betAmount || 50;
      const allPlayers = game.players.map(pid => {
        const playerSocket = io.sockets.sockets.get(pid);
        let username = null;
        if (playerSocket && playerSocket.data && playerSocket.data.username) {
          username = playerSocket.data.username;
        }
        return { pid, username };
      });
      // Xác định winner (người về nhất) và losers (3 người còn lại)
      const winnerPid = game.winners[0];
      const winner = allPlayers.find(p => p.pid === winnerPid);
      const losers = allPlayers.filter(p => p.pid !== winnerPid);
      if (winner && winner.username) {
        await User.updateOne(
          { username: winner.username },
          { $inc: { score: bet * losers.length } }
        );
        const user = await User.findOne({ username: winner.username });
        const winnerSocket = io.sockets.sockets.get(winnerPid);
        if (winnerSocket && user) winnerSocket.emit('updateScore', user.score);
        console.log(`[Tiến lên] ${winner.username} (${winnerPid}) thắng, cộng ${bet * losers.length} điểm, tổng: ${user ? user.score : 'N/A'} (phòng: ${room})`);
      }
      for (const loser of losers) {
        if (loser.username) {
          await User.updateOne(
            { username: loser.username },
            { $inc: { score: -bet } }
          );
          const user = await User.findOne({ username: loser.username });
          const loserSocket = io.sockets.sockets.get(loser.pid);
          if (loserSocket && user) loserSocket.emit('updateScore', user.score);
          console.log(`[Tiến lên] ${loser.username} thua, trừ ${bet} điểm, còn: ${user ? user.score : 'N/A'}`);
        }
      }
      // Gửi popup điểm mới cho cả phòng
      const allScore = {};
      for (const p of allPlayers) {
        if (p.username) {
          const user = await User.findOne({ username: p.username });
          if (user) allScore[p.username] = user.score;
        }
      }
      io.to(room).emit('scoreChanged', allScore);
      return;
    }
  }
  // Chuyển lượt cho người tiếp theo
  nextTurn(room);
}

// 🚀 START SERVER
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
