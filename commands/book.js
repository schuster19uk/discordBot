// const { EmbedBuilder } = require('discord.js');
// const pool = require('../database/pool');

// module.exports = {
//     name: 'book', // This matches the call in messageCreate.js
//     async execute(message, slotId) {
//         // 1. Role Check
//         const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;
//         if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
//             return message.reply("🚫 You do not have the required role to book slots.");
//         }

//         let conn;
//         try {
//             conn = await pool.getConnection();

//             // 2. Attempt to Update the slot
//             // We ensure is_available is TRUE to prevent double-booking
//             const result = await conn.query(
//                 `UPDATE booking_slots 
//                  SET booked_by_id = ?, booked_by_name = ?, is_available = FALSE 
//                  WHERE slot_id = ? AND is_available = TRUE`,
//                 [message.author.id, message.author.username, slotId]
//             );

//             // 3. Check if the update actually happened
//             if (result.affectedRows > 0) {
//                 // Fetch the start_time to show in the confirmation embed
//                 const [details] = await conn.query(
//                     "SELECT start_time FROM booking_slots WHERE slot_id = ?", 
//                     [slotId]
//                 );

//                 // Format the Unix timestamp for Discord
//                 const rawStart = new Date(details.start_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';
//                 const unix = Math.floor(new Date(rawStart).getTime() / 1000);

//                 // 4. Create the Confirmation Embed
//                 const embed = new EmbedBuilder()
//                     .setTitle("✅ Booking Confirmed")
//                     .setColor(0x57F287)
//                     .addFields(
//                         { name: "Slot ID", value: `#${slotId}`, inline: true },
//                         { name: "Time", value: `<t:${unix}:F>`, inline: true }
//                     )
//                     .setFooter({ text: "A DM reminder will be sent 15 mins prior." });

//                 message.reply({ embeds: [embed] });
//             } else {
//                 // If affectedRows is 0, the ID was wrong or someone else beat them to it
//                 message.reply("❌ That slot is either invalid or already taken.");
//             }
//         } catch (err) {
//             console.error("Error in book command:", err);
//             message.reply("❌ There was a database error while processing your booking.");
//         } finally {
//             if (conn) conn.release();
//         }
//     }
// };

const { EmbedBuilder } = require('discord.js');
const { DateTime } = require('luxon');
const pool = require('../database/pool');

module.exports = {
    name: 'book', 
    async execute(message, slotId) {
        // 1. Role Check
        const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;
        if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return message.reply("🚫 You do not have the required role to book slots.");
        }

        let conn;
        try {
            conn = await pool.getConnection();

            // 2. Attempt Atomic Update
            const result = await conn.query(
                `UPDATE booking_slots 
                 SET booked_by_id = ?, booked_by_name = ?, is_available = FALSE 
                 WHERE slot_id = ? AND is_available = TRUE`,
                [message.author.id, message.author.username, slotId]
            );

            // 3. Check if booking was successful
            if (result.affectedRows > 0) {
                const [details] = await conn.query(
                    "SELECT start_time FROM booking_slots WHERE slot_id = ?", 
                    [slotId]
                );

                /**
                 * 4. Time Conversion
                 * With dateStrings: true, details.start_time is a string "2026-04-26 13:00:00".
                 * We use fromSQL and force the 'utc' zone to prevent any local shifting.
                 */
                const unix = Math.floor(DateTime.fromSQL(details.start_time, { zone: 'utc' }).toSeconds());

                const embed = new EmbedBuilder()
                    .setTitle("✅ Booking Confirmed")
                    .setColor(0x57F287)
                    .addFields(
                        { name: "Slot ID", value: `#${slotId}`, inline: true },
                        { name: "Time", value: `<t:${unix}:F>`, inline: true }
                    )
                    .setFooter({ text: "A DM reminder will be sent 15-20 mins prior." });

                message.reply({ embeds: [embed] });
            } else {
                message.reply("❌ That slot is either invalid or already taken.");
            }
        } catch (err) {
            console.error("Error in book command:", err);
            message.reply("❌ There was a database error while processing your booking.");
        } finally {
            if (conn) conn.release();
        }
    }
};