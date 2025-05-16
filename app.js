// --- Socket.IO Setup ---
let socket = io("https://your-chess-server.example.com"); // Change to your server URL
let friends = [];
let onlinePlayers = [];
let onlineGame = null; // {opponent, color, fen, moves: []}
let chatMessages = [];
let mailMessages = [];

// --- User ---
let currentUser = null, userElo = 1200, userPic = "default-pfp.png";
let gameMode = null, board = [], turn = "w", botType = "buddy", botElo = 250, timerInterval = null;
let whiteTime = 600, blackTime = 600, timerRunning = false, selectedSq = null, legalMoves = [], friendTurn = "w", moveHistory = [];
const PIECES = {wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟"};
const FILES = "abcdefgh";
function $(id) { return document.getElementById(id); }

// --- Socket.IO Events ---
socket.on("connect", () => {
  if (currentUser) socket.emit("login", currentUser);
});
socket.on("friends", list => { friends = list; renderFriends(); });
socket.on("online", list => { onlinePlayers = list; renderOnline(); });
socket.on("friendRequest", from => {
  showPopup(`${from} sent you a friend request! <button onclick="acceptFriend('${from}')">Accept</button>`);
});
socket.on("gameInvite", from => {
  showPopup(`${from} invites you to play! <button onclick="acceptGame('${from}')">Accept</button>`);
});
socket.on("startGame", ({opponent, color, fen}) => { startOnlineGame(opponent, color, fen); });
socket.on("move", move => { if (gameMode === "online") applyOnlineMove(move); });
socket.on("gameOver", msg => { showPopup(msg); stopTimer(); gameMode = null; });

// --- Chat ---
socket.on("chat", ({from, text}) => {
  chatMessages.push({from, text});
  renderChat();
});
function openChatPanel() { $("chat-panel").style.display = "block"; renderChat(); }
function closeChatPanel() { $("chat-panel").style.display = "none"; }
function sendChat() {
  let text = $("chat-input").value.trim();
  if (!text) return;
  socket.emit("chat", {text});
  chatMessages.push({from: currentUser, text});
  $("chat-input").value = "";
  renderChat();
}
function renderChat() {
  $("chat-messages").innerHTML = chatMessages.map(m =>
    `<div><b>${m.from}:</b> ${m.text}</div>`
  ).join("");
  $("chat-messages").scrollTop = $("chat-messages").scrollHeight;
}

// --- Mail ---
socket.on("mail", mailArr => {
  mailMessages = mailArr;
  renderMail();
});
socket.on("mailNew", mail => {
  mailMessages.push(mail);
  renderMail();
});
function openMailPanel() { $("mail-panel").style.display = "block"; renderMail(); }
function closeMailPanel() { $("mail-panel").style.display = "none"; }
function sendMail() {
  let to = $("mail-to").value.trim();
  let subject = $("mail-subject").value.trim();
  let body = $("mail-input").value.trim();
  if (!to || !subject || !body) return;
  socket.emit("mail", {to, subject, body});
  $("mail-to").value = ""; $("mail-subject").value = ""; $("mail-input").value = "";
}
function renderMail() {
  $("mail-messages").innerHTML = mailMessages.map(m =>
    `<div class="mail-item">
      <div class="mail-from">${m.from}</div>
      <div class="mail-subject">${m.subject}</div>
      <div class="mail-body">${m.body}</div>
    </div>`
  ).join("");
  $("mail-messages").scrollTop = $("mail-messages").scrollHeight;
}

// --- Friends UI ---
function openFriendsPanel() { $("friends-panel").style.display = "block"; }
function closeFriendsPanel() { $("friends-panel").style.display = "none"; }
function renderFriends() {
  $("friends-list").innerHTML = friends.map(f =>
    `<div>${f} <button onclick="inviteFriend('${f}')">Invite</button>
     <button onclick="startChatWith('${f}')">Chat</button>
     <button onclick="mailTo('${f}')">Mail</button>
    </div>`
  ).join("");
}
function addFriend() {
  let name = $("add-friend-input").value.trim();
  if (name) socket.emit("addFriend", name);
  $("add-friend-input").value = "";
}
function inviteFriend(name) { socket.emit("inviteGame", name); }
function acceptFriend(name) { socket.emit("acceptFriend", name); closePopup(); }
function startChatWith(name) {
  openChatPanel();
  $("chat-input").placeholder = "Message to " + name;
}
function mailTo(name) {
  openMailPanel();
  $("mail-to").value = name;
  $("mail-subject").focus();
}

// --- Online UI ---
function openOnlinePanel() { $("online-panel").style.display = "block"; }
function closeOnlinePanel() { $("online-panel").style.display = "none"; }
function renderOnline() {
  $("online-list").innerHTML = onlinePlayers.map(u =>
    `<div>${u} <button onclick="inviteFriend('${u}')">Invite</button>
     <button onclick="startChatWith('${u}')">Chat</button>
     <button onclick="mailTo('${u}')">Mail</button>
    </div>`
  ).join("");
}
function acceptGame(from) { socket.emit("acceptGame", from); closePopup(); }

// --- Play Online ---
function playOnline() {
  $("homepage").style.display = "none";
  $("move-history-box").style.display = "";
  $("board").style.display = "";
  $("timers").style.display = "";
  $("captured").style.display = "";
  $("action-buttons").style.display = "";
  showPopup("Invite a friend or online player to start a game!");
}

// --- Online Chess Game Logic ---
function startOnlineGame(opponent, color, fen) {
  gameMode = "online";
  onlineGame = {opponent, color, fen, moves: []};
  turn = "w";
  board = fen ? fenToBoard(fen) : [
    ["bR","bN","bB","bQ","bK","bB","bN","bR"],
    ["bP","bP","bP","bP","bP","bP","bP","bP"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["wP","wP","wP","wP","wP","wP","wP","wP"],
    ["wR","wN","wB","wQ","wK","wB","wN","wR"]
  ];
  moveHistory = [];
  whiteTime = 600; blackTime = 600;
  $("homepage").style.display = "none";
  $("move-history-box").style.display = "";
  $("board").style.display = "";
  $("timers").style.display = "";
  $("captured").style.display = "";
  $("action-buttons").style.display = "";
  renderBoard();
  renderMoveHistory();
  startTimer();
  showPopup(`Game started vs ${opponent} as ${color === "w" ? "White" : "Black"}`);
}
function fenToBoard(fen) {
  let rows = fen.split(" ")[0].split("/");
  let b = [];
  for (let r of rows) {
    let row = [];
    for (let ch of r) {
      if (!isNaN(ch)) for (let i=0;i<parseInt(ch);i++) row.push(null);
      else if (ch === ch.toUpperCase()) row.push("w"+ch.toUpperCase());
      else row.push("b"+ch.toUpperCase());
    }
    b.push(row);
  }
  return b;
}
function sendMoveOnline(from, to) {
  socket.emit("move", {from, to});
}
function applyOnlineMove(move) {
  movePiece(move.from, move.to);
  renderBoard();
  renderMoveHistory();
}

// --- Homepage & Navigation ---
function loadUser() {
  let u = localStorage.getItem("chess_user");
  if (u) {
    let data = JSON.parse(u);
    currentUser = data.name; userElo = data.elo; userPic = data.pic || "default-pfp.png";
    $("nickname-display").textContent = `Welcome, ${currentUser} (ELO: ${userElo})!`;
    $("profile-pic").src = userPic; $("profile-pic").style.display = "";
    $("signin-btn").style.display = "none"; $("signup-btn").style.display = "none"; $("signout-btn").style.display = "";
    if (socket.connected) socket.emit("login", currentUser);
  }
}
function saveUser() {
  localStorage.setItem("chess_user", JSON.stringify({name: currentUser, elo: userElo, pic: userPic}));
}
function openSignIn() { $("signin-panel").style.display = "block"; }
function closeSignIn() { $("signin-panel").style.display = "none"; $("signin-error").textContent = ""; }
function openSignUp() { $("signup-panel").style.display = "block"; }
function closeSignUp() { $("signup-panel").style.display = "none"; $("signup-error").textContent = ""; }
function signIn() {
  let email = $("signin-email").value, pass = $("signin-pass").value;
  if (!email || !pass) { $("signin-error").textContent = "Enter email and password."; return; }
  currentUser = email.split("@")[0];
  userElo = parseInt(localStorage.getItem("elo_"+currentUser)) || 1200;
  userPic = localStorage.getItem("pic_"+currentUser) || "default-pfp.png";
  $("nickname-display").textContent = `Welcome, ${currentUser} (ELO: ${userElo})!`;
  $("profile-pic").src = userPic; $("profile-pic").style.display = "";
  $("signin-btn").style.display = "none"; $("signup-btn").style.display = "none"; $("signout-btn").style.display = "";
  saveUser(); closeSignIn();
  if (socket.connected) socket.emit("login", currentUser);
}
function signUp() {
  let email = $("signup-email").value, pass = $("signup-pass").value;
  if (!email || !pass) { $("signup-error").textContent = "Enter email and password."; return; }
  $("signup-error").textContent = "Account created! Please sign in.";
}
function signOut() {
  currentUser = null; $("nickname-display").textContent = ""; $("profile-pic").src = "default-pfp.png"; $("profile-pic").style.display = "none";
  $("signin-btn").style.display = ""; $("signup-btn").style.display = ""; $("signout-btn").style.display = "none";
  localStorage.removeItem("chess_user"); backToHome();
}
function openSettings() { $("settings-panel").style.display = "block"; }
function closeSettings() { $("settings-panel").style.display = "none"; }
$("pfp-upload").onchange = function(e) {
  let file = e.target.files[0]; if (!file) return;
  let reader = new FileReader();
  reader.onload = function(evt) {
    userPic = evt.target.result; $("profile-pic").src = userPic; $("profile-pic").style.display = "";
    if (currentUser) localStorage.setItem("pic_"+currentUser, userPic); saveUser();
  }; reader.readAsDataURL(file);
};

// --- Homepage & Navigation ---
function showHomepage() {
  $("homepage").style.display = "";
  $("move-history-box").style.display = "none";
  $("board").style.display = "none";
  $("timers").style.display = "none";
  $("captured").style.display = "none";
  $("action-buttons").style.display = "none";
  $("play-options").style.display = "none";
  stopTimer(); gameMode = null;
}
function backToHome() { showHomepage(); }
function showPlayOptions() { $("play-options").style.display = $("play-options").style.display === "block" ? "none" : "block"; }

// --- Chess Board Logic ---
function startNewGameBot(type="buddy") {
  botType = type; botElo = type === "cat" ? 500 : 250;
  gameMode = "bot"; turn = "w"; moveHistory = [];
  board = [
    ["bR","bN","bB","bQ","bK","bB","bN","bR"],
    ["bP","bP","bP","bP","bP","bP","bP","bP"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["wP","wP","wP","wP","wP","wP","wP","wP"],
    ["wR","wN","wB","wQ","wK","wB","wN","wR"]
  ];
  whiteTime = 600; blackTime = 600;
  $("homepage").style.display = "none";
  $("move-history-box").style.display = "";
  $("board").style.display = "";
  $("timers").style.display = "";
  $("captured").style.display = "";
  $("action-buttons").style.display = "";
  renderBoard(); renderMoveHistory(); startTimer();
}
function startNewGameFriend() {
  gameMode = "friend"; friendTurn = "w"; turn = "w"; moveHistory = [];
  board = [
    ["bR","bN","bB","bQ","bK","bB","bN","bR"],
    ["bP","bP","bP","bP","bP","bP","bP","bP"],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ["wP","wP","wP","wP","wP","wP","wP","wP"],
    ["wR","wN","wB","wQ","wK","wB","wN","wR"]
  ];
  whiteTime = 600; blackTime = 600;
  $("homepage").style.display = "none";
  $("move-history-box").style.display = "";
  $("board").style.display = "";
  $("timers").style.display = "";
  $("captured").style.display = "";
  $("action-buttons").style.display = "";
  renderBoard(); renderMoveHistory(); startTimer();
}
function renderBoard(selected = null, moves = []) {
  const boardDiv = $("board"); if (!boardDiv) return;
  boardDiv.innerHTML = "";
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const sq = document.createElement("div");
    sq.className = ((r + c) % 2 === 0 ? "light" : "dark") + " square";
    if (selected && selected[0] === r && selected[1] === c) sq.style.outline = "2px solid #f6c700";
    if (moves.some(m => m[0] === r && m[1] === c)) {
      let dot = document.createElement("div"); dot.className = "dot"; sq.appendChild(dot);
    }
    const piece = board[r][c];
    if (piece) {
      const span = document.createElement("span");
      span.textContent = PIECES[piece];
      span.className = "piece " + (piece[0] === "w" ? "white" : "black");
      sq.appendChild(span);
    }
    sq.onclick = () => onSquareClick(r, c, selected, moves);
    boardDiv.appendChild(sq);
  }
  updateCaptured();
}
function onSquareClick(r, c, selected, moves) {
  if (gameMode === "bot" && turn === "w") {
    const piece = board[r][c];
    if (selectedSq) {
      if (moves.some(m => m[0] === r && m[1] === c)) {
        recordMove(selectedSq, [r, c], board[selectedSq[0]][selectedSq[1]], board[r][c]);
        movePiece(selectedSq, [r, c]);
        selectedSq = null; legalMoves = [];
        renderBoard(); renderMoveHistory();
        setTimeout(botMove, 600); return;
      } else { selectedSq = null; legalMoves = []; renderBoard(); return; }
    }
    if (piece && piece[0] === "w") {
      selectedSq = [r, c]; legalMoves = getLegalMoves(r, c, piece, "w");
      renderBoard(selectedSq, legalMoves);
    }
  }
  if (gameMode === "friend") {
    const piece = board[r][c];
    if (selectedSq) {
      if (moves.some(m => m[0] === r && m[1] === c)) {
        recordMove(selectedSq, [r, c], board[selectedSq[0]][selectedSq[1]], board[r][c]);
        movePiece(selectedSq, [r, c]);
        selectedSq = null; legalMoves = [];
        renderBoard(); renderMoveHistory();
        friendTurn = friendTurn === "w" ? "b" : "w"; checkGameEnd(); return;
      } else { selectedSq = null; legalMoves = []; renderBoard(); return; }
    }
    if (piece && piece[0] === friendTurn) {
      selectedSq = [r, c]; legalMoves = getLegalMoves(r, c, piece, friendTurn);
      renderBoard(selectedSq, legalMoves);
    }
  }
  if (gameMode === "online") {
    if ((onlineGame.color === "w" && turn === "w") || (onlineGame.color === "b" && turn === "b")) {
      const piece = board[r][c];
      if (selectedSq) {
        if (moves.some(m => m[0] === r && m[1] === c)) {
          recordMove(selectedSq, [r, c], board[selectedSq[0]][selectedSq[1]], board[r][c]);
          sendMoveOnline(selectedSq, [r, c]);
          movePiece(selectedSq, [r, c]);
          selectedSq = null; legalMoves = [];
          renderBoard(); renderMoveHistory();
          return;
        } else { selectedSq = null; legalMoves = []; renderBoard(); return; }
      }
      if (piece && ((onlineGame.color === "w" && piece[0] === "w") || (onlineGame.color === "b" && piece[0] === "b"))) {
        selectedSq = [r, c]; legalMoves = getLegalMoves(r, c, piece, onlineGame.color);
        renderBoard(selectedSq, legalMoves);
      }
    }
  }
  if (gameMode === "puzzle" && turn === "w") {
    const piece = board[r][c];
    if (selectedSq) {
      if (moves.some(m => m[0] === r && m[1] === c)) {
        recordMove(selectedSq, [r, c], board[selectedSq[0]][selectedSq[1]], board[r][c]);
        movePiece(selectedSq, [r, c]);
        selectedSq = null; legalMoves = [];
        renderBoard(); renderMoveHistory();
        if (board[0][4] === null) showPopup("Checkmate! You solved the puzzle!");
        else showPopup("Try again!");
        return;
      } else { selectedSq = null; legalMoves = []; renderBoard(); return; }
    }
    if (piece && piece[0] === "w") {
      selectedSq = [r, c]; legalMoves = getLegalMoves(r, c, piece, "w");
      renderBoard(selectedSq, legalMoves);
    }
  }
}
function movePiece(from, to) {
  board[to[0]][to[1]] = board[from[0]][from[1]];
  board[from[0]][from[1]] = null;
  turn = turn === "w" ? "b" : "w";
  checkGameEnd();
}
function botMove() {
  if (gameMode !== "bot" || turn !== "b") return;
  let moves = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = board[r][c];
    if (p && p[0] === "b") {
      const ms = getLegalMoves(r, c, p, "b");
      ms.forEach(m => moves.push({from:[r,c],to:m}));
    }
  }
  if (moves.length === 0) { showPopup("You win!"); updateElo(true); stopTimer(); return; }
  let move;
  if (botType === "cat") {
    let captures = moves.filter(m => board[m.to[0]][m.to[1]]);
    move = captures.length ? captures[Math.floor(Math.random()*captures.length)] : moves[Math.floor(Math.random()*moves.length)];
  } else {
    move = moves[Math.floor(Math.random() * moves.length)];
  }
  recordMove(move.from, move.to, board[move.from[0]][move.from[1]], board[move.to[0]][move.to[1]]);
  movePiece(move.from, move.to);
  renderBoard(); renderMoveHistory(); turn = "w"; checkGameEnd();
}
function updateCaptured() {
  let white = "", black = "";
  let all = [].concat(...board);
  let counts = {wP:0,wN:0,wB:0,wR:0,wQ:0,bP:0,bN:0,bB:0,bR:0,bQ:0};
  let start = {wP:8,wN:2,wB:2,wR:2,wQ:1,bP:8,bN:2,bB:2,bR:2,bQ:1};
  for (let k in counts) counts[k] = start[k] - all.filter(x=>x===k).length;
  for (let k of ["bP","bN","bB","bR","bQ"]) for (let i=0;i<counts[k];i++) white += PIECES[k];
  for (let k of ["wP","wN","wB","wR","wQ"]) for (let i=0;i<counts[k];i++) black += PIECES[k];
  $("captured-white").textContent = white;
  $("captured-black").textContent = black;
}
function recordMove(from, to, piece, captured) {
  let moveStr = PIECES[piece] + " " + FILES[from[1]] + (8-from[0]) + (captured ? "x" : "-") + FILES[to[1]] + (8-to[0]);
  moveHistory.push(moveStr);
}
function renderMoveHistory() {
  let html = "";
  for (let i=0; i<moveHistory.length; i+=2) {
    html += `<b>${1+i/2}.</b> ${moveHistory[i]||""} ${moveHistory[i+1]||""}<br>`;
  }
  $("move-history").innerHTML = html;
}
function getLegalMoves(r, c, piece, color) {
  const moves = [];
  const type = piece[1];
  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    const startRow = color === "w" ? 6 : 1;
    if (inBounds(r+dir, c) && !board[r+dir][c]) moves.push([r+dir, c]);
    if (r === startRow && !board[r+dir][c] && !board[r+2*dir][c]) moves.push([r+2*dir, c]);
    for (let dc of [-1,1]) {
      if (inBounds(r+dir, c+dc) && board[r+dir][c+dc] && board[r+dir][c+dc][0] !== color)
        moves.push([r+dir, c+dc]);
    }
  }
  if (type === "N") {
    for (let dr of [-2,-1,1,2]) for (let dc of [-2,-1,1,2]) {
      if (Math.abs(dr) !== Math.abs(dc)) {
        let nr = r+dr, nc = c+dc;
        if (inBounds(nr,nc) && (!board[nr][nc] || board[nr][nc][0] !== color))
          moves.push([nr,nc]);
      }
    }
  }
  if (type === "B" || type === "Q") {
    for (let dr of [-1,1]) for (let dc of [-1,1]) {
      for (let i=1;i<8;i++) {
        let nr = r+dr*i, nc = c+dc*i;
        if (!inBounds(nr,nc)) break;
        if (!board[nr][nc]) moves.push([nr,nc]);
        else { if (board[nr][nc][0] !== color) moves.push([nr,nc]); break; }
      }
    }
  }
  if (type === "R" || type === "Q") {
    for (let drdc of [[-1,0],[1,0],[0,-1],[0,1]]) {
      for (let i=1;i<8;i++) {
        let nr = r+drdc[0]*i, nc = c+drdc[1]*i;
        if (!inBounds(nr,nc)) break;
        if (!board[nr][nc]) moves.push([nr,nc]);
        else { if (board[nr][nc][0] !== color) moves.push([nr,nc]); break; }
      }
    }
  }
  if (type === "K") {
    for (let dr of [-1,0,1]) for (let dc of [-1,0,1]) {
      if (dr !== 0 || dc !== 0) {
        let nr = r+dr, nc = c+dc;
        if (inBounds(nr,nc) && (!board[nr][nc] || board[nr][nc][0] !== color))
          moves.push([nr,nc]);
      }
    }
  }
  return moves.filter(move => !wouldLeaveKingInCheck(r, c, move[0], move[1], color));
}
function inBounds(r,c) { return r>=0 && r<8 && c>=0 && c<8; }
function wouldLeaveKingInCheck(fr,fc,tr,tc,color) {
  let tmp = board.map(row=>row.slice());
  tmp[tr][tc] = tmp[fr][fc]; tmp[fr][fc] = null;
  return isKingInCheck(tmp, color);
}
function isKingInCheck(bd, color) {
  let kr, kc;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (bd[r][c]===color+"K") { kr=r; kc=c; }
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    let p = bd[r][c];
    if (p && p[0] !== color) {
      let moves = getRawMoves(bd, r, c, p, p[0]);
      if (moves.some(m => m[0]===kr && m[1]===kc)) return true;
    }
  }
  return false;
}
function getRawMoves(bd, r, c, piece, color) {
  const moves = [];
  const type = piece[1];
  if (type === "P") {
    const dir = color === "w" ? -1 : 1;
    if (inBounds(r+dir, c-1) && bd[r+dir][c-1] && bd[r+dir][c-1][0] !== color) moves.push([r+dir, c-1]);
    if (inBounds(r+dir, c+1) && bd[r+dir][c+1] && bd[r+dir][c+1][0] !== color) moves.push([r+dir, c+1]);
  }
  if (type === "N") {
    for (let dr of [-2,-1,1,2]) for (let dc of [-2,-1,1,2]) {
      if (Math.abs(dr) !== Math.abs(dc)) {
        let nr = r+dr, nc = c+dc;
        if (inBounds(nr,nc) && (!bd[nr][nc] || bd[nr][nc][0] !== color))
          moves.push([nr,nc]);
      }
    }
  }
  if (type === "B" || type === "Q") {
    for (let dr of [-1,1]) for (let dc of [-1,1]) {
      for (let i=1;i<8;i++) {
        let nr = r+dr*i, nc = c+dc*i;
        if (!inBounds(nr,nc)) break;
        if (!bd[nr][nc]) moves.push([nr,nc]);
        else { if (bd[nr][nc][0] !== color) moves.push([nr,nc]); break; }
      }
    }
  }
  if (type === "R" || type === "Q") {
    for (let drdc of [[-1,0],[1,0],[0,-1],[0,1]]) {
      for (let i=1;i<8;i++) {
        let nr = r+drdc[0]*i, nc = c+drdc[1]*i;
        if (!inBounds(nr,nc)) break;
        if (!bd[nr][nc]) moves.push([nr,nc]);
        else { if (bd[nr][nc][0] !== color) moves.push([nr,nc]); break; }
      }
    }
  }
  if (type === "K") {
    for (let dr of [-1,0,1]) for (let dc of [-1,0,1]) {
      if (dr !== 0 || dc !== 0) {
        let nr = r+dr, nc = c+dc;
        if (inBounds(nr,nc) && (!bd[nr][nc] || bd[nr][nc][0] !== color))
          moves.push([nr,nc]);
      }
    }
  }
  return moves;
}
function checkGameEnd() {
  let color = (gameMode === "online" && onlineGame) ? turn : (gameMode === "friend") ? friendTurn : turn;
  let hasMoves = false;
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    let p = board[r][c];
    if (p && p[0] === color && getLegalMoves(r, c, p, color).length > 0) hasMoves = true;
  }
  if (!hasMoves) {
    if (isKingInCheck(board, color)) {
      showPopup((color==="w"?"White":"Black")+" is checkmated! " + (color==="w"?"Black":"White") + " wins!");
      if (gameMode === "bot") updateElo(color !== "w");
      if (gameMode === "online") socket.emit("gameOver", (color==="w"?"White":"Black")+" is checkmated!");
    }
    else showPopup("Stalemate! It's a draw.");
    stopTimer();
  }
}

