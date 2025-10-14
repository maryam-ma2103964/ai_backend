// Log startup immediately
console.log('=== SERVER STARTING ===');
console.log('Node version:', process.version);
console.log('Environment:', process.env.NODE_ENV || 'development');

// Catch all uncaught errors
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

// Now require modules
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

app.post('/generate-recommendations', async (req, res) => {
  try {
    const { answers } = req.body;

    // Build a detailed prompt based on user's answers
    const prompt = `You are an expert community organizer and initiative planner. Based on the following preferences, generate 3 unique, creative, and impactful initiative ideas.

User's Preferences:
- Cause/Passion: ${answers.cause}
- Initiative Scale: ${answers.scale}
- Timeline: ${answers.timeline}
- Additional Requirements: ${answers.additional || 'None specified'}

For each initiative, provide:
1. A creative and engaging title
2. A detailed description (2-3 sentences) explaining the initiative, its goals, and how it will be executed
3. Number of volunteers needed (be specific based on the scale)
4. Planning timeline (realistic based on the user's timeline preference)
5. Expected impact (specific and measurable)

IMPORTANT: 
- Make the initiatives relevant to the cause: ${answers.cause}
- Scale them appropriately for: ${answers.scale}
- Ensure they can be planned within: ${answers.timeline}
- Consider any additional requirements: ${answers.additional || 'None'}
- Make each initiative unique and different from each other
- Be creative and think outside the box
- Focus on practical, actionable initiatives that can realistically be organized

Return ONLY a valid JSON array with exactly 3 objects, each containing these fields:
- title (string)
- description (string)
- volunteers (string, e.g., "15-20 needed")
- timeline (string, e.g., "4-6 weeks planning")
- impact (string)

Example format:
[
  {
    "title": "Initiative Name",
    "description": "Detailed description here...",
    "volunteers": "10-15 needed",
    "timeline": "3-4 weeks planning",
    "impact": "Specific measurable impact"
  }
]`;

    console.log('Sending request to Groq API...');
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'mixtral-8x7b-32768',
        messages: [
          {
            role: 'system',
            content: 'You are an expert community organizer who creates innovative, practical initiative ideas. You always respond with valid JSON arrays only, no extra text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.8,
        max_tokens: 2500,
        top_p: 0.9
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    console.log('Received response from Groq:', content);
    
    // Parse the AI response
    let recommendations;
    try {
      // Remove markdown code blocks if present
      let cleanedContent = content.trim();
      
      // Remove ```json and ``` markers
      cleanedContent = cleanedContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Parse the JSON
      recommendations = JSON.parse(cleanedContent);
      
      // Validate the response
      if (!Array.isArray(recommendations) || recommendations.length === 0) {
        throw new Error('Invalid recommendations format');
      }
      
      // Ensure each recommendation has all required fields
      recommendations = recommendations.slice(0, 3).map(rec => ({
        title: rec.title || 'Unnamed Initiative',
        description: rec.description || 'No description provided',
        volunteers: rec.volunteers || '10-15 needed',
        timeline: rec.timeline || '4-6 weeks planning',
        impact: rec.impact || 'Positive community impact'
      }));
      
      console.log('Successfully parsed recommendations:', recommendations);
      
    } catch (parseError) {
      console.error('Error parsing AI response:', parseError);
      console.error('Raw content:', content);
      
      throw new Error('Failed to parse AI response');
    }

    res.json({ recommendations });
    
  } catch (error) {
    console.error('Error generating recommendations:', error.response?.data || error.message);
    
    res.status(500).json({ 
      error: 'Failed to generate recommendations',
      message: error.message 
    });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

console.log('Setting up server listener...');

// Try to start the server
try {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('✅ ================================');
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`✅ Groq API Key configured: ${process.env.GROQ_API_KEY ? 'Yes' : 'No'}`);
    console.log('✅ ================================');
  });

  server.on('error', (error) => {
    console.error('❌ Server error:', error);
    console.error('Error code:', error.code);
    console.error('Error message:', error.message);
    process.exit(1);
  });
} catch (error) {
  console.error('❌ Failed to start server:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
}

console.log('Server setup complete, waiting for connections...');