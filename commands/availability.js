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
                 LIMIT 20`
            );

            if (rows.length === 0) return message.reply("📅 No available slots found.");

            let list = "━━━━━━━━━━━━━━━━━━━━━━━━\n";
            list += "📅 **APPOINTMENTS AVAILABLE**\n";
            list += "━━━━━━━━━━━━━━━━━━━━━━━━\n";
            list += "✅ **To Book:** Type e.g. `!book1` on the chat window to claim the lesson. \n";
            list += "━━━━━━━━━━━━━━━━━━━━━━━━\n";

            // rows.forEach(row => {
            //     const start = DateTime.fromSQL(row.start_time, { zone: 'utc' });
            //     if (!start.isValid) return;

            //     // 1. Get the Date in Nevada for Grouping
            //     const nvDate = start.setZone('America/Los_Angeles');
            //     const nvDateLabel = nvDate.toFormat('cccc, LLLL dd'); // e.g. "Monday, April 27"

            //     // 2. Get the Unix for User Display
            //     const sUnix = Math.floor(start.toSeconds());

            //     // 3. Print Header ONLY if the Nevada Date changes
            //     if (nvDateLabel !== lastDateLabel) {
            //         list += `\n**${nvDateLabel.toUpperCase()}**\n`;
            //         list += `──────────────────\n`;
            //         lastDateLabel = nvDateLabel;
            //     }

            //     // 4. Compact Row
            //     //list += `> **ID: #${row.slot_id}** 🔹 <t:${sUnix}:t> 🎲 \`${row.nevada_time_display}\` 📝 \`!book ${row.slot_id}\`\n`;
            //     list += `> 🔹 **Your Local Time:** <t:${sUnix}:t>  Book: \`!book${row.slot_id}\`\n`;
            // });
            
            
            let lastDateLabel = ""; 

            rows.forEach(row => {
                // 1. Convert SQL UTC string to a Luxon object
                const start = DateTime.fromSQL(row.start_time, { zone: 'utc' });
                if (!start.isValid) return;

                // 2. Get the absolute Unix seconds (the same everywhere in the world)
                const sUnix = Math.floor(start.toSeconds());

                // 3. Generate a 'Date Key' based on the user's local day
                // We use <t:sUnix:d> which is the short date format (e.g., 04/05/2026).
                // This serves as our "Day Change" detector.
                const dateKey = new Date(sUnix * 1000).toLocaleDateString('en-GB'); 

                // 4. Print Header ONLY if the date flips for the viewer
                if (dateKey !== lastDateLabel) {
                    // <t:sUnix:A> = Full Day Name (Monday)
                    // <t:sUnix:D> = Full Date (04 May 2026)
                    list += `\n** <t:${sUnix}:A>, <t:${sUnix}:D> **\n`;
                    list += `──────────────────\n`;
                    lastDateLabel = dateKey;
                }

                // 5. The Dynamic Row
                // <t:sUnix:t> shows ONLY the time (e.g., 20:00 or 8:00 PM) based on user settings
                list += `> 🔹 **Local:** <t:${sUnix}:t> | **ID:** \`#${row.slot_id}\` | \`/book id:${row.slot_id}\`\n`;
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