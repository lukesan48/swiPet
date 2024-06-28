require('express');
require('mongodb');
exports.setApp = function (app, client) {

    // Put database name here, so can use to specify
    // database to be used
    const dbName = 'COP4331Cards';

    // app.post('/api/addcard', async (req, res, next) => {
    //     // incoming: userId, color
    //     // outgoing: error
    //     const { userId, card } = req.body;

    //     const newCard = { Card: card, UserId: userId };
    //     var error = '';

    //     try {
    //         // dbName to be used to connect to client like so
    //         // to specify database to be used
    //         const db = client.db(dbName);
    //         const result = db.collection('Cards').insertOne(newCard);
    //     }
    //     catch (e) {
    //         error = e.toString();
    //     }

    //     var ret = { error: error };
    //     res.status(200).json(ret);
    // });



    // Generic login api
    app.post('/api/login', async (req, res, next) => {
        // incoming: login, password
        // outgoing: id, firstName, lastName, error

        var error = '';

        const { login, password } = req.body;

        // Same dbName here
        const db = client.db(dbName);
        const results = await db.collection('Users').find({ Login: login, Password: password }).toArray();

        var id = -1;
        var fn = '';
        var ln = '';

        if (results.length > 0) {
            id = results[0].UserId;
            fn = results[0].FirstName;
            ln = results[0].LastName;
        }

        var ret = { id: id, firstName: fn, lastName: ln, error: '' };
        res.status(200).json(ret);
    });


    // Delete user api; should delete user from database...
    app.post("/api/deleteUser", async (req, res, next) => {
        // incoming: login, password
        // outgoing: message

        let message = "";

        const { login, password } = req.body;

        const db = client.db(dbName);

        try {
            // Search for user
            const user = await db.collection("Users").findOne({ Login: login, Password: password });

            // If user is found... delete user!
            if (user) {
                const result = db.collection("Users").deleteOne({ _id: user._id });

                message = "User deleted!";
            }
            else {
                message = "Incorrect credentials!";
            }
        } catch (e) {
            message = e.toString();
        }

        let ret = { message: message };
        res.status(200).json(ret);

    })

    // Create pet listing api; should store pet's id in user's listings array
    // for search/filtering later
    app.post("/api/createPetListing", async (req, res, next) => {
        // incoming:
        // outgoing: 

        let message = "";

        // const {}
    });

    // Remove pet listing api; should delete pet and delete
    // the pet id in user's listings
    app.post("/api/deletePetListing", async (req, res, next) => {
        // incoming:
        // outgoing: 

        let message = "";

        // const {}
    });

    // Register api
    app.post("/api/register", async (req, res, next) => {
        // incoming: firstName, lastName, login, password
        // outgoing: id, firstName, lastName, email, message
        const { firstName, lastName, email, location, login, password } = req.body;
        let message = '';
        let id = -1;

        // Forgot to add connection...
        const db = client.db(dbName);

        // try-catch to see if user exists or not
        // if not, make new user
        try {
            // findOne finds one instance, which there should only be one
            // instance of a login anyways
            const existingUser = await db.collection("Users").findOne({ Login: login });

            // If user is found, don't do anything
            if (existingUser) {
                message = "User already exists..."
            }
            else {
                // No user with login found, so make new user
                const newUser = { FirstName: firstName, LastName: lastName, Email: email, Location: location, Login: login, Password: password, Location: location, Favorites: [], Listings: [] };

                const result = await db.collection("Users").insertOne(newUser);
                id = result.insertedId;
            }

        } catch (e) {
            message = e.toString();
        }

        // probably dont want  to return login and password here...
        let ret = { id: id, firstName: firstName, lastName: lastName, email: email, location: location, error: error }
        res.status(200).json(ret);
    });



    app.post('/api/searchcards', async (req, res, next) => {
        // incoming: userId, search
        // outgoing: results[], error

        var error = '';

        const { userId, search } = req.body;
        var _search = search.trim();

        // Same dbName here
        const db = client.db(dbName);
        const results = await db.collection('Cards').find({ "Card": { $regex: _search + '.*', $options: 'i' } }).toArray();

        var _ret = [];
        for (var i = 0; i < results.length; i++) {
            _ret.push(results[i].Card);
        }
        var ret = { results: _ret, error: error };
        res.status(200).json(ret);
    });
}



// app.post('/api/addcard', async (req, res, next) => {
//     // incoming: userId, color
//     // outgoing: error

//     const { userId, card } = req.body;

//     const newCard = { Card: card, UserId: userId };
//     var error = '';

//     try {
//         const db = client.db('COP4331Cards');
//         const result = db.collection('Cards').insertOne(newCard);
//     }
//     catch (e) {
//         error = e.toString();
//     }

//     cardList.push(card);

//     var ret = { error: error };
//     res.status(200).json(ret);
// });


// app.post('/api/login', async (req, res, next) => {
//     // incoming: login, password
//     // outgoing: id, firstName, lastName, error

//     var error = '';

//     const { login, password } = req.body;

//     const db = client.db('COP4331Cards');
//     const results = await db.collection('Users').find({ Login: login, Password: password }).toArray();

//     var id = -1;
//     var fn = '';
//     var ln = '';

//     if (results.length > 0) {
//         id = results[0].UserId;
//         fn = results[0].FirstName;
//         ln = results[0].LastName;
//     }

//     var ret = { id: id, firstName: fn, lastName: ln, error: '' };
//     res.status(200).json(ret);
// });


// app.post('/api/searchcards', async (req, res, next) => {
//     // incoming: userId, search
//     // outgoing: results[], error

//     var error = '';

//     const { userId, search } = req.body;

//     var _search = search.trim();

//     const db = client.db('COP4331Cards');
//     const results = await db.collection('Cards').find({ "Card": { $regex: _search + '.*', $options: 'i' } }).toArray();

//     var _ret = [];
//     for (var i = 0; i < results.length; i++) {
//         _ret.push(results[i].Card);
//     }

//     var ret = { results: _ret, error: error };
//     res.status(200).json(ret);
// });