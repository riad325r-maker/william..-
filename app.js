// app.js - نسخة مبسطة ومضمونة 100%

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
    auth.signOut();
    showScreen('login');
}

// ================== مراقبة حالة المصادقة ==================
auth.onAuthStateChanged(user => {
    console.log('🔥 تغيرت حالة المصادقة:', user ? user.email : 'لا يوجد مستخدم');
    
    if (user) {
        currentUser = user;
        document.getElementById('userName').textContent = user.email.split('@')[0] || 'مستخدم';
        showScreen('main');
        
        // تأخير بسيط ثم تحميل الغرف
        setTimeout(() => {
            loadRoomsDirect();
        }, 500);
        
    } else {
        currentUser = null;
        showScreen('login');
        if (unsubscribeRooms) unsubscribeRooms();
        if (unsubscribeMessages) unsubscribeMessages();
    }
});

// ================== دوال الغرف (مبسطة ومضمونة) ==================

// دالة لتحميل الغرف مباشرة (بدون Handler معقد)
async function loadRoomsDirect() {
    if (!currentUser) {
        console.log('❌ لا يوجد مستخدم');
        return;
    }

    console.log('🔍 جاري تحميل غرف:', currentUser.email);
    
    const loader = document.getElementById('roomsLoader');
    const list = document.getElementById('roomsList');
    
    if (loader) loader.style.display = 'block';
    if (list) list.innerHTML = '';

    try {
        // 1. جلب كل الغرف أولاً (للتشخيص)
        const allRooms = await db.collection('rooms').get();
        console.log(`📊 جميع الغرف في Firebase: ${allRooms.size}`);
        
        allRooms.forEach(doc => {
            const data = doc.data();
            console.log(`   - ${data.name} | كود: ${data.code} | أعضاء:`, data.members || []);
        });

        // 2. جلب غرف المستخدم
        const snapshot = await db.collection('rooms')
            .where('members', 'array-contains', currentUser.email)
            .get();

        console.log(`👤 غرف المستخدم ${currentUser.email}: ${snapshot.size}`);

        if (loader) loader.style.display = 'none';

        if (snapshot.empty) {
            list.innerHTML = `
                <div class="loader" style="padding: 30px;">
                    <i class="fas fa-info-circle" style="font-size: 30px; color: var(--text-dim);"></i>
                    <p>لا توجد غرف لك بعد</p>
                    <p style="font-size: 12px; color: var(--text-dim);">أنشئ غرفة جديدة أو انضم باستخدام كود</p>
                </div>
            `;
            return;
        }

        // عرض الغرف
        list.innerHTML = '';
        snapshot.forEach(doc => {
            const room = doc.data();
            const roomId = doc.id;

            const roomDiv = document.createElement('div');
            roomDiv.className = 'room-item';
            roomDiv.setAttribute('onclick', `openChat('${roomId}', '${room.name}', '${room.code}', '${room.owner}')`);
            
            const isOwner = room.owner === currentUser.email;
            
            roomDiv.innerHTML = `
                <div>
                    <strong>${room.name} ${isOwner ? '<span style="background: var(--primary); color: white; padding: 2px 8px; border-radius: 10px; font-size: 10px;">منشئ</span>' : ''}</strong>
                    <small style="color: var(--text-dim); display: block;">
                        <i class="fas fa-key"></i> ${room.code}
                    </small>
                </div>
                <span><i class="fas fa-arrow-left"></i></span>
            `;
            
            list.appendChild(roomDiv);
        });

        showToast(`✅ تم تحميل ${snapshot.size} غرفة`);

    } catch (error) {
        console.error('❌ خطأ في تحميل الغرف:', error);
        if (loader) loader.style.display = 'none';
        list.innerHTML = `<div class="loader" style="color: red;">خطأ: ${error.message}</div>`;
    }
}

// دالة إنشاء غرفة جديدة
async function createRoom() {
    const name = document.getElementById('roomName').value.trim();
    let code = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!name || !code) {
        showToast('❌ أدخل اسم المساحة والكود');
        return;
    }
    
    if (code.length < 3) {
        showToast('❌ الكود يجب أن يكون 3 أحرف على الأقل');
        return;
    }

    try {
        // التحقق من الكود المكرر
        const existing = await db.collection('rooms').where('code', '==', code).get();
        if (!existing.empty) {
            showToast('❌ هذا الكود مستخدم بالفعل');
            return;
        }

        // إنشاء الغرفة
        const newRoom = {
            name: name,
            code: code,
            owner: currentUser.email,
            members: [currentUser.email],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        const docRef = await db.collection('rooms').add(newRoom);
        console.log('✅ تم إنشاء الغرفة:', docRef.id);
        
        showToast('✅ تم إنشاء المساحة بنجاح');
        
        document.getElementById('roomName').value = '';
        document.getElementById('roomCode').value = '';
        
        // إعادة تحميل الغرف
        await loadRoomsDirect();
        
        // فتح الغرفة
        openChat(docRef.id, name, code, currentUser.email);
        
    } catch (error) {
        showToast('❌ خطأ: ' + error.message);
        console.error('❌ خطأ في الإنشاء:', error);
    }
}

