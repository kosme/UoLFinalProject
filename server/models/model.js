const mongoose = require('mongoose');

const dataSchema = new mongoose.Schema({
    timestamp: {
        required: true,
        type: Number,
        unique: true
    },
    data: {
        required: true,
        type: Array
    }
});

module.exports = mongoose.model('Data', dataSchema);