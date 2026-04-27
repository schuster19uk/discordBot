// const { DateTime } = require('luxon');
// const pool = require('../database/pool');

// module.exports = {
//     name: '!al',
//     async execute(message) {
//         let conn;
//         try {
//             conn = await pool.getConnection();
            
//             const rows = await conn.query(
//                 `SELECT slot_id, start_time, end_time, nevada_time_display 
//                  FROM booking_slots 
//                  WHERE is_available = TRUE 
//                  AND start_time >= NOW() + INTERVAL 24 HOUR 
//                  ORDER BY start_time ASC
//                  LIMIT 5`
//             );

//             if (rows.length === 0) return message.reply("📅 No available slots found for the next 30 days.");

//             // --- HEADER & INSTRUCTIONS ---
//             let list = "━━━━━━━━━━━━━━━━━━━━━━━━\n";
//             list += "📅 **AVAILABLE BOOKING SLOTS**\n";
//             list += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
//             list += "✅ **How to Book:**\n";
//             list += "Type the command in the Claim to book a slot\n";
//             list += "*Example: `!book1`*\n";
//             list += "━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

//             rows.forEach(row => {
//                 const start = DateTime.fromSQL(row.start_time, { zone: 'utc' });
//                 const end = DateTime.fromSQL(row.end_time, { zone: 'utc' });

//                 if (!start.isValid || !end.isValid) return; 

//                 const sUnix = Math.floor(start.toSeconds());
//                 const eUnix = Math.floor(end.toSeconds());

//                 //list += `### 🔹 Slot ID (Your Local Time): #${row.slot_id} <t:${sUnix}:F> \n`;
//                 list += `### 🕒 <t:${sUnix}:F> (in your Local Time) \n`;
//                 //list += `> 🕒 **Your Local Time:** <t:${sUnix}:F>\n`;
//                 list += `> 🎲 **Lesage's Time:** \`${row.nevada_time_display}\`\n`;
//                 list += `> 📝 **Claim:** \`!book${row.slot_id}\`\n`;
//                 list += `──────────────────\n\n`;
//             }); 

//             message.channel.send(list);

//         } catch (err) {
//             console.error(err);
//             message.reply("❌ Error fetching availability.");
//         } finally {
//             if (conn) conn.release();
//         }
//     }
// };


const { DateTime } = require('luxon');
const pool = require('../database/pool');

module.exports = {
    name: '!al',
    async execute(message) {
        let conn;
        try {
            conn = await pool.getConnection();
            
            const rows = await conn.query(
                `SELECT slot_id, start_time, end_time, nevada_time_display 
                 FROM booking_slots 
                 WHERE is_available = TRUE 
                 AND start_time >= NOW() + INTERVAL 24 HOUR 
                 ORDER BY start_time ASC
                 LIMIT 15` // Increased limit since the layout is more compact
            );

            if (rows.length === 0) return message.reply("📅 No available slots found.");

            let list = "━━━━━━━━━━━━━━━━━━━━━━━━\n";
            list += "📅 **APPOINTMENT CALENDAR**\n";
            list += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
            list += "✅ **To Book:** Type `!book [ID]`\n";
            list += "━━━━━━━━━━━━━━━━━━━━━━━━\n";

            let lastDate = "";

            rows.forEach(row => {
                const start = DateTime.fromSQL(row.start_time, { zone: 'utc' });
                if (!start.isValid) return;

                const sUnix = Math.floor(start.toSeconds());
                
                // Discord Date-Only format: e.g., "May 4, 2026"
                // We use this to check if we should print a new date header
                const discordDateHeader = `<t:${sUnix}:d>`; 
                const discordDayName = `<t:${sUnix}:A>`; // e.g., "Monday"

                if (discordDateHeader !== lastDate) {
                    list += `\n**${discordDayName} — ${discordDateHeader}**\n`;
                    list += `──────────────────\n`;
                    lastDate = discordDateHeader;
                }

                // Compact Slot Row
                // Format: [ID] Time (NV Time) !book ID
                list += `> **ID: #${row.slot_id}** 🔹 <t:${sUnix}:t> 🎲 \`${row.nevada_time_display}\` 📝 \`!book ${row.slot_id}\`\n`;
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