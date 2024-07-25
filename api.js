const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');
const nodemailer = require('nodemailer');
const jwt = require('jsonwebtoken');
require('mongodb');
const express = require('express');
const allowedColors = ["Brown", "Black", "White", "Gold", "Gray", "Red", "Yellow", "Blue", "Orange", "Purple", "Green"];
// JWT middleware
const token = require('./createJWT.js');
// multer middleware
const { uploadSingle, uploadMultiple } = require('./multerConfig');


exports.setApp = function (app, client) {

    // Put database name here, so can use to specify
    // database to be used
    const dbName = 'swiPet';


    // Serve uploaded files statically from server
    app.use('/uploads', express.static('uploads'));

    // Modified login api
    app.post('/api/login', async (req, res, next) => {
        // incoming: login, password
        // outgoing: jwtToken, message

        // Need to initialize ret outside of
        // conditional statements...
        let ret = {};

        let message = '';

        const { userLogin, password } = req.body;

        // Same dbName here
        const db = client.db(dbName);
        const user = await db.collection('User').findOne({ username: userLogin });

        // A user's login is found
        if (user) {

            // Check to see if email verified
            if (!user.Verified) {
                message = "Please verify your email before logging in";
                ret = { message: message };
            } else {
                const passwordMatch = await bcrypt.compare(password, user.password);

                // Password matches
                if (passwordMatch) {
                    // Create JWT
                    let jwtToken = token.createToken(user.firstName, user.lastName, user._id, user.username, user.email);

                    // // jwt testing
                    // const decodedToken = jwt.decode(jwtToken.accessToken, { complete: true });
                    // console.log(decodedToken);

                    ret = { jwtToken: jwtToken.accessToken, message: message };
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

        const { userLogin, password, jwtToken } = req.body;

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
            const user = await db.collection("User").findOne({ username: userLogin });

            if (user) {
                // Compare password and hashed password in database
                const passwordMatch = await bcrypt.compare(password, user.password);

                // If passwords match... cast delete
                if (passwordMatch) {
                    // Make sure to delete user's listings
                    const userPets = user.Listings;

                    if (userPets && userPets.length > 0) {
                        await db.collection("Pet").deleteMany({
                            _id: { $in: userPets }
                        });

                        // Also remove from other's favorites
                        await db.collection("User").updateMany(
                            { Favorites: { $in: userPets } },
                            { $pull: { Favorites: { $in: userPets } } }
                        );

                    }

                    await db.collection("User").deleteOne({ _id: user._id });
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

        // No need for anymore jwt's
        let ret = { message: message };
        res.status(200).json(ret);
    });

    // Update user api - not including password
    app.post("/api/updateUser", async (req, res, next) => {
        // incoming: login, firstName, lastName, email, phoneNumber, location
        // outgoing: jwtToken, message

        uploadSingle(req, res, async (error) => {
            const { userLogin, firstName, lastName, email, phoneNumber, location, jwtToken } = req.body;

            let message = '';
            let newJwtToken = jwtToken;
            let ret = { jwtToken: newJwtToken, message: message };

            if (token.isExpired(jwtToken)) {
                ret.message = 'The JWT is no longer valid';
                ret.jwtToken = '';
                res.status(200).json(ret);
                return;
            }

            if (error) {
                res.status(400).json({ message: error });
            } else {
                const db = client.db(dbName);
                const collection = db.collection('User');
                let user = await collection.findOne({ username: userLogin });

                // Check to see if valid user
                if (user) {
                    let updatedUser = { firstName: firstName, lastName: lastName, email: email, phoneNumber: phoneNumber, address: location };

                    // If a file is uploaded, add the file path to updatedUser
                    if (req.file) {
                        const filePath = `uploads/${req.file.filename}`;
                        updatedUser.userImage = filePath;
                    }

                    // Trim empty fields from updatedUser
                    updatedUser = JSON.parse(JSON.stringify(updatedUser));

                    try {
                        const result = await collection.updateOne(
                            { username: userLogin },
                            { $set: updatedUser }
                        );

                        if (result.modifiedCount === 0) {
                            message = "No changes made to user";
                            newJwtToken = token.refresh(jwtToken);
                        } else {
                            message = "User updated successfully";
                            const newFirstName = updatedUser.firstName || user.firstName;
                            const newLastName = updatedUser.lastName || user.lastName;
                            const newToken = token.createToken(newFirstName, newLastName, user._id, user.username);
                            newJwtToken = newToken.accessToken;
                        }
                    } catch (e) {
                        message = e.toString();
                    }
                } else {
                    message = "User not found";
                }

                ret.message = message;
                ret.jwtToken = newJwtToken;
                res.status(200).json(ret);
            }
        });
    });

    // Register api
    // Need to implement password hashing via bcrypt - done
    // Need to implement email verification - done
    // No JWT for register, since ya know, register
    app.post("/api/register", async (req, res, next) => {
        // incoming: firstName, lastName, login, password
        // outgoing: message
        const { firstName, lastName, email, phoneNumber, location, userLogin, password, userImage } = req.body;
        let message = '';
        let id = -1;

        // Forgot to add connection...
        const db = client.db(dbName);

        // try-catch to see if user exists or not
        // if not, make new user
        try {
            // findOne finds one instance, which there should only be one
            // instance of a login anyways
            const existingUser = await db.collection('User').findOne({ username: userLogin });

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
                    firstName: firstName,
                    lastName: lastName,
                    email: email,
                    phoneNumber: phoneNumber,
                    address: location,
                    username: userLogin,
                    password: hashedPassword,
                    Favorites: [],
                    Listings: [],
                    userImage: '',
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
        const ret = { message: message }
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
        const { userLogin, email } = req.body;
        let message = '';

        const db = client.db(dbName);


        try {
            const user = await db.collection('User').findOne({ username: userLogin, email: email });

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
                    { $set: { password: hashedPassword } }
                );

                // Update used to true
                await db.collection('PasswordResetTokens').updateOne(
                    { token: token },
                    { $set: { used: true } }
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
        // incoming: userLogin, petName, type, petAge, petGender, color, breed, petSize, bio, prompt1, prompt2, contactEmail, location, images, adoptionFee
        // outgoing: message, petId

        uploadMultiple(req, res, async (error) => {
            const { userLogin, petName, type, petAge, petGender, colors, breed, petSize, bio, prompt1, prompt2, contactEmail, location, adoptionFee, jwtToken } = req.body;
            let message = '';
            let petId = null;
            let imageMessage = '';

            if (token.isExpired(jwtToken)) {
                let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
                res.status(200).json(ret);
                return;
            }

            if (error) {
                res.status(400).json({ message: error });
            } else {
                try {
                    // Connect to database
                    const db = client.db(dbName);

                    // Checks if there is a valid user to create the pet, if there is then create the pet
                    const user = await db.collection('User').findOne({ username: userLogin });
                    if (user) {
                        // Makes sure the colors are correct and picked out of the predfined list
                        // If no colors are provided, add one empty placeholder
                        const validColors = Array.isArray(colors) ? colors.filter(color => allowedColors.includes(color)) : [];
                        if (validColors.length === 0) validColors.push('');

                        // Ensures if no images were provided, three empty placeholders are provided
                        // If some images were provided, it would add those images and place empty placeholders when needed
                        let petImages = [];
                        if (req.files) {
                            petImages = req.files.map(file => `uploads/${file.filename}`);
                            while (petImages.length < 3) {
                                petImages.push('');
                            }
                            if (req.files.length > 3) {
                                imageMessage = "Only the first 3 images were added.";
                            }
                        }

                        const newPet = {
                            username: userLogin || '',
                            Pet_Name: petName || '',
                            Pet_Type: type || '',
                            Age: petAge || '',
                            Gender: petGender || '',
                            Color: validColors,
                            Breed: breed || '',
                            Size: petSize || '',
                            Bio: bio || '',
                            Prompt1: prompt1 || '',
                            Prompt2: prompt2 || '',
                            Contact_Email: contactEmail || '',
                            Location: location || '',
                            Images: petImages,
                            AdoptionFee: adoptionFee || ''
                        };

                        // Insert new pet and their descriptions into database
                        const result = await db.collection('Pet').insertOne(newPet);

                        // Needed to get the pet's ObjectId
                        petId = result.insertedId;

                        // Updates Listing of user who created the pet with the pet's ObjectId
                        await db.collection('User').updateOne(
                            { username: userLogin },
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
                const ret = { imageMessage: imageMessage, message: message, petId: petId, jwtToken: refreshedToken.accessToken };
                res.status(200).json(ret);
            }
        });
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

        // // jwt testing
        // const decodedToken = jwt.decode(jwtToken, { complete: true });
        // console.log(decodedToken);

        try {
            // Connect to the database
            const db = client.db(dbName);

            // Checks if there is a valid user
            const user = await db.collection('User').findOne({ username: userLogin });
            if (user) {
                const objectId = new ObjectId(petId);

                // Check if there is a valid pet as well
                const pet = await db.collection('Pet').findOne({ _id: objectId });

                // If there is a valid user and a valid pet, add that pet to the user's favorited pets
                if (pet) {
                    await db.collection('User').updateOne(
                        { username: userLogin },
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

    // API to remove a pet from a user's favorites list
    app.post('/api/unfavorite', async (req, res) => {
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

            // Check if the user exists
            const user = await db.collection('User').findOne({ username: userLogin });
            if (user) {
                const objectId = new ObjectId(petId);

                // Check if the pet is in the user's favorites list
                const isFavorited = user.Favorites.some(favorite => favorite.equals(objectId));
                if (isFavorited) {
                    // Remove the pet from the user's favorites list
                    await db.collection('User').updateOne(
                        { username: userLogin },
                        { $pull: { Favorites: objectId } }
                    );
                    message = "Pet removed from favorites";
                } else {
                    message = "Pet is not in the favorites list";
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
            const user = await db.collection('User').findOne({ username: userLogin });

            // If there is a valid user, proceed to see if the pet is in the database
            if (user) {
                const objectId = new ObjectId(petId);
                const pet = await db.collection('Pet').findOne({ _id: objectId });

                // If the pet is in the database, proceed with deletion
                if (pet) {

                    // If the user that created the pet does not matche with the user that was inputted, return error
                    if (pet.username !== userLogin) {
                        message = "You do not have permission to delete this pet";
                    } else {
                        // Delete from the pet collection
                        await db.collection('Pet').deleteOne({ _id: pet._id });

                        // Update the creator's listings to remove it
                        await db.collection('User').updateOne(
                            { username: userLogin },
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

    // API endpoint to update pet listings (only people who created are able to edit it)
    app.post("/api/updatepet", async (req, res, next) => {
        // incoming: userLogin, petId, petName, type, petAge, petGender, colors, breed, petSize, bio, prompt1, prompt2, contactEmail, location, images, adoptionFee
        // outgoing: message

        uploadMultiple(req, res, async (error) => {
            const { userLogin, petId, petName, type, petAge, petGender, colors, breed, petSize, bio, prompt1, prompt2, contactEmail, location, adoptionFee, jwtToken } = req.body;
            let message = '';
            let imageMessage = '';

            if (token.isExpired(jwtToken)) {
                let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
                res.status(200).json(ret);
                return;
            }

            if (error) {
                res.status(400).json({ message: error });
            } else {
                try {
                    // Connect to database and find the pet from their petId
                    const db = client.db(dbName);
                    const objectId = new ObjectId(petId);
                    const pet = await db.collection('Pet').findOne({ _id: objectId });

                    // Check to see if there is a valid pet and the original user is the one trying to delete it
                    if (pet) {
                        if (pet.username !== userLogin) {
                            message = "You do not have permission to update this pet";
                        } else {

                            // Updated pet with fields that need to be updated
                            let updatedPet = {
                                Pet_Name: petName,
                                Pet_Type: type,
                                Age: petAge,
                                Gender: petGender,
                                Breed: breed,
                                Size: petSize,
                                Bio: bio,
                                Prompt1: prompt1,
                                Prompt2: prompt2,
                                Contact_Email: contactEmail,
                                Location: location,
                                AdoptionFee: adoptionFee
                            };

                            // If images are included, then update, otherwise leave it the same as before
                            // Max of 3 images, will create empty placeholders if less than 3 images are provided
                            if (req.files) {
                                let petImages = req.files.map(file => `uploads/${file.filename}`);
                                while (petImages.length < 3) {
                                    petImages.push('');
                                }
                                updatedPet.Images = petImages;
                                if (req.files.length > 3) {
                                    imageMessage = "Only the first 3 images were added.";
                                }
                            }

                            // Makes sure the colors are correct and picked out of the predfined list, then adds to updatedPet
                            const validColors = Array.isArray(colors) ? colors.filter(color => allowedColors.includes(color)) : [];
                            if (validColors.length > 0) {
                                updatedPet.Color = validColors;
                            }

                            // If fields are left blank, keep original data for those fields
                            updatedPet = JSON.parse(JSON.stringify(updatedPet));

                            // Set the updated pet description
                            const result = await db.collection('Pet').updateOne(
                                { _id: objectId },
                                { $set: updatedPet }
                            );

                            if (result.modifiedCount === 0) {
                                message = "No changes made to the pet information";
                            } else {
                                message = "Pet information updated successfully";
                            }
                        }
                    } else {
                        message = "Pet not found";
                    }
                } catch (e) {
                    message = e.toString();
                }
                let refreshedToken = token.refresh(jwtToken);
                let ret = { imageMessage: imageMessage, message: message, jwtToken: refreshedToken.accessToken };
                res.status(200).json(ret);
            }
        });
    });

    // Search Pet API Endpoint that uses the fields of the pet descriptions (like color, breed, age, etc.)
    app.post("/api/searchpet", async (req, res, next) => {
        // incoming: userLogin, type, petAge, petGender, colors, breed, petSize, location
        // outgoing: matching pets

        const { userLogin, type, petAge, petGender, colors, breed, petSize, location, jwtToken } = req.body;
        let message = '';

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: jwtToken };
            res.status(200).json(ret);
            return;
        }

        try {
            // Connect to database
            const db = client.db(dbName);

            // Used to find the user so that we can check their favorites list
            const user = await db.collection('User').findOne({ username: userLogin });
            if (!user) {
                return res.status(200).json({ message: "User not found" });
            }
            // Checks for pets in the user's favorites list so that they don't show up in the search
            const userFavorites = user.Favorites.map(favorite => new ObjectId(favorite));

            // Make sure to get user login so it does not display user's listed pets
            // Make sure the fields are inputted, if not then ignore
            let search = { Login: { $ne: userLogin }, _id: { $nin: userFavorites } };

            if (type != "") search.Pet_Type = type;
            if (petAge != "") search.Age = petAge;
            if (petGender != "") search.Gender = petGender;
            if (breed != "") search.Breed = breed;
            if (petSize != "") search.Size = petSize;
            if (location != "") search.Location = location;

            // If the color is part of the allowed colors, search for pets of that color
            if (Array.isArray(colors) && colors.length > 0) {
                const validColors = colors.filter(color => allowedColors.includes(color));
                if (validColors.length > 0) {
                    // Searches for the color
                    search.Color = { $in: validColors };
                }
            }

            // Search using the fields provided
            const pets = await db.collection('Pet').find(search).toArray();
            if (pets.length === 0) {
                message = "No pets found";
            } else {
                message = "Pets retrieved successfully";
            }
            let refreshedToken = token.refresh(jwtToken);
            res.status(200).json({ pets: pets, message: message, jwtToken: refreshedToken.accessToken });
        } catch (e) {
            message = e.toString();
        }
    });


    // pet inquiry api
    app.post('/api/sendInquiry', async (req, res, next) => {
        // incoming: userLogin, petId, jwtToken
        // outgoing: message, jwtToken

        const { userLogin, petId, jwtToken } = req.body;
        let message = '';

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: jwtToken };
            res.status(200).json(ret);
            return;
        }

        try {
            const db = client.db(dbName);

            // Find inquiring user
            const inquirer = await db.collection('User').findOne({ username: userLogin });
            if (!inquirer) {
                message = 'Inquiring user not found';
                return res.status(200).json({ message: message });
            }

            // Get pet info
            const petObjectId = new ObjectId(petId);
            const pet = await db.collection('Pet').findOne({ _id: petObjectId });
            if (!pet) {
                message = 'Inquired about pet not found';
                return res.status(200).json({ message: message });
            }

            // Get pet's owner's info
            const owner = await db.collection('User').findOne({ username: pet.username });
            if (!owner) {
                message = 'Owner of pet not found';
                return res.status(200).json({ message: message });
            }

            // Make the email
            const transporter = nodemailer.createTransport({
                service: 'gmail',
                auth: {
                    user: process.env.EMAIL_USER,
                    pass: process.env.EMAIL_PASS
                }
            });

            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: owner.email,
                subject: `Inquiry about your pet: ${pet.Pet_Name}`,
                text: `Hello ${owner.firstName},

You have received an inquiry about your pet, ${pet.Pet_Name}.

Here is the contact information of the inquirer:
Name: ${inquirer.firstName} ${inquirer.lastName}
Email: ${inquirer.email}
Phone Number: ${inquirer.phoneNumber}

Here is the information of your pet inquired about:
Name: ${pet.Pet_Name}
Type: ${pet.Pet_Type}
Age: ${pet.Age}
Gender: ${pet.Gender}
Color: ${pet.Color.join(', ')}
Breed: ${pet.Breed}
Size: ${pet.Size}

Please get in touch with the inquirer if you are interested in proceeding.

Best regards,
swiPet`
            }

            // Send email
            await transporter.sendMail(mailOptions);
            message = 'Inquiry email sent';

        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

    // Getters for user's listings/favorites/user info

    app.post('/api/getUserListings', async (req, res) => {
        // incoming: userLogin, jwtToken
        // outgoing: listings, message, jwtToken

        const { userLogin, jwtToken } = req.body;
        let message = '';
        let listings = [];

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        try {

            const db = client.db(dbName);
            // Find user
            const user = await db.collection('User').findOne({ username: userLogin });

            if (user) {
                // Look for pets in user's listings
                listings = await db.collection('Pet').find(
                    { _id: { $in: user.Listings } }).toArray();
                message = 'Listings retrieved successfully';
            }
            else {
                message = 'User not found';
            }

        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { listings: listings, message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

    app.post('/api/getUserFavorites', async (req, res) => {
        // incoming: userLogin, jwtToken
        // outgoing: favorites, message, jwtToken

        const { userLogin, jwtToken } = req.body;
        let message = '';
        let favorites = [];

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        try {

            const db = client.db(dbName);
            // Find user
            const user = await db.collection('User').findOne({ username: userLogin });

            if (user) {
                // Look for pets in user's favorites
                favorites = await await db.collection('Pet').find(
                    { _id: { $in: user.Favorites } }).toArray();
                message = 'Favorites retrieved successfully';
            }
            else {
                message = 'User not found';
            }

        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { favorites: favorites, message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });

    app.post('/api/getUserInfo', async (req, res) => {
        // incoming: userLogin, jwtToken
        // outgoing: userInfo, message

        const { userLogin, jwtToken } = req.body;
        let message = '';
        let userInfo = {};

        if (token.isExpired(jwtToken)) {
            let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
            res.status(200).json(ret);
            return;
        }

        try {
            const db = client.db(dbName);
            const user = await db.collection('User').findOne(
                { username: userLogin }, { projection: { password: 0 } });

            // If user exists, retrieve information
            if (user) {
                userInfo = user;
                message = 'User information retrieved successfully';
            } else {
                message = 'User not found';
            }
        } catch (e) {
            message = e.toString();
        }

        let refreshedToken = token.refresh(jwtToken);
        const ret = { userInfo: userInfo, message: message, jwtToken: refreshedToken.accessToken };
        res.status(200).json(ret);
    });


    // Upload image endpoints
    app.post('/api/uploadUserImage', (req, res) => {

        uploadSingle(req, res, (error) => {
            const { jwtToken } = req.body;

            if (token.isExpired(jwtToken)) {
                let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
                res.status(200).json(ret);
                return;
            }

            if (error) {
                res.status(400).json({ message: error });
            }
            else {
                if (req.file == undefined) {
                    res.status(400).json({ message: 'No file selected' });
                }
                else {
                    const filePath = `uploads/${req.file.filename}`;
                    let refreshedToken = token.refresh(jwtToken);

                    let ret = {
                        message: 'File uploaded',
                        filePath: filePath,
                        jwtToken: refreshedToken.accessToken
                    }
                    res.status(200).json({ ret });
                }
            }
        });
    });

    app.post('/api/uploadPetImages', (req, res) => {

        uploadMultiple(req, res, (error) => {
            const { jwtToken } = req.body;

            if (!jwtToken || token.isExpired(jwtToken)) {
                let ret = { message: 'The JWT is no longer valid', jwtToken: '' };
                res.status(200).json(ret);
                return;
            }

            if (error) {
                res.status(400).json({ message: error });
            } else {
                if (req.files == undefined || req.files.length === 0) {
                    res.status(400).json({ message: 'No files selected' });
                } else {
                    // console.log("Uploaded files:", req.files);
                    const filePaths = req.files.map(file => `uploads/${file.filename}`);
                    let refreshedToken = token.refresh(jwtToken);

                    let ret = {
                        message: 'Files uploaded',
                        filePaths: filePaths,
                        jwtToken: refreshedToken.accessToken
                    };
                    res.status(200).json(ret);
                }
            }
        });
    });

}
