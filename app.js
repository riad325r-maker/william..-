// app.js - الكود الرئيسي للتطبيق (نسخة نهائية مع إصلاح مشكلة الغرف)

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
let unsubscribeRooms = null;
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

// ================== دوال إصلاح الرومات والتشخيص ==================

// دالة لتنظيف وعرض جميع الغرف (للتشخيص)
async function debugAllRooms() {
    console.log('%c🔍 بدأ تشخيص الغرف...', 'color: blue; font-size: 14px');
    console.log('👤 المستخدم الحالي:', currentUser?.email);
    
    try {
        // 1. جلب كل الغرف
        const allRooms = await db.collection('rooms').get();
        console.log(`%c📊 عدد الغرف الكلي: ${allRooms.size}`, 'color: green; font-weight: bold');
        
        if (allRooms.empty) {
            console.log('%c❌ لا توجد غرف في قاعدة البيانات', 'color: red');
            showToast('❌ لا توجد غرف في Firebase');
            return;
        }
        
        allRooms.forEach(doc => {
            const data = doc.data();
            console.log('📁 الغرفة:', {
                id: doc.id,
                name: data.name,
                code: data.code,
                owner: data.owner,
                members: data.members || [],
                membersCount: data.members?.length || 0
            });
        });

        // 2. جلب غرف المستخدم الحالي
        if (currentUser) {
            const userRooms = await db.collection('rooms')
                .where('members', 'array-contains', currentUser.email)
                .get();
            
            console.log(`%c👤 غرف المستخدم ${currentUser.email}: ${userRooms.size}`, 'color: blue');
            
            if (userRooms.empty) {
                console.log('%c❌ المستخدم ليس لديه غرف', 'color: red');
                
                // 3. اقتراح: البحث عن الغرف التي يمكن الانضمام لها
                const availableRooms = await db.collection('rooms').get();
                const joinable = [];
                availableRooms.forEach(doc => {
                    const data = doc.data();
                    if (!data.members?.includes(currentUser.email)) {
                        joinable.push({
                            id: doc.id,
                            name: data.name,
                            code: data.code,
                            owner: data.owner
                        });
                    }
                });
                
                if (joinable.length > 0) {
                    console.log('%c✅ غرف يمكنك الانضمام لها:', 'color: green', joinable);
                    showToast(`🔑 يوجد ${joinable.length} غرفة يمكنك الانضمام لها`);
                }
            } else {
                console.log('%c✅ غرفك الحالية:', 'color: green');
                userRooms.forEach(doc => {
                    const data = doc.data();
                    console.log(`   📁 ${data.name} (${data.code})`);
                });
            }
        }

    } catch (error) {
        console.error('%c❌ خطأ في التشخيص:', 'color: red', error);
        showToast('❌ خطأ في التشخيص: ' + error.message);
    }
}

// دالة لإصلاح الغرف (تحويل uid إلى email)
async function fixRooms() {
    if (!currentUser) {
        showToast('❌ سجل دخول أولاً');
        return;
    }

    try {
        showToast('🔧 جاري إصلاح الغرف...');
        
        const roomsRef = db.collection('rooms');
        const snapshot = await roomsRef.get();
        
        if (snapshot.empty) {
            showToast('❌ لا توجد غرف للإصلاح');
            return;
        }
        
        let fixed = 0;
        const batch = db.batch();

        snapshot.forEach(doc => {
            const data = doc.data();
            let needsFix = false;
            const updates = {};

            // تحويل owner من uid إلى email
            if (data.owner && !data.owner.includes('@')) {
                updates.owner = currentUser.email;
                needsFix = true;
                console.log(`🔧 إصلاح owner في غرفة ${data.name}: ${data.owner} -> ${currentUser.email}`);
            }

            // تحويل members من uid إلى email
            if (data.members && Array.isArray(data.members)) {
                const newMembers = data.members.map(m => 
                    m.includes('@') ? m : currentUser.email
                );
                if (JSON.stringify(data.members) !== JSON.stringify(newMembers)) {
                    updates.members = newMembers;
                    needsFix = true;
                    console.log(`🔧 إصلاح members في غرفة ${data.name}:`, data.members, '->', newMembers);
                }
            }

            if (needsFix) {
                batch.update(doc.ref, updates);
                fixed++;
            }
        });

        if (fixed > 0) {
            await batch.commit();
            showToast(`✅ تم إصلاح ${fixed} غرفة`);
            console.log(`%c✅ تم إصلاح ${fixed} غرفة`, 'color: green');
            
            // إعادة تحميل الغرف
            if (roomHandler) {
                roomHandler.stopListening();
                roomHandler.startListening();
            } else {
                loadRooms();
            }
        } else {
            showToast('✅ جميع الغرف سليمة');
            console.log('%c✅ جميع الغرف سليمة', 'color: green');
        }

    } catch (error) {
        showToast('❌ خطأ: ' + error.message);
        console.error('❌ خطأ في الإصلاح:', error);
    }
}