// دالة الانضمام إلى غرفة
async function joinRoom() {
    let code = document.getElementById('roomCode').value.trim().toUpperCase();
    
    if (!code) {
        showToast('❌ أدخل الكود');
        return;
    }

    try {
        const snapshot = await db.collection('rooms').where('code', '==', code).get();
        
        if (snapshot.empty) {
            showToast('❌ لا توجد غرفة بهذا الكود');
            return;
        }

        const roomDoc = snapshot.docs[0];
        const roomData = roomDoc.data();

        // التحقق من العضوية
        if (roomData.members && roomData.members.includes(currentUser.email)) {
            showToast('أنت بالفعل عضو');
            openChat(roomDoc.id, roomData.name, roomData.code, roomData.owner);
            return;
        }

        // إضافة العضو الجديد
        await roomDoc.ref.update({
            members: firebase.firestore.FieldValue.arrayUnion(currentUser.email)
        });
        
        showToast('✅ تم الانضمام');
        document.getElementById('roomCode').value = '';
        
        // إعادة تحميل الغرف
        await loadRoomsDirect();
        
        // فتح الغرفة
        openChat(roomDoc.id, roomData.name, roomData.code, roomData.owner);
        
    } catch (error) {
        showToast('❌ فشل الانضمام: ' + error.message);
        console.error('❌ خطأ في الانضمام:', error);
    }
}

// دالة فتح الدردشة
function openChat(roomId, name, code, ownerEmail) {
    console.log('📁 فتح الغرفة:', {roomId, name, code, ownerEmail});
    
    if (unsubscribeMessages) unsubscribeMessages();

    currentRoomId = roomId;
    currentRoomOwner = ownerEmail;

    // تحديث واجهة الدردشة
    document.getElementById('chatTitle').textContent = name;
    
    const codeDisplay = document.getElementById('roomCodeDisplay');
    codeDisplay.innerHTML = `<i class="fas fa-copy"></i> <span>${code}</span>`;
    codeDisplay.onclick = () => copyCode(code);

    const delBtn = document.getElementById('deleteRoomBtn');
    if (ownerEmail === currentUser.email) {
        delBtn.style.display = 'block';
        delBtn.onclick = () => deleteRoom(roomId);
    } else {
        delBtn.style.display = 'none';
    }

    showScreen('chat');
    loadMessages(roomId);
}

// دالة الخروج من الدردشة
function leaveChat() {
    if (unsubscribeMessages) unsubscribeMessages();
    showScreen('main');
}

// دالة حذف الغرفة
async function deleteRoom(roomId) {
    if (!confirm('⚠️ هل أنت متأكد من حذف المساحة نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    try {
        // حذف الرسائل أولاً
        const messagesRef = db.collection('rooms').doc(roomId).collection('messages');
        const messagesSnapshot = await messagesRef.get();
        
        if (!messagesSnapshot.empty) {
            const batch = db.batch();
            messagesSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        // حذف الغرفة
        await db.collection('rooms').doc(roomId).delete();

        showToast('✅ تم حذف المساحة');
        
        // إعادة تحميل الغرف
        await loadRoomsDirect();
        
        showScreen('main');
        
    } catch (error) {
        showToast('❌ خطأ في الحذف: ' + error.message);
        console.error('❌ خطأ في الحذف:', error);
    }
}

// دالة نسخ الكود
function copyCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showToast('📋 تم نسخ الكود');
    }).catch(() => {
        showToast('❌ فشل النسخ');
    });
}

// ================== نظام الرسائل ==================
function loadMessages(roomId) {
    if (!roomId) return;

    const box = document.getElementById('messagesBox');
    box.innerHTML = '<div class="loader">جاري تحميل المحادثة...</div>';

    unsubscribeMessages = db.collection('rooms').doc(roomId)
        .collection('messages')
        .orderBy('time')
        .onSnapshot(snapshot => {
            box.innerHTML = '';
            
            if (snapshot.empty) {
                box.innerHTML = '<div class="loader" style="padding: 20px;">لا توجد رسائل بعد... اكتب أول رسالة</div>';
                return;
            }
            
            snapshot.forEach(doc => {
                const msg = doc.data();
                addMessageToBox(doc.id, msg);
            });
            
            box.scrollTop = box.scrollHeight;
        }, error => {
            console.error('❌ خطأ في تحميل الرسائل:', error);
            box.innerHTML = '<div class="loader" style="color: red;">خطأ في تحميل المحادثة</div>';
        });
}

