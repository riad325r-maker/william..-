// app.js - الكود الرئيسي للتطبيق

// ================== إعدادات Firebase ==================
const firebaseConfig = {
    apiKey: "AIzaSyCYpL7ANTarOfbjudlur53Gxax-X2BZm1M",
    authDomain: "private-space-aad2a.firebaseapp.com",
    projectId: "private-space-aad2a",
    storageBucket: "private-space-aad2a.firebasestorage.app",
    messagingSenderId: "59667950205",
    appId: "1:59667950205:web:05511e2ce4606a01ecdf14"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// ================== المتغيرات العامة ==================
let currentUser = null;
let currentRoomId = null;
let currentRoomOwner = null;
let unsubscribeMessages = null;
let saveHandler = null;
let roomHandler = null;

// ================== دوال مساعدة ==================
function showToast(message, duration = 2000) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), duration);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId + 'Screen').classList.add('active');
}

// ================== نظام الثيم ==================
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#themeToggle i');
    if (icon) icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
}

document.getElementById('themeToggle').addEventListener('click', toggleTheme);
initTheme();

// ================== نظام حفظ الجلسة ==================
function saveCurrentRoom(roomId, roomName, roomCode, ownerEmail) {
    localStorage.setItem('currentRoom', JSON.stringify({ 
        roomId, 
        roomName, 
        roomCode, 
        ownerEmail,
        timestamp: new Date().getTime()
    }));
}

function clearSavedRoom() {
    localStorage.removeItem('currentRoom');
}

// ================== المصادقة ==================
function signUp() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!email || !password) return showToast('❌ البريد الإلكتروني وكلمة المرور مطلوبان');
    if (password.length < 6) return showToast('❌ كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    
    auth.createUserWithEmailAndPassword(email, password)
        .then(() => showToast('✅ تم إنشاء الحساب'))
        .catch(error => showToast('❌ خطأ: ' + error.message));
}

function signIn() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    if (!email || !password) return showToast('❌ البريد الإلكتروني وكلمة المرور مطلوبان');
    
    auth.signInWithEmailAndPassword(email, password)
        .catch(() => showToast('❌ بيانات الدخول غير صحيحة'));
}

function logout() {
    if (roomHandler) roomHandler.stopListening();
    if (unsubscribeMessages) unsubscribeMessages();
    clearSavedRoom();
    auth.signOut();
}

auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('userName').textContent = user.email.split('@')[0] || 'مستخدم';
        showScreen('main');
        
        // تهيئة المعالجات
        saveHandler = new SaveHandler(db, currentUser);
        roomHandler = new RoomHandler(db, currentUser, {
            onRoomsUpdate: (rooms) => {
                document.getElementById('roomsLoader').style.display = 'none';
                roomHandler.updateRoomsList(rooms);
            },
            onError: (error) => showToast(error)
        });
        
        roomHandler.startListening();
        
        // استعادة الغرفة المحفوظة
        setTimeout(() => {
            const savedRoom = localStorage.getItem('currentRoom');
            if (savedRoom) {
                try {
                    const roomData = JSON.parse(savedRoom);
                    db.collection('rooms').doc(roomData.roomId).get().then(doc => {
                        if (doc.exists && doc.data().members.includes(currentUser.email)) {
                            openChat(roomData.roomId, roomData.roomName, roomData.roomCode, roomData.ownerEmail);
                        } else {
                            clearSavedRoom();
                        }
                    }).catch(() => clearSavedRoom());
                } catch (e) {
                    clearSavedRoom();
                }
            }
        }, 1500);
        
    } else {
        showScreen('login');
        if (roomHandler) roomHandler.stopListening();
        if (unsubscribeMessages) unsubscribeMessages();
    }
});

// ================== دوال الغرف ==================
async function createRoom() {
    const name = document.getElementById('roomName').value.trim();
    const code = document.getElementById('roomCode').value;
    
    const result = await saveHandler.saveRoom(name, code);
    
    showToast(result.message);
    
    if (result.success) {
        document.getElementById('roomName').value = '';
        document.getElementById('roomCode').value = '';
        openChat(result.roomId, result.roomData.name, result.roomData.code, result.roomData.owner);
    }
}

async function joinRoom() {
    const code = document.getElementById('roomCode').value;
    
    const result = await saveHandler.joinRoom(code);
    
    showToast(result.message);
    
    if (result.success) {
        document.getElementById('roomCode').value = '';
        openChat(result.roomId, result.roomData.name, result.roomData.code, result.roomData.owner);
    }
}

