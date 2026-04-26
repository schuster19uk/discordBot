require('dotenv').config();
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const mariadb = require('mariadb');

/**
 * 1. DATABASE CONFIGURATION
 */
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    timezone: 'Z', // Forces UTC to prevent timezone offset bugs
    connectionLimit: 10
});

/**
 * 2. BOT CONFIGURATION
 */
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers // Required to check roles
    ]
});

const REQUIRED_ROLE_ID = process.env.REQUIRED_ROLE_ID;

client.once('ready', () => {
    console.log(`🚀 Logged in as ${client.user.tag}`);
    // Start the reminder loop
    setInterval(checkReminders, 60000);
});

/**
 * 3. COMMAND HANDLER
 */
client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- !bookingavailability ---
    if (message.content === '!bookingavailability') {
        let conn;
        try {
            conn = await pool.getConnection();
            const rows = await conn.query(
                "SELECT slot_id, start_time, end_time FROM booking_slots WHERE is_available = TRUE ORDER BY start_time ASC"
            );

            if (rows.length === 0) return message.reply("📅 No available slots right now.");

            let list = "**Available Booking Slots:**\n*All times are shown in your local timezone.*\n\n";
            rows.forEach(row => {

                const startTimeStr = new Date(row.start_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';
                const endTimeStr = new Date(row.end_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';

                const sDate = new Date(startTimeStr);
                const eDate = new Date(endTimeStr);

                const sUnix = Math.floor(sDate.getTime() / 1000);
                const eUnix = Math.floor(eDate.getTime() / 1000);

                list += `\`!book${row.slot_id}\` — <t:${sUnix}:t> to <t:${eUnix}:t> (<t:${sUnix}:d>)\n`;
            });

            message.channel.send(list);
        } catch (err) {
            console.error(err);
        } finally {
            if (conn) conn.release();
        }
    }

    const bookMatch = message.content.match(/^!book(\d+)$/);
    if (bookMatch) {
        const slotId = bookMatch[1];

        if (!message.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return message.reply("🚫 You do not have the required role to book slots.");
        }

        let conn;
        try {
            conn = await pool.getConnection();
            const result = await conn.query(
                `UPDATE booking_slots 
                 SET booked_by_id = ?, booked_by_name = ?, is_available = FALSE 
                 WHERE slot_id = ? AND is_available = TRUE`,
                [message.author.id, message.author.username, slotId]
            );

            if (result.affectedRows > 0) {
                const [details] = await conn.query("SELECT start_time FROM booking_slots WHERE slot_id = ?", [slotId]);
                const rawStart = new Date(details.start_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';
                const unix = Math.floor(new Date(rawStart).getTime() / 1000);

                const embed = new EmbedBuilder()
                    .setTitle("✅ Booking Confirmed")
                    .setColor(0x57F287)
                    .addFields(
                        { name: "Slot ID", value: `#${slotId}`, inline: true },
                        { name: "Time", value: `<t:${unix}:F>`, inline: true }
                    )
                    .setFooter({ text: "A DM reminder will be sent 15 mins prior." });

                message.reply({ embeds: [embed] });
            } else {
                message.reply("❌ That slot is either invalid or already taken.");
            }
        } catch (err) {
            console.error(err);
        } finally {
            if (conn) conn.release();
        }
    }

    const addMatch = message.content.match(/^!addslot (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (\d{2}:\d{2})$/);

    if (addMatch) {
        if (!message.member.permissions.has('Administrator')) return;

        const datePart = addMatch[1];
        const startPart = addMatch[2];
        const endPart = addMatch[3];

        const nevadaStartNeutral = new Date(`${datePart}T${startPart}:00Z`);

        const utcStart = new Date(nevadaStartNeutral.getTime() + (7 * 60 * 60 * 1000));
        const utcEnd = new Date(new Date(`${datePart}T${endPart}:00Z`).getTime() + (7 * 60 * 60 * 1000));

        const ukDate = new Date(utcStart.getTime() + (1 * 60 * 60 * 1000));
        const ukTimeStr = ukDate.getUTCHours().toString().padStart(2, '0') + ":" + 
                        ukDate.getUTCMinutes().toString().padStart(2, '0') + " BST";

        // 5. Get the Unix Timestamp for Discord (This is the "Local" time for everyone)
        const unixStart = Math.floor(utcStart.getTime() / 1000);

        // 6. Format UTC for SQL
        const formatSQL = (date) => date.toISOString().slice(0, 19).replace('T', ' ');

        let conn;
        try {
            conn = await pool.getConnection();
            await conn.query(
                "INSERT INTO booking_slots (start_time, end_time, uk_time_display, is_available) VALUES (?, ?, ?, TRUE)",
                [formatSQL(utcStart), formatSQL(utcEnd), ukTimeStr]
            );

            message.reply(
                `✅ **Slot Added Successfully!**\n\n` +
                `🇺🇸 **Nevada:** ${startPart} PDT\n` +
                `🇬🇧 **UK Display:** ${ukTimeStr}\n` +
                `🌐 **UTC:** ${formatSQL(utcStart).split(' ')[1]}\n\n` +
                `📍 **Your Local Time:** <t:${unixStart}:F>`
            );
        } catch (err) {
            console.error(err);
            message.reply("❌ SQL Error.");
        } finally {
            if (conn) conn.release();
        }
    }



});

/**
 * 4. REMINDER SYSTEM
 */
async function checkReminders() {
    let conn;
    try {
        conn = await pool.getConnection();
        const upcoming = await conn.query(`
        SELECT slot_id, booked_by_id, start_time 
        FROM booking_slots 
        WHERE is_available = FALSE 
        AND reminder_sent = FALSE 
        AND start_time <= DATE_ADD(UTC_TIMESTAMP(), INTERVAL 20 MINUTE)
        AND start_time >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 5 MINUTE)
        `);

        for (const slot of upcoming) {
            try {
                const user = await client.users.fetch(slot.booked_by_id);
                const rawStart = new Date(slot.start_time).toLocaleString('sv-SE').replace(' ', 'T') + 'Z';
                const unix = Math.floor(new Date(rawStart).getTime() / 1000);
                
                //await user.send(`🔔 **Reminder:** Your booking #${slot.slot_id} starts at <t:${unix}:t>!`);
                await user.send(`🔔 **Reminder:** Your booking #${slot.slot_id} starts at <t:${unix}:t> (<t:${unix}:R>)!`);
                await conn.query("UPDATE booking_slots SET reminder_sent = TRUE WHERE slot_id = ?", [slot.slot_id]);
            } catch (dmErr) {
                console.log(`Could not DM user ${slot.booked_by_id}`);
            }
        }
    } catch (err) {
        console.error("Reminder Loop Error:", err);
    } finally {
        if (conn) conn.release();
    }
}

client.login(process.env.DISCORD_TOKEN);