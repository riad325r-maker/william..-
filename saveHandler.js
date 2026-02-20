// saveHandler.js - ملف منفصل لإدارة الحفظ في Firebase

class SaveHandler {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
    }

    // حفظ غرفة جديدة
    async saveRoom(roomName, roomCode) {
        try {
            // تنظيف الكود
            roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
            
            if (!roomName || !roomCode) {
                return { success: false, message: 'أدخل اسم المساحة والكود' };
            }
            
            if (roomCode.length < 3) {
                return { success: false, message: 'الكود يجب أن يكون 3 أحرف على الأقل' };
            }

            // التحقق من الكود المكرر
            const existing = await this.db.collection('rooms')
                .where('code', '==', roomCode)
                .get();

            if (!existing.empty) {
                return { success: false, message: 'هذا الكود مستخدم بالفعل' };
            }

            // حفظ الغرفة
            const docRef = await this.db.collection('rooms').add({
                name: roomName,
                code: roomCode,
                owner: this.currentUser.uid,
                members: [this.currentUser.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { 
                success: true, 
                message: 'تم الحفظ بنجاح',
                roomId: docRef.id,
                roomData: {
                    name: roomName,
                    code: roomCode,
                    owner: this.currentUser.uid
                }
            };
            
        } catch (error) {
            return { success: false, message: 'خطأ: ' + error.message };
        }
    }

    // الانضمام لغرفة
    async joinRoom(roomCode) {
        try {
            roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
            
            const snapshot = await this.db.collection('rooms')
                .where('code', '==', roomCode)
                .get();

            if (snapshot.empty) {
                return { success: false, message: 'لا توجد غرفة بهذا الكود' };
            }

            const roomDoc = snapshot.docs[0];
            const roomData = roomDoc.data();

            if (roomData.members.includes(this.currentUser.uid)) {
                return { 
                    success: true, 
                    message: 'أنت عضو بالفعل',
                    roomId: roomDoc.id,
                    roomData: roomData
                };
            }

            await roomDoc.ref.update({
                members: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid),
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { 
                success: true, 
                message: 'تم الانضمام',
                roomId: roomDoc.id,
                roomData: roomData
            };
            
        } catch (error) {
            return { success: false, message: 'خطأ: ' + error.message };
        }
    }

    // جلب كل غرف المستخدم
    async getUserRooms() {
        try {
            const snapshot = await this.db.collection('rooms')
                .where('members', 'array-contains', this.currentUser.uid)
                .orderBy('lastUpdated', 'desc')
                .get();

            const rooms = [];
            snapshot.forEach(doc => {
                rooms.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            return { success: true, rooms: rooms };
            
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // حذف غرفة
    async deleteRoom(roomId) {
        try {
            const roomDoc = await this.db.collection('rooms').doc(roomId).get();
            
            if (!roomDoc.exists) {
                return { success: false, message: 'الغرفة غير موجودة' };
            }

            const roomData = roomDoc.data();
            
            // التحقق من أن المستخدم هو المنشئ
            if (roomData.owner !== this.currentUser.uid) {
                return { success: false, message: 'أنت لست منشئ هذه الغرفة' };
            }

            // حذف الرسائل أولاً
            const messages = await this.db.collection('rooms').doc(roomId).collection('messages').get();
            const batch = this.db.batch();
            messages.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            // حذف الغرفة
            await this.db.collection('rooms').doc(roomId).delete();

            return { success: true, message: 'تم الحذف' };
            
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // تحديث بيانات الغرفة
    async updateRoom(roomId, newData) {
        try {
            await this.db.collection('rooms').doc(roomId).update({
                ...newData,
                lastUpdated: firebase.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: 'تم التحديث' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
              }
