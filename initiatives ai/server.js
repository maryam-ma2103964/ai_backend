const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Recommendations route
app.post('/generate-recommendations', async (req, res) => {
  try {
    const { answers } = req.body;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY not set' });

    const prompt = `You are an expert community organizer. Based on the following preferences, generate 3 unique initiative ideas.
User's Preferences:
- Cause: ${answers.cause || 'Not specified'}
- Scale: ${answers.scale || 'Not specified'}
- Timeline: ${answers.timeline || 'Not specified'}
- Additional: ${answers.additional || 'None'}
Return ONLY a JSON array of exactly 3 objects:
[
  {"title":"Initiative Name","description":"Detailed description here","volunteers":"10-15","timeline":"3-4 weeks","impact":"Positive impact"}
]`;

    const aiResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile', // ✅ Updated to currently supported model
        messages: [
          { role: 'system', content: 'You are an expert community organizer who returns JSON arrays only.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800,
        top_p: 0.9
      },
      {
        headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 60000
      }
    );

    const content = aiResponse.data.choices[0].message.content;
    console.log('Raw AI response:', content);

    // Parse safely
    let recommendations;
    try {
      const cleaned = content.replace(/```json\n?|```\n?/g, '').trim();
      recommendations = JSON.parse(cleaned);
      recommendations = recommendations.slice(0, 3).map(rec => ({
        title: rec.title || 'Unnamed Initiative',
        description: rec.description || 'No description provided',
        volunteers: rec.volunteers || '10-15 needed',
        timeline: rec.timeline || '4-6 weeks planning',
        impact: rec.impact || 'Positive community impact'
      }));
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError.message);
      return res.status(500).json({
        error: 'Failed to parse AI response',
        details: parseError.message,
        raw: content
      });
    }

    res.json({ recommendations });

  } catch (error) {
    console.error('Error generating recommendations:', error.message);
    res.status(500).json({
      error: 'Failed to generate recommendations',
      details: error.response?.data || error.message || 'Unknown error'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => console.log('✅ Server running on port', PORT));