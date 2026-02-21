// roomHandler.js - معالج عرض الغرف

class RoomHandler {
    constructor(db, currentUser, callbacks) {
        this.db = db;
        this.currentUser = currentUser;
        this.callbacks = callbacks || {}; // { onRoomsUpdate, onError }
        this.unsubscribe = null;
    }

    // بدء الاستماع للغرف
    startListening() {
        if (!this.currentUser) return;
        if (this.unsubscribe) this.unsubscribe();

        this.unsubscribe = this.db.collection('rooms')
            .where('members', 'array-contains', this.currentUser.email)
            .orderBy('createdAt', 'desc')
            .onSnapshot(snapshot => {
                const rooms = [];
                snapshot.forEach(doc => {
                    rooms.push({
                        id: doc.id,
                        ...doc.data()
                    });
                });

                if (this.callbacks.onRoomsUpdate) {
                    this.callbacks.onRoomsUpdate(rooms);
                }
            }, error => {
                if (this.callbacks.onError) {
                    this.callbacks.onError('خطأ في تحميل الغرف: ' + error.message);
                }
            });
    }

    // إيقاف الاستماع
    stopListening() {
        if (this.unsubscribe) {
            this.unsubscribe();
            this.unsubscribe = null;
        }
    }

    // تنسيق عرض الغرفة
    formatRoomHTML(room) {
        return `
            <div class="room-item" data-room-id="${room.id}" onclick="openChat('${room.id}', '${room.name}', '${room.code}', '${room.owner}')">
                <div>
                    <strong>${room.name}</strong>
                    <small style="color: var(--text-dim); display: block;">
                        <i class="fas fa-key" style="font-size: 10px;"></i> ${room.code}
                    </small>
                </div>
                <span style="font-size: 18px;"><i class="fas fa-arrow-left"></i></span>
            </div>
        `;
    }

    // تحديث القائمة في الواجهة
    updateRoomsList(rooms, containerId = 'roomsList') {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (rooms.length === 0) {
            container.innerHTML = '<div class="loader">لا توجد مساحات بعد. أنشئ واحدة!</div>';
            return;
        }

        container.innerHTML = rooms.map(room => this.formatRoomHTML(room)).join('');
    }
}
