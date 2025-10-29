// backend/routes/assistantRoutes.js
const express = require('express');
const { chatWithAssistant,listAvailableModels} =  require('../controllers/assistantController.js');

const router = express.Router();

// POST /api/assistant/chat
router.post("/chat", chatWithAssistant);
router.get("/models", listAvailableModels);



module.exports = router;
