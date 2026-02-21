// saveHandler.js - (احتفظ به كما هو)
class SaveHandler {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
    }

    async saveRoom(roomName, roomCode) {
        roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
        
        if (!roomName || !roomCode) {
            return { success: false, message: 'أدخل اسم المساحة والكود' };
        }
        
        if (roomCode.length < 3) {
            return { success: false, message: 'الكود يجب أن يكون 3 أحرف على الأقل' };
        }

        const existing = await this.db.collection('rooms')
            .where('code', '==', roomCode)
            .get();

        if (!existing.empty) {
            return { success: false, message: 'هذا الكود مستخدم بالفعل' };
        }

        const docRef = await this.db.collection('rooms').add({
            name: roomName,
            code: roomCode,
            owner: this.currentUser.email,
            members: [this.currentUser.email],
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        return { 
            success: true, 
            message: '✅ تم الحفظ',
            roomId: docRef.id,
            roomData: {
                name: roomName,
                code: roomCode,
                owner: this.currentUser.email
            }
        };
    }

    async joinRoom(roomCode) {
        roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
        
        const snapshot = await this.db.collection('rooms')
            .where('code', '==', roomCode)
            .get();

        if (snapshot.empty) {
            return { success: false, message: '❌ لا توجد غرفة بهذا الكود' };
        }

        const roomDoc = snapshot.docs[0];
        const roomData = roomDoc.data();

        if (roomData.members && roomData.members.includes(this.currentUser.email)) {
            return { 
                success: true, 
                message: 'أنت عضو بالفعل',
                roomId: roomDoc.id,
                roomData: roomData
            };
        }

        await roomDoc.ref.update({
            members: firebase.firestore.FieldValue.arrayUnion(this.currentUser.email)
        });

        return { 
            success: true, 
            message: '✅ تم الانضمام',
            roomId: roomDoc.id,
            roomData: roomData
        };
    }

    async deleteRoom(roomId) {
        const roomDoc = await this.db.collection('rooms').doc(roomId).get();
        
        if (!roomDoc.exists) {
            return { success: false, message: 'الغرفة غير موجودة' };
        }

        const roomData = roomDoc.data();
        
        if (roomData.owner !== this.currentUser.email) {
            return { success: false, message: 'أنت لست منشئ هذه الغرفة' };
        }

        const messages = await this.db.collection('rooms').doc(roomId).collection('messages').get();
        const batch = this.db.batch();
        messages.forEach(doc => batch.delete(doc.ref));
        await batch.commit();

        await this.db.collection('rooms').doc(roomId).delete();

        return { success: true, message: '✅ تم الحذف' };
    }
        }
