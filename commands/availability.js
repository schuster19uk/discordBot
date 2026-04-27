const { DateTime } = require('luxon');
const pool = require('../database/pool');

module.exports = {
    name: '!al',
    async execute(message) {
        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query(
               `SELECT slot_id, start_time, uk_time_display 
                FROM booking_slots 
                WHERE is_available = TRUE 
                AND start_time >= NOW() + INTERVAL 24 HOUR 
                ORDER BY start_time ASC;`
            );

            if (rows.length === 0) return message.reply("📅 No available slots.");

            let list = "**Available Booking Slots:**\n*The date/times below are in your local timezone.*\n\n";
            
            rows.forEach(row => {
                /**
                 * Since dateStrings: true is on, row.start_time is now a 
                 * raw string like "2026-04-26 13:00:00".
                 * We tell Luxon this string is UTC.
                 */
                const start = DateTime.fromSQL(row.start_time, { zone: 'utc' });
                const end = DateTime.fromSQL(row.end_time, { zone: 'utc' });

                const sUnix = Math.floor(start.toSeconds());
                const eUnix = Math.floor(end.toSeconds());

                //<t:${sUnix}:t> to <t:${eUnix}:t>

                list += `**Slot #${row.slot_id}**\n` +
                        `Book: \`!book${row.slot_id}\`\n` +
                        `Time: <t:${sUnix}:F> to <t:${eUnix}:t>\n\n`;
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