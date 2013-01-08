exports.settings = {
    "status_message": "Deluge Bot",
    "client": {
        "jid": process.env.bot_email,
        "password": process.env.bot_password,
        "host": "talk.google.com",
        "port": 5222,
        "reconnect": true
    },
    "allow_auto_subscribe": false,
    "command_argument_separator": /\s*\;\s*/
};
