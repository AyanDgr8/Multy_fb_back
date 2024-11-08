// src/app.js

import express from "express";
import cors from "cors";
import router from './routes/router.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandling.js';
import morgan from "morgan"; 
import { logger } from './logger.js';

const app = express();

const allowedOrigins = ['http://localhost:3000', 'https://localhost:3000', 'https://10.5.48.190:3000',
                        'https://139.84.166.108:3000', 'http://139.84.166.108:3000', 
                        'https://crm.voicemeetme.net:3000', 'https://crm.voicemeetme.net'
                      ]; // Add frontend URL

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin, like mobile apps or curl requests
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true, // Allow credentials
  optionsSuccessStatus: 200 // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

// Use Morgan for logging HTTP requests
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/", router);

// Middleware for handling 404 errors
app.use(notFoundHandler);

// Middleware for handling errors
app.use(errorHandler);

export { app };