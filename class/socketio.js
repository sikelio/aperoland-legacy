const { Server } = require('socket.io');
const mysql = require('../config/mysql');

class SocketIO {
    #io;
    #users = [];

    /**
     * Initialization of socket messages
     * @param {function} server HTTP server instance
     * @returns {void}
     */
    init(server) {
        this.#io = new Server(server);
        this.#io.on('connection', (socket) => {
            socket.on('joinRoom', ({ username, room }) => {
                const user = this.#userJoin(socket.id, username, room);

                socket.join(user.room);
            })

            socket.on('chat message', (msg) => {
                this.#chatBox(socket, msg);
            });
        });
    }

    #userJoin(id, username, room) {
        const user = { id, username, room };

        this.#users.push(user);

        return user;
    }

    #getCurrentUser(id) {
        return this.#users.find(user => user.id === id);
    }

    /**
     * Handle chatbox messages
     * @param {object} msg Data of message
     * @returns {message}
     */
    #chatBox(socket, msg) {
        let sql = `
            INSERT INTO chat SET ?
        `;

        const date = new Date(), day = date.getDate(), month = date.getMonth() + 1,
        year = date.getFullYear(), hours = date.getHours(), minutes = date.getMinutes(),
        seconds = date.getSeconds();
        const newDate = `${year}-${month}-${day}`;
        const newTime = `${hours}:${minutes}:${seconds}`;

        let values = {
            idEvent: msg.idEvent,
            date: newDate,
            time: newTime,
            username: msg.username,
            message: msg.msg
        };

        mysql.query(sql, values, (error, results) => {
            if (error) {
                console.error(error);
            }

            const user = this.#getCurrentUser(socket.id);

            return this.#io.to(user.room).emit('chat message', {
                date: newDate,
                time: newTime,
                username: msg.username,
                msg: msg.msg
            });
        });
    }
}

module.exports = SocketIO;