// دالة لحذف الغرف المعطوبة
async function cleanupRooms() {
    if (!currentUser) {
        showToast('❌ سجل دخول أولاً');
        return;
    }
    
    try {
        showToast('🧹 جاري تنظيف الغرف...');
        
        const snapshot = await db.collection('rooms').get();
        const batch = db.batch();
        let deleted = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            // احذف الغرف التي ليس لها members أو owner
            if (!data.members || !data.owner || data.members.length === 0) {
                batch.delete(doc.ref);
                deleted++;
                console.log(`🗑️ حذف غرفة ${data.name || 'بدون اسم'}`);
            }
        });

        if (deleted > 0) {
            await batch.commit();
            showToast(`✅ تم حذف ${deleted} غرفة معطوبة`);
            console.log(`%c✅ تم حذف ${deleted} غرفة معطوبة`, 'color: green');
            
            // إعادة تحميل الغرف
            if (roomHandler) {
                roomHandler.stopListening();
                roomHandler.startListening();
            } else {
                loadRooms();
            }
        } else {
            showToast('✅ لا توجد غرف معطوبة');
            console.log('%c✅ لا توجد غرف معطوبة', 'color: green');
        }

    } catch (error) {
        showToast('❌ خطأ: ' + error.message);
        console.error('❌ خطأ في التنظيف:', error);
    }
}

