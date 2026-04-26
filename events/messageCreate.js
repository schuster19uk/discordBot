module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // 1. Safety Checks: Ignore bots and direct messages
        if (message.author.bot || !message.guild) return;

        // 2. Handle Exact String Commands 
        // This covers: !bookingavailability and !myslots
        const command = client.commands.get(message.content);
        if (command) {
            try {
                await command.execute(message);
            } catch (error) {
                console.error(`Error in ${command.name}:`, error);
                message.reply('❌ There was an error executing that command.');
            }
            return; 
        }

        // 3. Handle Regex Commands (Pattern Matches)

        // Pattern Match: !book123
        const bookMatch = message.content.match(/^!book(\d+)$/);
        if (bookMatch) {
            const bookCmd = client.commands.get('book');
            if (bookCmd) {
                return bookCmd.execute(message, bookMatch[1]).catch(err => {
                    console.error("Booking error:", err);
                    message.reply("❌ Error processing your booking.");
                });
            }
        }

        // Pattern Match: !cancel123
        const cancelMatch = message.content.match(/^!cancel(\d+)$/);
        if (cancelMatch) {
            const cancelCmd = client.commands.get('cancel');
            if (cancelCmd) {
                return cancelCmd.execute(message, cancelMatch[1]).catch(err => {
                    console.error("Cancellation error:", err);
                    message.reply("❌ Error processing your cancellation.");
                });
            }
        }

        // Pattern Match: !addslot 2026-04-26 14:00 15:00
        const addMatch = message.content.match(/^!addslot (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}) (\d{2}:\d{2})$/);
        if (addMatch) {
            const addCmd = client.commands.get('addslot');
            if (addCmd) {
                return addCmd.execute(message, addMatch).catch(err => {
                    console.error("Addslot error:", err);
                    message.reply("❌ Error adding the slot.");
                });
            }
        }
    },
};