import express from 'express';
import { startConversation } from '../controllers/medisearch.controller.js'; // Update the path as necessary

const router = express.Router();

// Define the route for starting a conversation
router.post('/startConversation', startConversation);

export default router;