// --- Play Options ---
function playBot() { $("bot-select-panel").style.display = 'block'; }
function closeBotSelect() { $("bot-select-panel").style.display = 'none'; }
function startBotGame(type) { closeBotSelect(); startNewGameBot(type); }
function playFriend() { startNewGameFriend(); }

// --- Puzzle and Learn ---
function startPuzzle() {
  gameMode = "puzzle";
  $("homepage").style.display = "none";
  $("move-history-box").style.display = "";
  $("board").style.display = "";
  $("timers").style.display = "none";
  $("captured").style.display = "none";
  $("action-buttons").style.display = "";
  moveHistory = [];
  board = [
    [null,null,null,null,"bK",null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,"wQ",null,null,"wK"]
  ];
  turn = "w";
  renderBoard(); renderMoveHistory();
  showPopup("White to move and mate in 1!");
}
function openLearn() { $("learn-popup").style.display = "block"; }
function closeLearn() { $("learn-popup").style.display = "none"; }
function openOpenings() { $("openings-popup").style.display = "block"; }
function closeOpenings() { $("openings-popup").style.display = "none"; }

// --- Timer ---
function startTimer() {
  stopTimer(); timerRunning = true; updateTimers();
  timerInterval = setInterval(() => {
    if (!timerRunning) return;
    if (turn === "w") whiteTime--;
    else blackTime--;
    updateTimers();
    if (whiteTime <= 0) { showPopup("Black wins on time!"); stopTimer(); }
    if (blackTime <= 0) { showPopup("White wins on time!"); stopTimer(); }
  }, 1000);
}
function stopTimer() { timerRunning = false; if (timerInterval) clearInterval(timerInterval); }
function updateTimers() {
  $("white-timer").textContent = formatTime(whiteTime);
  $("black-timer").textContent = formatTime(blackTime);
}
function formatTime(sec) {
  let m = Math.floor(sec/60), s = sec%60;
  return m+":"+(s<10?"0":"")+s;
}

