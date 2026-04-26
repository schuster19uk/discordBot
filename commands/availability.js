// const pool = require('../database/pool');

// module.exports = {
//     name: '!bookingavailability',
//     async execute(message) {
//         let conn;
//         try {
//             conn = await pool.getConnection();
            
//             // 1. Fetch available slots ordered by time
//             const rows = await conn.query(
//                 "SELECT slot_id, start_time, end_time FROM booking_slots WHERE is_available = TRUE ORDER BY start_time ASC"
//             );

//             // 2. Handle empty results
//             if (rows.length === 0) {
//                 return message.reply("📅 No available slots right now.");
//             }

//             // 3. Build the list
//             let list = "**Available Booking Slots:**\n*All times are shown in your local timezone.*\n\n";
            
//             rows.forEach(row => {
//                 // Formatting logic from your original script to ensure UTC handling
//                 const startTimeStr = new Date(row.start_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';
//                 const endTimeStr = new Date(row.end_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';

//                 const sDate = new Date(startTimeStr);
//                 const eDate = new Date(endTimeStr);

//                 const sUnix = Math.floor(sDate.getTime() / 1000);
//                 const eUnix = Math.floor(eDate.getTime() / 1000);

//                 // Construct the command string and Discord timestamps
//                 list += `\`!book${row.slot_id}\` — <t:${sUnix}:t> to <t:${eUnix}:t> (<t:${sUnix}:d>)\n`;
//             });

//             // 4. Send the final message
//             message.channel.send(list);

//         } catch (err) {
//             console.error("Error in availability command:", err);
//             message.reply("❌ There was an error fetching the availability.");
//         } finally {
//             if (conn) conn.release();
//         }
//     }
// };


const { DateTime } = require('luxon');
const pool = require('../database/pool');

module.exports = {
    name: '!bookingavailability',
    async execute(message) {
        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query(
                "SELECT slot_id, start_time, end_time FROM booking_slots WHERE is_available = TRUE ORDER BY start_time ASC"
            );

            if (rows.length === 0) return message.reply("📅 No available slots.");

            let list = "**Available Booking Slots:**\n*The times below will automatically adjust to your phone/computer's timezone.*\n\n";
            
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

                list += `**Slot #${row.slot_id}**\n` +
                        `Book: \`!book${row.slot_id}\`\n` +
                        `Time: <t:${sUnix}:t> to <t:${eUnix}:t> (<t:${sUnix}:d>)\n\n`;
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