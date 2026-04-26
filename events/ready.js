// events/ready.js
const { checkReminders } = require('../tasks/reminderSystem');

module.exports = {
    name: 'ready',
    once: true,
    execute(client) {
        console.log(`🚀 Logged in as ${client.user.tag}`);
        
        // Start the background task
        setInterval(() => {
            checkReminders(client);
        }, 60000);
    },
};