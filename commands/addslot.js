// const pool = require('../database/pool');

// module.exports = {
//     name: 'addslot',
//     // We pass the 'matches' array from index.js so we don't have to re-run the regex
//     async execute(message, matches) {
//         // 1. Permission Check
//         if (!message.member.permissions.has('Administrator')) {
//             return message.reply("🚫 You don't have permission to use this command.");
//         }

//         const datePart = matches[1];
//         const startPart = matches[2];
//         const endPart = matches[3];

//         let conn;
//         try {
//             // 2. Timezone Logic
//             const nevadaStartNeutral = new Date(`${datePart}T${startPart}:00Z`);
            
//             // Convert Nevada (PDT/PST) to UTC (Assuming +7 offset logic from your original)
//             const utcStart = new Date(nevadaStartNeutral.getTime() + (7 * 60 * 60 * 1000));
//             const utcEnd = new Date(new Date(`${datePart}T${endPart}:00Z`).getTime() + (7 * 60 * 60 * 1000));

//             // Calculate UK Display (BST/GMT +1)
//             const ukDate = new Date(utcStart.getTime() + (1 * 60 * 60 * 1000));
//             const ukTimeStr = ukDate.getUTCHours().toString().padStart(2, '0') + ":" + 
//                               ukDate.getUTCMinutes().toString().padStart(2, '0') + " BST";

//             const unixStart = Math.floor(utcStart.getTime() / 1000);

//             // 3. SQL Formatting
//             const formatSQL = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

//             // 4. Database Interaction
//             conn = await pool.getConnection();
//             await conn.query(
//                 "INSERT INTO booking_slots (start_time, end_time, uk_time_display, is_available) VALUES (?, ?, ?, TRUE)",
//                 [formatSQL(utcStart), formatSQL(utcEnd), ukTimeStr]
//             );

//             // 5. Success Response
//             message.reply(
//                 `✅ **Slot Added Successfully!**\n\n` +
//                 `🇺🇸 **Nevada:** ${startPart} PDT\n` +
//                 `🇬🇧 **UK Display:** ${ukTimeStr}\n` +
//                 `🌐 **UTC:** ${formatSQL(utcStart).split(' ')[1]}\n\n` +
//                 `📍 **Your Local Time:** <t:${unixStart}:F>`
//             );

//         } catch (err) {
//             console.error("Error in addslot command:", err);
//             message.reply("❌ SQL Error: Could not save the slot.");
//         } finally {
//             if (conn) conn.release();
//         }
//     }
// };


const { DateTime } = require('luxon');
const pool = require('../database/pool');

module.exports = {
    name: 'addslot',
    async execute(message, matches) {
        if (!message.member.permissions.has('Administrator')) return;

        const datePart = matches[1];  
        const startPart = matches[2]; 
        const endPart = matches[3];   

        try {
            // 1. Parse times in Nevada context
            const nevadaStart = DateTime.fromISO(`${datePart}T${startPart}`, { zone: 'America/Los_Angeles' });
            const nevadaEnd = DateTime.fromISO(`${datePart}T${endPart}`, { zone: 'America/Los_Angeles' });

            // 2. GUARDRAIL: Logical Validation
            if (!nevadaStart.isValid || !nevadaEnd.isValid) {
                return message.reply("❌ Invalid date or time format.");
            }

            if (nevadaEnd <= nevadaStart) {
                return message.reply("❌ Error: The **End Time** must be after the **Start Time**.");
            }

            // 3. Convert to UTC for DB operations
            const utcStart = nevadaStart.toUTC();
            const utcEnd = nevadaEnd.toUTC();
            const sqlStart = utcStart.toSQL({ includeOffset: false });
            const sqlEnd = utcEnd.toSQL({ includeOffset: false });

            let conn;
            try {
                conn = await pool.getConnection();

                // 4. GUARDRAIL: Overlap Check
                // This SQL finds any slot where: (ExistingStart < NewEnd) AND (ExistingEnd > NewStart)
                const conflicts = await conn.query(
                    `SELECT slot_id, start_time, end_time FROM booking_slots 
                     WHERE start_time < ? AND end_time > ? LIMIT 1`,
                    [sqlEnd, sqlStart]
                );

                if (conflicts.length > 0) {
                    const conflict = conflicts[0];
                    // Since dateStrings: true is on, conflict.start_time is a string
                    const conflictStart = DateTime.fromSQL(conflict.start_time, { zone: 'utc' });
                    const unixConflict = Math.floor(conflictStart.toSeconds());

                    return message.reply(
                        `🚫 **Scheduling Conflict!**\n` +
                        `This time overlaps with **Slot #${conflict.slot_id}**, which starts at <t:${unixConflict}:t>.\n` +
                        `Please choose a different time.`
                    );
                }

                // 5. Success Logic: If we passed the guardrails, insert the slot
                const ukTimeStr = utcStart.setZone('Europe/London').toFormat('HH:mm ZZZZ');
                const unixStart = Math.floor(utcStart.toSeconds());

                await conn.query(
                    "INSERT INTO booking_slots (start_time, end_time, uk_time_display, is_available) VALUES (?, ?, ?, TRUE)",
                    [sqlStart, sqlEnd, ukTimeStr]
                );

                message.reply(
                    `✅ **Slot #${datePart} Added!**\n` +
                    `🇺🇸 **Nevada:** ${startPart} (${nevadaStart.offsetNameShort})\n` +
                    `🇬🇧 **UK Display:** ${ukTimeStr}\n` +
                    `📍 **Local Preview:** <t:${unixStart}:F>`
                );

            } finally {
                if (conn) conn.release();
            }

        } catch (err) {
            console.error(err);
            message.reply("❌ System error while validating the slot.");
        }
    }
};