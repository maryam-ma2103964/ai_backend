const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== MIDDLEWARE ====================
app.use(cors());
app.use(express.json());

// ==================== SMART CACHING ====================
const recommendationCache = new Map();
const CACHE_DURATION = 3600000; // 1 hour

function getCacheKey(answers) {
  return JSON.stringify({
    cause: answers.cause,
    scale: answers.scale,
    timeline: answers.timeline,
  });
}

function getCachedRecommendation(answers) {
  const key = getCacheKey(answers);
  const cached = recommendationCache.get(key);

  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log('✅ Cache hit - instant response!');
    return cached.data;
  }

  if (cached) recommendationCache.delete(key);
  return null;
}

function setCachedRecommendation(answers, recommendations) {
  const key = getCacheKey(answers);
  recommendationCache.set(key, {
    data: recommendations,
    timestamp: Date.now(),
  });

  // Limit cache size
  if (recommendationCache.size > 100) {
    const firstKey = recommendationCache.keys().next().value;
    recommendationCache.delete(firstKey);
  }
}

// ==================== HEALTH CHECK ====================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    cacheSize: recommendationCache.size
  });
});

// ==================== AI-ONLY RECOMMENDATIONS ====================
app.post('/generate-recommendations', async (req, res) => {
  const { answers } = req.body || {};

  // Check cache first
  const cachedRecommendations = getCachedRecommendation(answers);
  if (cachedRecommendations) {
    return res.json({
      recommendations: cachedRecommendations,
      source: 'cache'
    });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'AI API key not configured' });
  }

  try {
    const prompt = `Generate 3 unique community initiatives for: ${answers.cause || 'general'}. Scale: ${answers.scale || 'medium'}. Timeline: ${answers.timeline || '1-3 months'}.

Return ONLY this JSON (no markdown):
[{"title":"Name","description":"Brief description","volunteers":"10-15","timeline":"3-4 weeks","impact":"Expected outcome"}]`;

    const aiResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Return only valid JSON arrays.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500,
        top_p: 0.85
      },
      {
        headers: { 
          'Authorization': `Bearer ${apiKey}`, 
          'Content-Type': 'application/json' 
        },
        timeout: 8000
      }
    );

    const content = aiResponse.data.choices[0].message.content;
    const cleaned = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!jsonMatch) throw new Error('Invalid AI response');

    const recommendations = JSON.parse(jsonMatch[0]).slice(0, 3).map(rec => ({
      title: String(rec.title || 'Community Initiative'),
      description: String(rec.description || 'A meaningful initiative'),
      volunteers: String(rec.volunteers || '10-15'),
      timeline: String(rec.timeline || '4-6 weeks'),
      impact: String(rec.impact || 'Positive impact')
    }));

    setCachedRecommendation(answers, recommendations);

    console.log('✅ AI generated successfully');
    return res.json({ 
      recommendations,
      source: 'ai'
    });

  } catch (error) {
    console.log('❌ AI generation failed:', error.message);
    return res.status(500).json({ error: 'Failed to generate recommendations via AI' });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`⚡ AI-only recommendation mode active`);
  console.log(`📦 Smart caching enabled`);
});
