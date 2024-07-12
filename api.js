const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('mongodb');
require('express');

exports.setApp = function (app, client) {

    // Put database name here, so can use to specify
    // database to be used
    const dbName = 'swiPet';

    // JWT 'middleware'
    const token = require('./createJWT.js');

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

            // Check to see if email verified
            if (!user.Verified) {
                message = "Please verify your email before logging in";
                ret = { message: message };
            } else {
                const passwordMatch = await bcrypt.compare(password, user.Password);

                // Password matches
                if (passwordMatch) {
                    // Create JWT
                    let jwtToken = token.createToken(user.FirstName, user.LastName, user._id);

                    ret = { id: user._id, firstName: user.FirstName, lastName: user.LastName, jwtToken: jwtToken.accessToken, message: message };
                }

                // Password doesn't match
                else {
                    message = "Invalid credentials";
                    ret = { message: message };
                }
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
        // incoming: login, password, jwtToken
        // outgoing: message

        let message = "";

        const { login, password, jwtToken } = req.body;

        // JWT
        if (token.isExpired(jwtToken)) {
            res.status(200).json({ message: 'The JWT is invalid' });
            return;
        }

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
                message = "User not found";
            }
        } catch (e) {
            message = e.toString();
        }

        // Refresh JWT
        let refreshedToken = token.refresh(jwtToken);

        let ret = { message: message, jwtToken: refreshedToken };
        res.status(200).json(ret);
    });

    // Update user api - not including password
    app.post("/api/updateUser", async (req, res, next) => {
        // incoming: login, firstName, lastName, email, phoneNumber, location
        // outgoing: (new/same - firstName, lastName, email, phoneNumber, location), message
        const { login, firstName, lastName, email, phoneNumber, location, jwtToken } = req.body;

        let message = '';

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        const db = client.db(dbName);
        const collection = db.collection('User');

        let user = await collection.findOne({ Login: login });

        // Check to see if valid user
        if (user) {

            let updatedUser = { FirstName: firstName, LastName: lastName, Email: email, PhoneNumber: phoneNumber, Location: location };

            // Trim empty fields from updatedUser
            // Done by stringify, which does not stringify
            // undefined data, and parsing back to json
            updatedUser = JSON.parse(JSON.stringify(updatedUser));


            try {
                // updateOne (filter, update)
                // Filter based off login
                const result = await collection.updateOne(
                    // Case sensitive; Login: login,
                    // not login: login
                    { Login: login },
                    { $set: updatedUser }
                )

                // Check to see if anything was updated
                if (result.modifiedCount === 0) {
                    message = "No changes made to user";
                }
                else {
                    message = "User updated successfully";
                }

            } catch (e) {
                message = e.toString();
            }

        }
        else {
            message = "User not found";
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

    // Register api
    // Need to implement password hashing via bcrypt - done
    // Need to implement email verification - done
    // No JWT for register, since ya know, register
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
            const existingUser = await db.collection('User').findOne({ Login: login });

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
                    Favorites: {},
                    Listings: {},
                    Verified: false
                };

                const result = await db.collection('User').insertOne(newUser);
                id = result.insertedId;

                // Generate email verification token
                const token = jwt.sign({ userId: id }, process.env.JWT_SECRET, { expiresIn: '1h' });

                // Setting up email for sending verification...
                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        // Google's app password, not actual
                        // password
                        pass: process.env.EMAIL_PASS
                    }
                });

                // The email itself
                const verificationLink = `http://localhost:5000/api/verifyEmail?token=${token}`;
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Email Verification for swiPet',
                    // website format: http://domain/api/verify-email?token=${token}
                    // in this case locally since testing
                    // Need to use backtick here for ${token}
                    text: `Please verfiy your swiPet account by clicking on the follow link... ${verificationLink}`
                };

                await transporter.sendMail(mailOptions);
                message = "Registration successful. Proceed to verify email."
            }

        } catch (e) {
            message = e.toString();
        }

        // probably dont want  to return login and password here...
        const ret = { id: id, firstName: firstName, lastName: lastName, email: email, message: message }
        res.status(200).json(ret);
    });

    // Verify email api
    app.get('/api/verifyEmail', async (req, res, next) => {
        const { token } = req.query;
        const db = client.db(dbName);

        let message;

        try {

            // Decode token and get userId from it
            const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
            const userId = decodedToken.userId;

            const user = await db.collection('User').findOne({ _id: new ObjectId(userId) });

            // Check to see if user is already verified
            if (user.Verified) {
                message = 'Email already verified';
            }
            else {
                // Find userId and edit Verified boolean
                // Need new ObjectId here
                await db.collection('User').updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { Verified: true } }
                );

                message = 'Email verified successfully';
            }

        } catch (e) {
            message = e.toString();
        }

        const ret = { message: message };
        res.status(200).json(ret);
    });

    // Forgot password api
    // Sending email similar to email verification api
    app.post("/api/forgotPassword", async (req, res, next) => {
        // incoming: email, jwtToken
        // outgoing: message
        const { email } = req.body;
        let message = '';

        const db = client.db(dbName);


        try {
            const user = await db.collection('User').findOne({ Email: email });

            if (!user) {
                message = 'User not found';
            }
            else {
                // Token for password reset - should only last 10 mins
                const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '10m' });

                // Database to manage one time link
                await db.collection('PasswordResetTokens').insertOne({
                    userId: user._id,
                    token: token,
                    used: false
                });

                const transporter = nodemailer.createTransport({
                    service: 'gmail',
                    auth: {
                        user: process.env.EMAIL_USER,
                        pass: process.env.EMAIL_PASS
                    }
                });

                const resetLink = `http://localhost:5000/api/resetPassword?token=${token}`;
                const mailOptions = {
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Password Reset for swiPet',
                    text: `Reset your swiPet account password by clicking on the follow link... ${resetLink}`
                };

                await transporter.sendMail(mailOptions);
                message = 'Password reset email sent';
            }

        } catch (e) {
            message = e.toString();
        }

        const ret = { message: message };
        res.status(200).json(ret);
    });

    // Reset password api
    app.post('/api/resetPassword', async (req, res, next) => {
        // incoming: token, newPassword
        // outgoing: message
        const { token, newPassword } = req.body;
        let message = '';

        const db = client.db(dbName);

        // Get token from database
        const checkToken = await db.collection('PasswordResetTokens').findOne({ token: token });

        if (!checkToken) {
            let ret = { message: 'Invalid token' };
            res.status(200).json(ret);
            return;
        }

        // Check if token is used
        if (checkToken.used) {
            message = 'Token already used';
        }

        else {
            try {
                const decodedToken = jwt.verify(token, process.env.JWT_SECRET);
                const userId = decodedToken.userId;

                // Don't forget to hash new password...
                const saltRounds = 12;
                const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

                await db.collection('User').updateOne(
                    { _id: new ObjectId(userId) },
                    { $set: { Password: hashedPassword } }
                );

                // Update used to true
                await db.collection('PasswordResetTokens').updateOne(
                    { token: token },
                    { $set: { used: true }}
                );

                message = 'Password reset successfully';

            } catch (e) {
                message = e.toString();
            }
        }

        const ret = { message: message };
        res.status(200).json(ret);
    });

    // API to add new pets to specific users and update their listings to reflect the new pet
    app.post('/api/addpet', async (req, res) => {

        // incoming: userLogin, petName, type, petAge, petGender, breed, petSize, bio, contactEmail, location, images
        // outgoing: message, petId

        const { userLogin, petName, type, petAge, petGender, breed, petSize, bio, contactEmail, location, images, jwtToken } = req.body;
        let message = '';
        let petId = null;

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        try {
            // Connect to database
            const db = client.db(dbName);

            // Checks if there is a valid user to create the pet, if there is then create the pet
            const user = await db.collection('User').findOne({ Login: userLogin });
            if (user) {
                const newPet = {
                    Login: userLogin,
                    Pet_Name: petName,
                    Pet_Type: type,
                    Age: petAge,
                    Gender: petGender,
                    Breed: breed,
                    Size: petSize,
                    Bio: bio,
                    Contact_Email: contactEmail,
                    Location: location,
                    Images: images || []
                };
                // Insert new pet and their descriptions into database
                const result = await db.collection('Pet').insertOne(newPet);

                // Needed to get the pet's ObjectId
                petId = result.insertedId;

                // Updates Listing of user who created the pet with the pet's ObjectId
                await db.collection('User').updateOne(
                    { Login: userLogin },
                    { $push: { Listings: petId } }
                );
                message = "Pet Created";
            } else {
                message = "User does not exist";
            }
        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { message: message, petId: petId, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

    // API to add a pet to a user's favorites list
    app.post('/api/addfavorite', async (req, res) => {

        // incoming: userLogin, petId
        // outgoing: message

        const { userLogin, petId, jwtToken } = req.body;
        let message = '';

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        try {
            // Connect to the database
            const db = client.db(dbName);

            // Checks if there is a valid user
            const user = await db.collection('User').findOne({ Login: userLogin });
            if (user) {
                const objectId = new ObjectId(petId);

                // Check if there is a valid pet as well
                const pet = await db.collection('Pet').findOne({ _id: objectId });

                // If there is a valid user and a valid pet, add that pet to the user's favorited pets
                if (pet) {
                    await db.collection('User').updateOne(
                        { Login: userLogin },
                        { $addToSet: { Favorites: objectId } }
                    );
                    message = "Pet added to favorites";
                } else {
                    message = "Pet not found";
                }
            } else {
                message = "User does not exist";
            }
        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

    // API to delete a pet and the listing of the original user who uploaded the pet (as well as from the favorites list of anyone who has that pet favorited)
    app.post('/api/deletepet', async (req, res) => {

        // incoming: userLogin, petId
        // outgoing: message

        const { userLogin, petId, jwtToken } = req.body;
        let message = '';

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        try {
            // Connect to database
            const db = client.db(dbName);
            const user = await db.collection('User').findOne({ Login: userLogin });

            // If there is a valid user, proceed to see if the pet is in the database
            if (user) {
                const objectId = new ObjectId(petId);
                const pet = await db.collection('Pet').findOne({ _id: objectId });

                // If the pet is in the database, proceed with deletion
                if (pet) {

                    // If the user that created the pet does not matche with the user that was inputted, return error
                    if (pet.Login !== userLogin) {
                        message = "You do not have permission to delete this pet";
                    } else {
                        // Delete from the pet collection
                        await db.collection('Pet').deleteOne({ _id: pet._id });

                        // Update the creator's listings to remove it
                        await db.collection('User').updateOne(
                            { Login: userLogin },
                            { $pull: { Listings: pet._id } }
                        );

                        // Update all favorite's lists in all users so that it reflects that the pet was deleted
                        await db.collection('User').updateMany(
                            { Favorites: pet._id },
                            { $pull: { Favorites: pet._id } }
                        );
                        message = "Pet deleted successfully and removed from all favorites";
                    }
                } else {
                    message = "Pet not found";
                }
            } else {
                message = "User does not exist";
            }
        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

}
