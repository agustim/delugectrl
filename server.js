
const config = require('./config.js').settings;
const sys = require('sys');
const exec = require('child_process').exec;
const child;


execute_bot();

function execute_bot() {
    const xmpp = require('node-xmpp');
    const util = require('util');
    const request_helper = require('request');

    const conn = new xmpp.Client(config.client);
    conn.socket.setTimeout(0);
    conn.socket.setKeepAlive(true, 10000);

    var commands = {};

    function request_google_roster() {
        var roster_elem = new xmpp.Element('iq', { from: conn.jid, type: 'get', id: 'google-roster'})
                        .c('query', { xmlns: 'jabber:iq:roster', 'xmlns:gr': 'google:roster', 'gr:ext': '2' });
        conn.send(roster_elem);
    }

    function accept_subscription_requests(stanza) {
        if(stanza.is('presence') 
           && stanza.attrs.type === 'subscribe') {
            var subscribe_elem = new xmpp.Element('presence', {
                to: stanza.attrs.from,
                type: 'subscribed'
            });
            conn.send(subscribe_elem);
           send_help_information(stanza.attrs.from);
        }
    }

    function set_status_message(status_message) {
        var presence_elem = new xmpp.Element('presence', { })
                                .c('show').t('chat').up()
                                .c('status').t(status_message);
        conn.send(presence_elem);
    }

    function send_xmpp_ping() {
        var elem = new xmpp.Element('iq', { from: conn.jid, type: 'get', id: 'c2s1' })
                 .c('ping', { 'xmlns': 'urn:xmpp:ping' });
        conn.send(elem);
    }

    function send_message(to_jid, message_body) {
        var elem = new xmpp.Element('message', { to: to_jid, type: 'chat' })
                 .c('body').t(message_body);
        conn.send(elem);
        util.log('[message] SENT: ' + elem.up().toString());
    }

    function send_unknown_command_message(request) {
        send_message(request.stanza.attrs.from, 'Unknown command: "' + request.command + '". Type "help" for more information.');
    }

    function send_help_information(to_jid) {
        var message_body = "Control deluge with gtalk:\n";
        message_body += "a;magetic o url from torrent - add torrent\n";
        message_body += "i; - information torrent\n";
        message_body += "s; - status deluge\n";
	message_body += "r;torrent_id - remove torrent\n";
	message_body += "p;torrent_id - pause torrent\n";
	message_body += "e;torrent_id - resuem torrent\n";
        message_body += "\nSee not-site-yet for more information.\n";
        send_message(to_jid, message_body);
    }

    function split_request(stanza) {
        var message_body = stanza.getChildText('body');
        if(null !== message_body) {
            message_body = message_body.split(config.command_argument_separator);
            var command = message_body[0].trim().toLowerCase();
            if(typeof message_body[1] !== "undefined") {
                return { "command" : command,
                         "argument": message_body[1].trim(),
                         "stanza"  : stanza };
            } else {
                send_help_information(stanza.attrs.from);
            }
        }
        return false;
    }

    function message_dispatcher(stanza) {
        if('error' === stanza.attrs.type) {
            util.log('[error] ' + stanza.toString());
        } else if(stanza.is('message')) {
            var request = split_request(stanza);
            if(request) {
                if(!execute_command(request)) {
                    send_unknown_command_message(request);
                }
            }
        }
    }

    function add_command(command, callback) {
        commands[command] = callback;
    }

    function execute_command(request) {
        if(typeof commands[request.command] === "function") {
            return commands[request.command](request);
        }
        return false;
    }

    add_command('s', function(request) {
	child = exec("ps -fuax|grep ^deluge", function (error, stdout, stderr) {
	       	send_message(request.stanza.attrs.from, stdout);
        	});
        return true;
    });

    add_command('i', function(request) {
	child = exec("deluge-console info", function (error, stdout, stderr){
		send_message(request.stanza.attrs.from, stdout);
		});
        return true;
    });

    add_command('a', function(request) {
	child = exec("deluge-console add '"+request.argument.replace("'","")+"'", function (error, stdout, stderr){
		send_message(request.stanza.attrs.from, stdout);
		});
        return true;
    });
    
    add_command('r', function(request) {
	var strCmd = "deluge-console rm '"+request.argument.replace("'","")+"'";
        util.log(strCmd);	
	child = exec(strCmd, function (error, stdout, stderr){
		send_message(request.stanza.attrs.from, stdout);
		});
        return true;
    });

    add_command('p', function(request) {
	child = exec("deluge-console pause '"+request.argument.replace("'","")+"'", function (error, stdout, stderr){
		send_message(request.stanza.attrs.from, stdout);
		});
        return true;
    });

    add_command('e', function(request) {
	child = exec("deluge-console resume '"+request.argument.replace("'","")+"'", function (error, stdout, stderr){
		send_message(request.stanza.attrs.from, stdout);
		});
        return true;
    });

    if(config.allow_auto_subscribe) {
        conn.addListener('online', request_google_roster);
        conn.addListener('stanza', accept_subscription_requests);
    }

    conn.addListener('stanza', message_dispatcher);

    conn.on('online', function() {
        set_status_message(config.status_message);

        setInterval(function() {
            conn.send(' ');
        }, 30000);
    });

    conn.on('error', function(stanza) {
        util.log('[error] ' + stanza.toString());
    });
}
