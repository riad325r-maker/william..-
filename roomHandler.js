// roomHandler.js - ملف منفصل لإدارة الغرف والكودات
// ضع هذا الملف في نفس مجلد ملف HTML

class RoomHandler {
    constructor(db, currentUser) {
        this.db = db;
        this.currentUser = currentUser;
    }

    // إنشاء غرفة جديدة مع التحقق من الكود
    async createRoom(roomName, roomCode) {
        try {
            // تنظيف الكود
            roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
            
            // التحقق من صحة المدخلات
            if (!roomName || !roomCode) {
                return { success: false, message: 'أدخل اسم المساحة والكود' };
            }
            
            if (roomCode.length < 3) {
                return { success: false, message: 'الكود يجب أن يكون 3 أحرف على الأقل' };
            }

            // التحقق من عدم تكرار الكود في قاعدة البيانات
            const existingRooms = await this.db.collection('rooms')
                .where('code', '==', roomCode)
                .get();

            if (!existingRooms.empty) {
                return { success: false, message: 'هذا الكود مستخدم بالفعل، اختر كوداً آخر' };
            }

            // إنشاء الغرفة
            await this.db.collection('rooms').add({
                name: roomName,
                code: roomCode,
                owner: this.currentUser.uid,
                members: [this.currentUser.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { success: true, message: 'تم إنشاء المساحة بنجاح', code: roomCode };
            
        } catch (error) {
            return { success: false, message: 'خطأ في الإنشاء: ' + error.message };
        }
    }

    // الانضمام إلى غرفة بالكود
    async joinRoom(roomCode) {
        try {
            roomCode = roomCode.trim().toUpperCase().replace(/\s+/g, '');
            
            if (!roomCode) {
                return { success: false, message: 'أدخل الكود' };
            }

            // البحث عن الغرفة بالكود
            const snapshot = await this.db.collection('rooms')
                .where('code', '==', roomCode)
                .get();

            if (snapshot.empty) {
                // للتصحيح: عرض جميع الغرف الموجودة (مؤقتاً)
                await this.debugShowAllRooms();
                return { success: false, message: 'الكود غير صحيح - تأكد من كتابته بشكل صحيح' };
            }

            const roomDoc = snapshot.docs[0];
            const roomData = roomDoc.data();

            // التحقق من العضوية
            if (roomData.members && roomData.members.includes(this.currentUser.uid)) {
                return { 
                    success: true, 
                    message: 'أنت بالفعل عضو في هذه المساحة',
                    roomId: roomDoc.id,
                    roomData: roomData,
                    alreadyMember: true
                };
            }

            // إضافة العضو الجديد
            await roomDoc.ref.update({
                members: firebase.firestore.FieldValue.arrayUnion(this.currentUser.uid),
                lastActivity: firebase.firestore.FieldValue.serverTimestamp()
            });

            return { 
                success: true, 
                message: 'تم الانضمام إلى المساحة',
                roomId: roomDoc.id,
                roomData: roomData,
                alreadyMember: false
            };

        } catch (error) {
            return { success: false, message: 'فشل الانضمام: ' + error.message };
        }
    }

    // دالة تصحيح - تعرض جميع الغرف الموجودة (للاستخدام المؤقت)
    async debugShowAllRooms() {
        try {
            const allRooms = await this.db.collection('rooms').get();
            console.log('=== جميع الغرف الموجودة في قاعدة البيانات ===');
            allRooms.forEach(doc => {
                const data = doc.data();
                console.log(`الغرفة: ${data.name}, الكود: ${data.code}, المنشئ: ${data.owner}`);
            });
            console.log('===========================================');
        } catch (e) {
            console.log('خطأ في عرض الغرف:', e);
        }
    }

    // الحصول على غرفة محددة
    async getRoom(roomId) {
        try {
            const roomDoc = await this.db.collection('rooms').doc(roomId).get();
            if (roomDoc.exists) {
                return { success: true, data: roomDoc.data() };
            } else {
                return { success: false, message: 'الغرفة غير موجودة' };
            }
        } catch (error) {
            return { success: false, message: error.message };
        }
    }

    // حذف غرفة (للمنشئ فقط)
    async deleteRoom(roomId) {
        try {
            const roomDoc = await this.db.collection('rooms').doc(roomId).get();
            if (!roomDoc.exists) {
                return { success: false, message: 'الغرفة غير موجودة' };
            }

            const roomData = roomDoc.data();
            if (roomData.owner !== this.currentUser.uid) {
                return { success: false, message: 'أنت لست منشئ هذه الغرفة' };
            }

            // حذف جميع الرسائل أولاً
            const messagesRef = this.db.collection('rooms').doc(roomId).collection('messages');
            const messagesSnapshot = await messagesRef.get();
            const batch = this.db.batch();
            messagesSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();

            // حذف الغرفة
            await this.db.collection('rooms').doc(roomId).delete();

            return { success: true, message: 'تم حذف الغرفة' };
            
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
}

// تصدير الكلاس للاستخدام في الملف الرئيسي
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RoomHandler;
}
