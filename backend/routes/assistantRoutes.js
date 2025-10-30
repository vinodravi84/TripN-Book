// backend/routes/assistantRoutes.js
const express = require('express');
const { chatWithAssistant,confirmPaymentAndCreateBooking} =  require('../controllers/assistantController.js');

const router = express.Router();

// POST /api/assistant/chat
router.post("/chat", chatWithAssistant);
router.post('/confirm-payment', confirmPaymentAndCreateBooking);



module.exports = router;
