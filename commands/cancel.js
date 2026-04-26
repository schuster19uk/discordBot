const pool = require('../database/pool');

module.exports = {
    name: 'cancel',
    async execute(message, slotId) {
        let conn;
        try {
            conn = await pool.getConnection();

            // 1. Check if the slot exists and who booked it
            const [slot] = await conn.query(
                "SELECT booked_by_id FROM booking_slots WHERE slot_id = ?",
                [slotId]
            );

            if (!slot) {
                return message.reply("❌ That Slot ID does not exist.");
            }

            // 2. Security Check: Only the person who booked it (or an Admin) can cancel
            const isOwner = slot.booked_by_id === message.author.id;
            const isAdmin = message.member.permissions.has('Administrator');

            if (!isOwner && !isAdmin) {
                return message.reply("🚫 You can only cancel your own bookings.");
            }

            // 3. Update the database to make it available again
            // We reset everything: booked_by, is_available, and reminder_sent
            const result = await conn.query(
                `UPDATE booking_slots 
                 SET booked_by_id = NULL, 
                     booked_by_name = NULL, 
                     is_available = TRUE, 
                     reminder_sent = FALSE 
                 WHERE slot_id = ?`,
                [slotId]
            );

            if (result.affectedRows > 0) {
                message.reply(`✅ **Cancelled!** Slot #${slotId} is now available for others to book.`);
            } else {
                message.reply("❌ Something went wrong. The slot might already be cancelled.");
            }

        } catch (err) {
            console.error("Error in cancel command:", err);
            message.reply("❌ Database error during cancellation.");
        } finally {
            if (conn) conn.release();
        }
    }
};