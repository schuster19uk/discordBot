const { DateTime } = require('luxon');
const pool = require('../database/pool');

module.exports = {
    name: '!al',
    async execute(message) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            // Added nevada_time_display to the SELECT
            const rows = await conn.query(
                `SELECT slot_id, start_time, end_time, nevada_time_display 
                 FROM booking_slots 
                 WHERE is_available = TRUE 
                 AND start_time >= NOW() + INTERVAL 24 HOUR 
                 ORDER BY start_time ASC
                 LIMIT 10`
            );

            if (rows.length === 0) return message.reply("📅 No available slots.");

            let list = "**Available Booking Slots:**\n*The first time is your local time, the second is Nevada time.*\n\n";
            
            rows.forEach(row => {
                const start = DateTime.fromSQL(row.start_time, { zone: 'utc' });
                const end = DateTime.fromSQL(row.end_time, { zone: 'utc' });

                if (!start.isValid || !end.isValid) return; 

                const sUnix = Math.floor(start.toSeconds());
                const eUnix = Math.floor(end.toSeconds());

                // We add the nevada_time_display column at the end of the line
                list += `**Slot #${row.slot_id}**\n` +
                        `Book: \`!book ${row.slot_id}\`\n` +
                        `Your Start DateTime: <t:${sUnix}:F> (<t:${eUnix}:t>)\n` +
                        `Nevada Start: **${row.nevada_time_display}**\n\n`;
            }); 

            message.channel.send(list);

        } catch (err) {
            console.error(err);
            message.reply("❌ Error fetching availability.");
        } finally {
            if (conn) conn.release();
        }
    }
};