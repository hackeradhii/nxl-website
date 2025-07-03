// NXL Technologies - Node.js/Express.js Backend Server
// This server is now configured to use Neon Serverless PostgreSQL with robust connection handling.

require('dotenv').config(); // Load environment variables from .env file at the very top.
const express = require('express');
const cors = require('cors');
const { createClient } = require('@sanity/client');
const { Pool } = require('pg');

// --- CONFIGURATION ---
const PORT = process.env.PORT || 3001;

// ** CRITICAL **: Check for the database connection string.
if (!process.env.DATABASE_URL) {
    console.error("\nFATAL ERROR: DATABASE_URL is not defined.");
    console.error("Please create a file named '.env' in the 'backend' directory.");
    console.error("Add this line to it: DATABASE_URL=\"YOUR_NEON_CONNECTION_STRING_HERE\"\n");
    process.exit(1); // Exit the process with an error code.
}

// Sanity Client Configuration
const sanityClient = createClient({
  projectId: 'yse6ob65', // This should be your actual Sanity project ID
  dataset: 'production',
  apiVersion: '2024-07-01',
  useCdn: true, 
});

// --- NEON DATABASE CONNECTION ---
// The connection string is now securely loaded from the .env file.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Neon requires SSL. This is the standard configuration.
  ssl: {
    rejectUnauthorized: false,
  },
});

// --- INITIALIZE APP ---
const app = express();

// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json());

// --- API ROUTES ---

// Endpoint to fetch all website content from Sanity
app.get('/api/data', async (req, res) => {
  console.log('GET /api/data request received - Fetching from Sanity.io');
  const query = `*[_type == "siteConfig"][0]{
    "hero": hero,
    "about": about,
    "services": *[_type == "service"] | order(orderRank asc) { "id": id.current, title, icon, description, details, list },
    "process": *[_type == "processStep"] | order(id asc) { id, title, icon, description },
    "contact": contact,
    "careers": careers
  }`;

  try {
    const data = await sanityClient.fetch(query);
    if (!data) {
        return res.status(404).json({ error: 'Site configuration not found in CMS.' });
    }
    res.status(200).json(data);
  } catch (error) {
    console.error('Sanity fetch Error:', error);
    res.status(500).json({ error: 'Internal Server Error. Failed to retrieve site data from CMS.' });
  }
});

// Endpoint to handle contact form submissions
app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;
    console.log('POST /api/contact request received with data:', { name, email });

    if (!name || !email || !message) {
        return res.status(400).json({ success: false, message: 'All fields are required.' });
    }

    try {
        const queryText = 'INSERT INTO submissions(name, email, message) VALUES($1, $2, $3) RETURNING *';
        const queryValues = [name, email, message];
        const result = await pool.query(queryText, queryValues);
        console.log('Submission saved to Neon database:', result.rows[0]);

        res.status(200).json({ success: true, message: 'Your message has been sent successfully!' });

    } catch (error) {
        console.error('Database insertion error:', error);
        res.status(500).json({ success: false, message: 'A server error occurred. Please try again later.' });
    }
});


// --- START SERVER ---
const startServer = async () => {
    try {
        // Test the database connection on startup
        const client = await pool.connect();
        console.log('Successfully connected to Neon Serverless PostgreSQL.');
        client.release();

        app.listen(PORT, () => {
            console.log(`NXL Technologies backend server is running on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("\n--- DATABASE CONNECTION FAILED ---");
        console.error("Could not connect to the database. Please check the following:");
        console.error("1. The DATABASE_URL in your 'backend/.env' file is correct.");
        console.error("2. Your computer has an active internet connection.");
        console.error("3. There are no firewalls blocking the connection to Neon.\n");
        console.error("Original Error:", error.message);
        process.exit(1);
    }
};

startServer();
