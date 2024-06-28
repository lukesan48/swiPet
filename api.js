const express = require('express');
const mongodb = require('mongodb');
const bcrypt = require('bcrypt');

exports.setApp = function (app, client) {

    // Put database name here, so can use to specify
    // database to be used
    const dbName = 'swiPet';

    // Modified login api
    app.post('/api/login', async (req, res, next) => {
        // incoming: login, password
        // outgoing: id, firstName, lastName, error

        // Need to initialize ret outside of
        // conditional statements...
        let ret = {};

        let message = '';

        const { login, password } = req.body;

        // Same dbName here
        const db = client.db(dbName);
        const user = await db.collection('User').findOne({ Login: login });

        // A user's login is found
        if (user) {
            const passwordMatch = await bcrypt.compare(password, user.Password);

            // Password matches
            if (passwordMatch) {
                ret = { id: user._id, firstName: user.FirstName, lastName: user.LastName, message: message };
            }

            // Password doesn't match
            else {
                message = "Invalid credentials";
                ret = { message: message };
            }
        }
        // User's login not found
        else {
            message = "User not found";
            ret = { message: message };
        }

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
            // Since hashing password, search for login only
            // password will be checked later
            const user = await db.collection("User").findOne({ Login: login });

            // If user is found... cast delete user!
            if (user) {
                // Compare password and hashed password in database
                const passwordMatch = bcrypt.compare(password, user.Password);

                // If passwords match... cast delete
                if (passwordMatch) {
                    const result = db.collection("User").deleteOne({ _id: user._id });
                    message = "User deleted";
                }

                else {
                    message = "Incorrect credentials";
                }
            }
            else {
                message = "Invalid user";
            }
        } catch (e) {
            message = e.toString();
        }

        let ret = { message: message };
        res.status(200).json(ret);
    });

    // Update user api
    app.post("/api/updateUser", async (req, res, next) => {

    });

    // Forgot password api
    app.post("/api/forgotPassword", async (req, res, next) => {

    });

    // Register api
    // Need to implement password hashing via bcrypt - to do
    app.post("/api/register", async (req, res, next) => {
        // incoming: firstName, lastName, login, password
        // outgoing: id, firstName, lastName, email, message
        const { firstName, lastName, email, phoneNumber, location, login, password } = req.body;
        let message = '';
        let id = -1;

        // Forgot to add connection...
        const db = client.db(dbName);

        // try-catch to see if user exists or not
        // if not, make new user
        try {
            // findOne finds one instance, which there should only be one
            // instance of a login anyways
            const existingUser = await db.collection("User").findOne({ Login: login });

            // If user is found, don't do anything
            if (existingUser) {
                message = "User already exists..."
            }
            else {
                
                //== bCrypt stuff... ==
                // Essentially determines how long is spent
                // on hashing password; higher is better, but
                // takes longer to hash
                const saltRounds = 12;
                // Hash call
                const hashedPassword = await bcrypt.hash(password, saltRounds);
                //== End of bCrypt stuff... ==

                // No user with login found, so make new user
                const newUser = {
                    FirstName: firstName, 
                    LastName: lastName, 
                    Email: email,
                    PhoneNumber: phoneNumber,
                    Location: location, 
                    Login: login, 
                    Password: hashedPassword, 
                    Favorites: [], 
                    Listings: []
                };

                const result = await db.collection("User").insertOne(newUser);
                id = result.insertedId;
            }

        } catch (e) {
            message = e.toString();
        }

        // probably dont want  to return login and password here...
        let ret = { id: id, firstName: firstName, lastName: lastName, email: email, message: message }
        res.status(200).json(ret);
    });

}   res.status(200).json(ret);
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