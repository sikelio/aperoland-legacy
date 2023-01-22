require('dotenv').config();
const components = require('./components');
const eventController = require('../controller/eventController');
const accountController = require('../controller/accountController');
const info = require('../package.json');
const logger = require('../config/logger');
const mysql = require('../config/mysql');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const path = require('path');
const { promisify } = require('util');

const Calendar = require('./calendar');

class Routes extends Calendar {
    /**
     * Init of all types of routes
     * @param {function} app ExpressJS functions
     * @returns {void} Page
     */
    init(app) {
        this.#public(app);
        this.#error(app);
        this.#application(app);
        this.#admin(app);
    }

    /**
     * Creation of the public routes
     * This routes are accesible from anyone without a login cookie
     * @param {function} app ExpressJS functions
     * @returns {void} Page
     */
    #public(app) {
        // Root page
        app.get('/', async (req, res) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    return res.redirect('/app/home');
                } catch (error) {
                    return res.clearCookie('aperolandTicket');
                }
            } else {
                mysql.query('SELECT * FROM quotes ORDER BY RAND ( ) LIMIT 1', (error, results) => {
                    if (error) {
                        return res.redirect('/internal-error');
                    }

                    if (results.length == 0) {
                        return res.render('home', {
                            navbar: components.publicNavbar
                        });
                    }

                    return res.render('home', {
                        navbar: components.publicNavbar,
                        quote: results[0].quote
                    });
                });
            }
        });

        // Return the favicon for all routes
        app.get('/favicon.ico', (req, res) => {
            res.sendFile(path.join(__dirname, '../pages/public/favicon.ico'));
        });

        // Register page
        app.get('/register', async (req, res) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    return res.redirect('/app/home');
                } catch (error) {
                    return res.clearCookie('aperolandTicket');
                }
            } else {
                return res.render('register', {
                    navbar: components.publicNavbar,
                    projectName: info.displayName,
                    cgu: components.cgu,
                    currentYear: new Date().getFullYear()
                });
            }
        });

        // Login page
        app.get('/login', async (req, res) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    return res.redirect('/app/home');
                } catch (error) {
                    return res.clearCookie('aperolandTicket');
                }
            } else {
                return res.render('login', {
                    navbar: components.publicNavbar,
                    projectName: info.displayName,
                    currentYear: new Date().getFullYear()
                });
            }
        });

        // Logout code
        app.post('/logout', (req, res) => {
            res.clearCookie('aperolandTicket');

            return res.redirect('/');
        });

        // Registration confirm page
        app.get('/confirm/:confirmationToken', (req, res) => {
            const confirmationToken = req.params.confirmationToken;

            mysql.query('SELECT * FROM users WHERE confirmationToken = ?', confirmationToken, async (error, results) => {
                if (error) {
                    return res.redirect('/internal-error');
                }

                if (results.length != 1) {
                    return res.render('confirmation', {
                        alreadyConfirmed: true,
                        message: 'Erreur'
                    });
                }

                try {
                    const decoded = await promisify(jwt.verify)(confirmationToken, process.env.JWT_SECRET);

                    mysql.query('UPDATE users SET isConfirmed = \'Yes\', confirmationToken = NULL WHERE idUser = ?', decoded.idUser, (error, results) => {
                        if (error) {
                            return res.redirect('/internal-error');
                        }
    
                        return res.render('confirmation', {
                            success: true,
                            message: 'Succes'
                        });
                    });
                } catch (error) {
                    return res.render('confirmation', {
                        expired: true,
                        message: 'Erreur'
                    });
                }
            });
        });

        // Quick join event link
        app.get('/join-event/:uuid', eventController.eventExist, accountController.isAlreadyConnected, (req, res) => {
            // TODO
        });
    }

    /**
     * Creation of the errors code routes
     * @param {function} app ExpressJS functions
     * @returns {void} Page
     */
    #error(app) {
        // ERROR 403
        app.get('/forbidden', (req, res) => {
            return res.sendFile(components.forbidden);
        });

        // ERROR 404
        app.get('/not-found', (req, res) => {
            return res.sendFile(components.notFound);
        });

        // ERROR 500
        app.get('/internal-error', (req, res) => {
            return res.sendFile(components.internalError);
        });
    }

    /**
     * Creation of the application routes
     * This routes are only accesible if the user has a login cookie
     * @param {function} app ExpressJS functions
     * @returns Page
     */
    #application(app) {
        // Home page
        app.get('/app/home', async (req, res) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    mysql.query('SELECT username FROM users WHERE idUser = ?', [decoded.idUser], (error, results) => {
                        if (error) {
                            return res.redirect('/internal-error');
                        }

                        const sql = `
                            SELECT events.name, events.description, events.idEvent, events.idUser, usr.username
                            FROM eventsparticipate
                            RIGHT JOIN events ON eventsparticipate.idEvent = events.idEvent
                            RIGHT JOIN users ON eventsparticipate.idUser = users.idUser
                            RIGHT JOIN users AS usr ON usr.idUser = events.idUser
                            WHERE eventsparticipate.idUser = ?
                        `;

                        mysql.query(sql, [decoded.idUser], (error, results) => {
                            if (error) {
                                return res.redirect('/internal-error');
                            }

                            return res.render('app', {
                                navbar: this.#getNavbar(decoded.role),
                                addEvent: components.addEvent,
                                joinEvent: components.joinEvent,
                                eventsList: results
                            });
                        });

                        
                    });
                } catch (error) {
                    res.clearCookie('aperolandTicket');

                    return res.redirect('/');
                }
            } else {
                return res.redirect('/');
            }
        });

        // Event page
        app.get('/app/event/:idEvent', eventController.isAllowed, (req, res) => {
            if (req.cookies.aperolandTicket) {
                let sql = `
                    SELECT *, DATE_FORMAT(events.date, '%d-%m-%Y') AS date FROM events
                    RIGHT JOIN users ON events.idUser = users.idUser
                    WHERE idEvent = ?
                `;

                mysql.query(sql, req.params.idEvent, (error, results) => {
                    if (error) {
                        return res.redirect('/internal-error');
                    }

                    const eventInfo = results[0];

                    sql = `
                        SELECT * FROM eventsparticipate
                        RIGHT JOIN users ON eventsparticipate.idUser = users.idUser
                        WHERE idEvent = ?
                    `;

                    mysql.query(sql, eventInfo.idEvent, async (error, results) => {
                        if (error) {
                            return res.redirect('/internal-error');
                        }

                        let participants = results;

                        try {
                            const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                                process.env.JWT_SECRET
                            );

                            let isOrganizer = false;

                            if (decoded.idUser == eventInfo.idUser) {
                                isOrganizer = true;
                            }

                            sql = `
                                SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS date FROM chat
                                WHERE idEvent = ?
                                ORDER BY date, time DESC
                            `;

                            mysql.query(sql, req.params.idEvent, (error, results) => {
                                if (error) {
                                    return res.redirect('/internal-error');
                                }

                                let chats = results;

                                sql = `
                                    SELECT * FROM shoppinglistitems
                                    WHERE idEvent = ?
                                `;

                                mysql.query(sql, eventInfo.idEvent, (error, results) => {
                                    if (error) {
                                        return res.redirect('/internal-error');
                                    }

                                    return res.render('event', {
                                        navbar: this.#getNavbar(decoded.role),
                                        eventName: eventInfo.name,
                                        organizer: eventInfo.username,
                                        description: eventInfo.description,
                                        isOrganizer: isOrganizer,
                                        uuid: eventInfo.uuid,
                                        calendar: `/app/event/${eventInfo.idEvent}/calendar`,
                                        participants: participants,
                                        chats: chats,
                                        shoppingList: results,
                                        latitude: eventInfo.latitude,
                                        longitude: eventInfo.longitude,
                                        editEvent: components.editEvent,
                                        deleteUser: components.deleteUser,
                                        leaveEvent: components.leaveEvent,
                                        deleteEvent: components.deleteEvent,
                                        addArticle: components.addArticle,
                                        regenerateCode: components.regenerateCode,
                                        idEvent: eventInfo.idEvent,
                                        date: eventInfo.date,
                                        time: eventInfo.time,
                                        username: decoded.username
                                    });
                                });
                            });
                        } catch (error) {
                            return res.redirect('/internal-error');
                        }
                    });
                });
            }
        });

        // Download ics file
        app.get('/app/event/:idEvent/calendar', eventController.isAllowed, (req, res) => {
            let sql = `
                SELECT *, DATE_FORMAT(date, '%Y-%m-%d') AS newDate FROM events
                WHERE idEvent = ?
            `;

            mysql.query(sql, req.params.idEvent, (error, results) => {
                if (error) {
                    return res.redirect('/internal-error');
                }

                let eventName = results[0].name.replace(/\s/g, '-').toLowerCase();

                if (fs.existsSync(`calendar/${results[0].idEvent}-${eventName}.ics`) == false) {
                    this.recreateFile(results[0]);
                }

                return res.sendFile(path.join(__dirname, `../calendar/${results[0].idEvent}-${eventName}.ics`));
            });
        });

        // Change account info
        app.get('/app/account', accountController.isConnected, async (req, res) => {
            try {
                const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                    process.env.JWT_SECRET
                );

                let sql = `
                    SELECT * FROM users
                    WHERE idUser = ?
                `;

                mysql.query(sql, decoded.idUser, (error, results) => {
                    if (error) {
                        return res.redirect('/internal-error');
                    }

                    return res.render('account', {
                        navbar: this.#getNavbar(decoded.role),
                        userData: results[0]
                    });
                });
            } catch (error) {
                return res.redirect('/');
            }
        });
    }

    /**
     * Creation of the admin routes
     * This routes are only accesible if the user has a login cookie
     * and only if the user has the admin role
     * @param {function} app ExpressJS functions
     * @returns Page
     */
    #admin(app) {
        // User list page
        app.get('/admin/users', async (req, res) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    if (decoded.role != 'Admin') {
                        return res.redirect('/');
                    }

                    mysql.query('SELECT * FROM users WHERE role = \'User\'', (error, results) => {
                        if (error) {
                            return res.redirect('/internal-error');
                        }

                        return res.render('users', {
                            navbar: components.adminNavbar,
                            users: results,
                            confirmDeleteUser: components.confirmDeleteUser
                        });
                    });
                } catch (error) {
                    res.redirect('/')
                }
            } else {
                return res.redirect('/');
            }
        });

        // Quotes list page
        app.get('/admin/quotes', async (req, res) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    if (decoded.role != 'Admin') {
                        return res.redirect('/');
                    }

                    mysql.query('SELECT * FROM quotes', (error, results) => {
                        if (error) {
                            return res.redirect('/internal-error');
                        }

                        return res.render('quotes', {
                            navbar: components.adminNavbar,
                            quotes: results,
                            addQuote: components.addQuote
                        });
                    });
                } catch (error) {
                    res.redirect('/')
                }
            } else {
                return res.redirect('/');
            }
        });

        // Events list page
        app.get('/admin/events', async (req, res, next) => {
            if (req.cookies.aperolandTicket) {
                try {
                    const decoded = await promisify(jwt.verify)(req.cookies.aperolandTicket,
                        process.env.JWT_SECRET
                    );

                    if (decoded.role != 'Admin') {
                        return res.redirect('/');
                    }

                    let sql = `
                        SELECT E.idEvent, E.idUser, E.name, U.email, COUNT(EP.idUser) AS attendees, E.address,
                        DATE_FORMAT(E.date, '%Y-%m-%d') AS date, E.time, E.duration
                        FROM events AS E
                        RIGHT JOIN users AS U ON E.idUser = U.idUser
                        RIGHT JOIN (SELECT * FROM eventsparticipate) AS EP ON EP.idEvent = E.idEvent
                        GROUP BY E.idEvent
                    `;

                    mysql.query(sql, (error, results) => {
                        if (error) {
                            return res.redirect('/internal-error');
                        }

                        return res.render('events', {
                            navbar: components.adminNavbar,
                            confirmDeleteEvent: components.confirmDeleteEvent,
                            events: results
                        });
                    });
                } catch (error) {
                    res.redirect('/')
                }
            } else {
                return res.redirect('/');
            }
        });
    }

    /**
     * Get the navbar following the user role
     * @param {string} role User role
     * @returns {element}
     */
    #getNavbar(role) {
        let navbar;

        switch (role) {
            case 'User':
                navbar = components.appNavbar
                break;
            case 'Admin':
                navbar = components.adminNavbar;
                break;
        }

        return navbar;
    }
}

module.exports = Routes;