// --- Popup ---
function showPopup(msg) {
  $("popup")?.remove();
  let div = document.createElement("div");
  div.id = "popup";
  div.style = "position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);background:#fff;border:2px solid #888;padding:30px;z-index:100;font-size:1.2em;border-radius:12px;";
  div.innerHTML = `<span>${msg}</span><br><button onclick="closePopup()">OK</button>`;
  document.body.appendChild(div);
}
function closePopup() { $("popup")?.remove(); }

// --- Draw/Resign ---
function offerDraw() {
  if (gameMode === "bot") {
    showPopup("Draw offered! The bot accepts. It's a draw.");
    updateElo(false, true); stopTimer();
  } else if (gameMode === "friend") {
    showPopup("Draw offered! If your opponent accepts, the game is a draw.");
    stopTimer();
  } else if (gameMode === "online") {
    socket.emit("offerDraw");
    showPopup("Draw offered! Waiting for opponent...");
  }
}
function resign() {
  let loser = (gameMode === "friend") ? (friendTurn === "w" ? "White" : "Black") : (turn === "w" ? "White" : "Black");
  showPopup(loser + " resigns! " + (loser === "White" ? "Black" : "White") + " wins!");
  if (gameMode === "bot") updateElo(loser !== "White");
  if (gameMode === "online") socket.emit("resign");
  stopTimer();
}

// --- ELO Calculation (simple demo) ---
function updateElo(win, draw=false) {
  if (!currentUser) return;
  let diff = Math.max(10, Math.abs(userElo - botElo) / 40);
  if (draw) userElo += 0;
  else if (win) userElo += Math.round(diff);
  else userElo -= Math.round(diff);
  if (userElo < 100) userElo = 100;
  $("nickname-display").textContent = `Welcome, ${currentUser} (ELO: ${userElo})!`;
  localStorage.setItem("elo_"+currentUser, userElo); saveUser();
}

// --- Settings ---
function applySettings() {
  document.documentElement.style.setProperty('--light-color', $("light-color").value);
  document.documentElement.style.setProperty('--dark-color', $("dark-color").value);
  document.documentElement.style.setProperty('--white-piece-color', $("white-piece-color").value);
  document.documentElement.style.setProperty('--black-piece-color', $("black-piece-color").value);
  closeSettings();
}

// --- On Load ---
window.onload = function() {
  loadUser();
  closeBotSelect();
  closeSignIn();
  closeSignUp();
  closeSettings();
  closeLearn();
  closeOpenings();
  closeChatPanel();
  closeMailPanel();
  showHomepage();
  renderFriends();
  renderOnline();
};