// دالة لعرض الغرف في الكونسول
async function showMyRooms() {
    if (!currentUser) {
        console.log('%c❌ سجل دخول أولاً', 'color: red');
        showToast('❌ سجل دخول أولاً');
        return;
    }

    console.log('%c🔍 جاري البحث عن غرفك...', 'color: blue');
    
    try {
        const snapshot = await db.collection('rooms')
            .where('members', 'array-contains', currentUser.email)
            .get();

        console.log(`%c📊 عدد غرفك: ${snapshot.size}`, 'color: green; font-weight: bold');
        
        if (snapshot.empty) {
            console.log('%c❌ لا توجد غرف لك', 'color: red');
            showToast('❌ لا توجد غرف لك');
            return;
        }
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const isOwner = data.owner === currentUser.email ? '👑' : '👤';
            console.log(`%c${isOwner} ${data.name} | 🔑 ${data.code} | 👤 منشئ: ${data.owner}`, 'color: #6366f1');
        });
        
        showToast(`✅ لديك ${snapshot.size} غرفة`);

    } catch (error) {
        console.error('❌ خطأ:', error);
        showToast('❌ خطأ في جلب الغرف');
    }
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
    if (unsubscribeRooms) unsubscribeRooms();
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
        
        // تحميل الغرف مباشرة
        loadRooms();
        
        // استعادة الغرفة المحفوظة
        setTimeout(() => {
            const savedRoom = localStorage.getItem('currentRoom');
            if (savedRoom) {
                try {
                    const roomData = JSON.parse(savedRoom);
                    db.collection('rooms').doc(roomData.roomId).get().then(doc => {
                        if (doc.exists && doc.data().members?.includes(currentUser.email)) {
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
        if (unsubscribeRooms) unsubscribeRooms();
        if (unsubscribeMessages) unsubscribeMessages();
    }
});

// ================== إدارة الغرف ==================
async function createRoom() {
    const name = document.getElementById('roomName').value.trim();
    const code = document.getElementById('roomCode').value;
    
    if (!saveHandler) {
        saveHandler = new SaveHandler(db, currentUser);
    }
    
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
    
    if (!saveHandler) {
        saveHandler = new SaveHandler(db, currentUser);
    }
    
    const result = await saveHandler.joinRoom(code);
    
    showToast(result.message);
    
    if (result.success) {
        document.getElementById('roomCode').value = '';
        openChat(result.roomId, result.roomData.name, result.roomData.code, result.roomData.owner);
    }
}

function loadRooms() {
    if (!currentUser) return;
    if (unsubscribeRooms) unsubscribeRooms();

    const loader = document.getElementById('roomsLoader');
    if (loader) loader.style.display = 'block';

    console.log('%c🔍 جاري تحميل غرف:', 'color: blue', currentUser.email);

    unsubscribeRooms = db.collection('rooms')
        .where('members', 'array-contains', currentUser.email)
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            if (loader) loader.style.display = 'none';
            const list = document.getElementById('roomsList');
            if (!list) return;
            
            list.innerHTML = ''; 

            console.log(`%c📊 تم العثور على ${snapshot.size} غرفة`, 'color: green');

            if (snapshot.empty) {
                list.innerHTML = `
                    <div class="loader" style="text-align: center; padding: 20px;">
                        <i class="fas fa-info-circle"></i> لا توجد مساحات بعد. أنشئ واحدة!<br>
                        <div style="margin-top: 10px; display: flex; gap: 5px; justify-content: center;">
                            <button onclick="debugAllRooms()" style="background:none; color:var(--primary); border:1px solid; padding:5px 10px; border-radius:10px; font-size:12px;">
                                <i class="fas fa-search"></i> تشخيص
                            </button>
                            <button onclick="fixRooms()" style="background:none; color:var(--success); border:1px solid; padding:5px 10px; border-radius:10px; font-size:12px;">
                                <i class="fas fa-wrench"></i> إصلاح
                            </button>
                        </div>
                    </div>
                `;
                return;
            }

            snapshot.forEach(doc => {
                const room = doc.data();
                const roomId = doc.id;

                const div = document.createElement('div');
                div.className = 'room-item';
                div.setAttribute('data-room-id', roomId);

                const infoDiv = document.createElement('div');
                
                const nameStrong = document.createElement('strong');
                nameStrong.textContent = room.name || 'بدون اسم';
                
                // أضف علامة إذا كان المستخدم هو المنشئ
                if (room.owner === currentUser.email) {
                    const ownerBadge = document.createElement('span');
                    ownerBadge.style.backgroundColor = 'var(--primary)';
                    ownerBadge.style.color = 'white';
                    ownerBadge.style.padding = '2px 8px';
                    ownerBadge.style.borderRadius = '10px';
                    ownerBadge.style.fontSize = '10px';
                    ownerBadge.style.marginRight = '5px';
                    ownerBadge.textContent = 'منشئ';
                    nameStrong.appendChild(ownerBadge);
                }

                const codeSmall = document.createElement('small');
                codeSmall.style.color = 'var(--text-dim)';
                codeSmall.style.display = 'block';
                codeSmall.innerHTML = `<i class="fas fa-key" style="font-size: 10px;"></i> ${room.code || 'لا يوجد'}`;

                infoDiv.appendChild(nameStrong);
                infoDiv.appendChild(codeSmall);

                const arrowSpan = document.createElement('span');
                arrowSpan.style.fontSize = '18px';
                arrowSpan.innerHTML = '<i class="fas fa-arrow-left"></i>';

                div.appendChild(infoDiv);
                div.appendChild(arrowSpan);

                div.addEventListener('click', () => openChat(roomId, room.name, room.code, room.owner));

                list.appendChild(div);
            });
        }, error => {
            if (loader) loader.style.display = 'none';
            showToast('❌ خطأ في تحميل الغرف: ' + error.message);
            console.error('❌ خطأ في التحميل:', error);
        });
}

// ================== دوال الدردشة ==================
function openChat(roomId, name, code, ownerEmail) {
    if (unsubscribeMessages) unsubscribeMessages();

    currentRoomId = roomId;
    currentRoomOwner = ownerEmail;

    saveCurrentRoom(roomId, name, code, ownerEmail);

    document.getElementById('chatTitle').textContent = name;
    
    const codeDisplay = document.getElementById('roomCodeDisplay');
    if (codeDisplay) {
        codeDisplay.innerHTML = `
            <i class="fas fa-copy"></i>
            <span style="font-weight: bold; letter-spacing: 1px; direction: ltr;">${code}</span>
        `;
        codeDisplay.onclick = () => copyCode(code);
    }

    const delBtn = document.getElementById('deleteRoomBtn');
    if (delBtn) {
        delBtn.style.display = ownerEmail === currentUser.email ? 'block' : 'none';
        delBtn.onclick = () => deleteRoom(roomId);
    }

    showScreen('chat');
    loadMessages(roomId);
}

function leaveChat() {
    if (unsubscribeMessages) unsubscribeMessages();
    showScreen('main');
}

async function deleteRoom(roomId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف المساحة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    
    if (!saveHandler) {
        saveHandler = new SaveHandler(db, currentUser);
    }
    
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
    if (!box) return;
    
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
            console.error('❌ خطأ في تحميل الرسائل:', error);
        });
}

function addMessageToBox(msgId, msgData) {
    const box = document.getElementById('messagesBox');
    if (!box) return;
    
    const isMe = msgData.sender === currentUser.email;

    let timeStr = 'الآن';
    if (msgData.time) {
        try {
            const date = msgData.time.toDate();
            timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            timeStr = 'الآن';
        }
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
        console.error('❌ خطأ في حذف الرسالة:', error);
    }
}

function sendMsg() {
    const input = document.getElementById('msgInput');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text || !currentRoomId) return;

    db.collection('rooms').doc(currentRoomId).collection('messages').add({
        text: text,
        sender: currentUser.email,
        time: firebase.firestore.FieldValue.serverTimestamp(),
        seen: false
    }).then(() => {
        input.value = '';
    }).catch(error => {
        showToast('❌ فشل الإرسال');
        console.error('❌ خطأ في الإرسال:', error);
    });
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
window.debugAllRooms = debugAllRooms;
window.fixRooms = fixRooms;
window.cleanupRooms = cleanupRooms;
window.showMyRooms = showMyRooms;
window.loadRooms = loadRooms;
