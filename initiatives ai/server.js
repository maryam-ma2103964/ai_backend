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
  // Include ALL answers in cache key for proper differentiation
  return JSON.stringify(answers);
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
    // Build detailed prompt with ALL user answers
    const prompt = `Generate 3 unique, specific community initiatives based on these requirements:

Cause: ${answers.cause || 'general community'}
Scale: ${answers.scale || 'medium'}
Main Goal: ${answers.goal || 'community impact'}
Timeline: ${answers.timeline || '1-3 months'}
${answers.additional ? `Additional Requirements: ${answers.additional}` : ''}

IMPORTANT: Pay special attention to any specific requirements mentioned in "Additional Requirements" such as location, venue type, dates, or special considerations.

Return ONLY this JSON format (no markdown, no explanations):
[
  {
    "title": "Specific Initiative Name",
    "description": "Detailed description that addresses the cause, scale, goal, and any additional requirements",
    "volunteers": "10-15 people",
    "timeline": "3-4 weeks",
    "impact": "Expected positive outcome"
  }
]

Make each initiative unique, practical, and tailored to the specific requirements provided.`;

    const aiResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: 'You are a community initiative expert. Return only valid JSON arrays with practical, specific recommendations that carefully consider ALL user requirements including any additional details like location, venue preferences, or special needs.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.8,
        max_tokens: 800,
        top_p: 0.9
      },
      {
        headers: { 
          'Authorization': `Bearer ${apiKey}`, 
          'Content-Type': 'application/json' 
        },
        timeout: 12000
      }
    );

    const content = aiResponse.data.choices[0].message.content;
    const cleaned = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!jsonMatch) throw new Error('Invalid AI response');

    const recommendations = JSON.parse(jsonMatch[0]).slice(0, 3).map(rec => ({
      title: String(rec.title || 'Community Initiative'),
      description: String(rec.description || 'A meaningful initiative'),
      volunteers: String(rec.volunteers || '10-15 people'),
      timeline: String(rec.timeline || '4-6 weeks'),
      impact: String(rec.impact || 'Positive community impact')
    }));

    setCachedRecommendation(answers, recommendations);

    console.log('✅ AI generated successfully');
    console.log('Answers considered:', JSON.stringify(answers, null, 2));
    
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