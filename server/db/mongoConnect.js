const mongoose = require('mongoose');

// Load the MongoDB URI from environment variables
const mongoURI = process.env.MONGODB_URI; // Ensure this matches the .env key

const mongoConnect = async () => {
    if (!mongoURI) {
        console.error("MONGODB_URI is undefined. Please check your .env file.");
        return;
    }

    try {
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('Connected to MongoDB');

    } catch (err) {
        console.error('Error connecting to MongoDB:', err);
    }
};

module.exports = mongoConnect;