function addMessageToBox(msgId, msgData) {
    const box = document.getElementById('messagesBox');
    const isMe = msgData.sender === currentUser.email;

    let timeStr = '';
    if (msgData.time) {
        try {
            const date = msgData.time.toDate();
            timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            timeStr = '';
        }
    }

    const msgDiv = document.createElement('div');
    msgDiv.className = `msg ${isMe ? 'sent' : 'received'}`;
    
    let statusHtml = '';
    if (isMe) {
        statusHtml = `<span class="status-seen">${msgData.seen ? '✔️✔️' : '✔️'}</span>`;
    }

    msgDiv.innerHTML = `
        <div>${msgData.text}</div>
        <div class="msg-info">
            <span>${timeStr}</span>
            ${statusHtml}
        </div>
    `;

    box.appendChild(msgDiv);

    // تحديث حالة المشاهدة
    if (!isMe && !msgData.seen) {
        db.collection('rooms').doc(currentRoomId).collection('messages').doc(msgId).update({ seen: true });
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
    }).catch(error => {
        console.error('❌ خطأ في الإرسال:', error);
        showToast('❌ فشل الإرسال');
    });
}

// ================== دوال التشخيص ==================
async function debugAllRooms() {
    console.log('%c🔍 تشخيص جميع الغرف', 'font-size: 16px; color: blue;');
    
    try {
        const snapshot = await db.collection('rooms').get();
        console.log(`📊 عدد الغرف: ${snapshot.size}`);
        
        snapshot.forEach(doc => {
            const data = doc.data();
            console.log(`📁 ${doc.id}:`, {
                name: data.name,
                code: data.code,
                owner: data.owner,
                members: data.members || [],
                membersCount: data.members?.length || 0
            });
        });

        if (currentUser) {
            console.log(`\n👤 المستخدم الحالي: ${currentUser.email}`);
            
            const userRooms = await db.collection('rooms')
                .where('members', 'array-contains', currentUser.email)
                .get();
            
            console.log(`✅ غرف المستخدم: ${userRooms.size}`);
        }
        
    } catch (error) {
        console.error('❌ خطأ:', error);
    }
}

async function fixRooms() {
    if (!currentUser) {
        showToast('❌ سجل دخول أولاً');
        return;
    }

    try {
        const snapshot = await db.collection('rooms').get();
        let fixed = 0;
        
        const batch = db.batch();
        
        snapshot.forEach(doc => {
            const data = doc.data();
            const updates = {};
            
            // إصلاح owner
            if (data.owner && !data.owner.includes('@')) {
                updates.owner = currentUser.email;
                fixed++;
            }
            
            // إصلاح members
            if (data.members && Array.isArray(data.members)) {
                const newMembers = data.members.map(m => 
                    m.includes('@') ? m : currentUser.email
                );
                if (JSON.stringify(data.members) !== JSON.stringify(newMembers)) {
                    updates.members = newMembers;
                    fixed++;
                }
            }
            
            if (Object.keys(updates).length > 0) {
                batch.update(doc.ref, updates);
            }
        });
        
        if (fixed > 0) {
            await batch.commit();
            showToast(`✅ تم إصلاح ${fixed} غرفة`);
            await loadRoomsDirect();
        } else {
            showToast('✅ جميع الغرف سليمة');
        }
        
    } catch (error) {
        showToast('❌ خطأ: ' + error.message);
    }
}

async function showMyRooms() {
    if (!currentUser) {
        showToast('❌ سجل دخول أولاً');
        return;
    }
    
    const snapshot = await db.collection('rooms')
        .where('members', 'array-contains', currentUser.email)
        .get();
    
    console.log(`👤 غرف ${currentUser.email}:`);
    snapshot.forEach(doc => {
        const data = doc.data();
        console.log(`   - ${data.name} (${data.code})`);
    });
    
    showToast(`✅ لديك ${snapshot.size} غرفة`);
}

// ================== تصدير الدوال ==================
window.signIn = signIn;
window.signUp = signUp;
window.logout = logout;
window.createRoom = createRoom;
window.joinRoom = joinRoom;
window.leaveChat = leaveChat;
window.openChat = openChat;
window.sendMsg = sendMsg;
window.copyCode = copyCode;
window.debugAllRooms = debugAllRooms;
window.fixRooms = fixRooms;
window.showMyRooms = showMyRooms;
window.loadRoomsDirect = loadRoomsDirect;