// ================== دوال الدردشة ==================
function openChat(roomId, name, code, ownerEmail) {
    if (unsubscribeMessages) unsubscribeMessages();

    currentRoomId = roomId;
    currentRoomOwner = ownerEmail;

    saveCurrentRoom(roomId, name, code, ownerEmail);

    document.getElementById('chatTitle').textContent = name;
    
    const codeDisplay = document.getElementById('roomCodeDisplay');
    codeDisplay.innerHTML = `
        <i class="fas fa-copy"></i>
        <span style="font-weight: bold; letter-spacing: 1px; direction: ltr;">${code}</span>
    `;
    codeDisplay.onclick = () => copyCode(code);

    const delBtn = document.getElementById('deleteRoomBtn');
    delBtn.style.display = ownerEmail === currentUser.email ? 'block' : 'none';
    delBtn.onclick = () => deleteRoom(roomId);

    showScreen('chat');
    loadMessages(roomId);
}

function leaveChat() {
    if (unsubscribeMessages) unsubscribeMessages();
    showScreen('main');
}

async function deleteRoom(roomId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف المساحة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    const result = await saveHandler.deleteRoom(roomId);
    showToast(result.message);
    
    if (result.success) {
        clearSavedRoom();
        showScreen('main');
    }
}

function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('📋 تم نسخ الكود: ' + code);
    }).catch(() => {
        showToast('❌ فشل النسخ');
    });
}

// ================== نظام الرسائل ==================
function loadMessages(roomId) {
    if (!roomId) return;

    const box = document.getElementById('messagesBox');
    box.innerHTML = '';

    unsubscribeMessages = db.collection('rooms').doc(roomId)
        .collection('messages')
        .orderBy('time')
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                if (change.type === 'added') {
                    const msg = change.doc.data();
                    addMessageToBox(change.doc.id, msg);
                }
            });
            box.scrollTop = box.scrollHeight;
        }, error => {
            showToast('❌ فشل تحميل الرسائل');
        });
}

function addMessageToBox(msgId, msgData) {
    const box = document.getElementById('messagesBox');
    const isMe = msgData.sender === currentUser.email;

    let timeStr = 'الآن';
    if (msgData.time) {
        const date = msgData.time.toDate();
        timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
    msgDiv.setAttribute('data-msg-id', msgId);

    const textDiv = document.createElement('div');
    textDiv.textContent = msgData.text;

    const infoDiv = document.createElement('div');
    infoDiv.className = 'msg-info';

    const timeSpan = document.createElement('span');
    timeSpan.textContent = timeStr;

    infoDiv.appendChild(timeSpan);

    if (isMe) {
        const statusSpan = document.createElement('span');
        statusSpan.className = 'status-seen';
        statusSpan.textContent = msgData.seen ? '✔️✔️' : '✔️';
        infoDiv.appendChild(statusSpan);
    } else {
        if (!msgData.seen) {
            db.collection('rooms').doc(currentRoomId).collection('messages').doc(msgId).update({ seen: true });
        }

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-msg';
        deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
        deleteBtn.onclick = (e) => {
            e.stopPropagation();
            deleteMessage(msgId);
        };
        infoDiv.appendChild(deleteBtn);
    }

    msgDiv.appendChild(textDiv);
    msgDiv.appendChild(infoDiv);
    box.appendChild(msgDiv);
}

async function deleteMessage(msgId) {
    if (!confirm('🗑️ حذف هذه الرسالة؟')) return;
    try {
        await db.collection('rooms').doc(currentRoomId).collection('messages').doc(msgId).delete();
        showToast('✅ تم حذف الرسالة');
    } catch (error) {
        showToast('❌ فشل الحذف');
    }
}

function sendMsg() {
    const input = document.getElementById('msgInput');
    const text = input.value.trim();
    if (!text || !currentRoomId) return;

    db.collection('rooms').doc(currentRoomId).collection('messages').add({
        text: text,
        sender: currentUser.email,
        time: firebase.firestore.FieldValue.serverTimestamp(),
        seen: false
    }).then(() => {
        input.value = '';
    }).catch(() => showToast('❌ فشل الإرسال'));
}

// ================== تصدير الدوال للـ HTML ==================
window.signIn = signIn;
window.signUp = signUp;
window.logout = logout;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveChat = leaveChat;
window.openChat = openChat;
window.sendMsg = sendMsg;
window.copyCode = copyCode;
window.deleteMessage = deleteMessage;
