const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();

app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api', require('./routes'));

module.exports = app;
