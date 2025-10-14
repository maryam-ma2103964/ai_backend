// ================== SERVER SETUP ==================
console.log('=== SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

process.on('uncaughtException', (error) => {
  console.error('💥 UNCAUGHT EXCEPTION:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 UNHANDLED REJECTION at:', promise);
  console.error('Reason:', reason);
  process.exit(1);
});

console.log('Loading modules...');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();
console.log('Modules loaded successfully');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('PORT:', PORT);
console.log('GROQ_API_KEY present:', !!process.env.GROQ_API_KEY);
console.log('GROQ_API_KEY length:', process.env.GROQ_API_KEY?.length || 0);

app.use(cors());
app.use(express.json());

// ================== HEALTH CHECK ==================
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ================== RECOMMENDATION ROUTE ==================
app.post('/generate-recommendations', async (req, res) => {
  try {
    const { answers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GROQ_API_KEY not set' });
    }

    // ---------- Pre-flight check: Can we reach Groq API? ----------
    try {
      await axios.get('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      });
    } catch (checkError) {
      return res.status(500).json({
        error: 'Cannot reach Groq API',
        details: checkError.message
      });
    }

    // ---------- Build prompt ----------
    const prompt = `You are an expert community organizer and initiative planner. Based on the following preferences, generate 3 unique initiative ideas.
User's Preferences:
- Cause/Passion: ${answers.cause}
- Initiative Scale: ${answers.scale}
- Timeline: ${answers.timeline}
- Additional Requirements: ${answers.additional || 'None specified'}
Return ONLY a valid JSON array with exactly 3 objects:
[
  {
    "title": "Initiative Name",
    "description": "Detailed description here...",
    "volunteers": "10-15 needed",
    "timeline": "3-4 weeks planning",
    "impact": "Specific measurable impact"
  }
]`;

    // ---------- Call Groq API ----------
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'mixtral-8x7b-32768',
        messages: [
          { role: 'system', content: 'You are an expert community organizer who returns JSON arrays only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 2500,
        top_p: 0.9
      },
      { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
    );

    const content = response.data.choices[0].message.content;

    // ---------- Parse JSON safely ----------
    let recommendations;
    try {
      const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
      recommendations = JSON.parse(cleaned);

      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error('Invalid recommendations format');
      }

      recommendations = recommendations.slice(0, 3).map(rec => ({
        title: rec.title || 'Unnamed Initiative',
        description: rec.description || 'No description provided',
        volunteers: rec.volunteers || '10-15 needed',
        timeline: rec.timeline || '4-6 weeks planning',
        impact: rec.impact || 'Positive community impact'
      }));
    } catch (parseError) {
      return res.status(500).json({
        error: 'Failed to parse AI response',
        details: parseError.message
      });
    }

    res.json({ recommendations });

  } catch (error) {
    if (error.response) {
      console.error('Groq API error:', error.response.status, error.response.data);
    } else if (error.request) {
      console.error('No response from Groq API:', error.request);
    } else {
      console.error('Error setting up request:', error.message);
    }

    res.status(500).json({
      error: 'Failed to generate recommendations',
      details: error.response?.data || error.message || 'Unknown error'
    });
  }
});

// ================== START SERVER ==================
try {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ Server running on port', PORT);
  });

  server.on('error', (error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
} catch (error) {
  console.error('Failed to start server:', error);
  process.exit(1);
}
