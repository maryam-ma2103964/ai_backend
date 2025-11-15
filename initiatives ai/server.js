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
    // Extract user requirements
    const cause = answers.cause || 'general community';
    const scale = answers.scale || 'medium';
    const timeline = answers.timeline || '1-3 months';
    const additional = answers.additional || '';

    // ✅ ULTRA-STRICT PROMPT THAT ENFORCES ALL REQUIREMENTS
    const prompt = `You are generating community initiative recommendations. You MUST follow ALL requirements EXACTLY as specified below.

════════════════════════════════════════════════════════════
                    MANDATORY USER REQUIREMENTS
                    ⚠️ THESE CANNOT BE VIOLATED ⚠️
════════════════════════════════════════════════════════════

1. CAUSE: ${cause}
   → Every initiative MUST be directly related to "${cause}"
   → Do NOT suggest initiatives for other causes

2. SCALE: ${scale}
   → Volunteer numbers MUST match this scale:
   ${scale.includes('Small') ? '→ Small = 10-50 volunteers' : ''}
   ${scale.includes('Medium') ? '→ Medium = 50-200 volunteers' : ''}
   ${scale.includes('Large') && !scale.includes('Very') ? '→ Large = 200-500 volunteers' : ''}
   ${scale.includes('Very Large') ? '→ Very Large = 500+ volunteers' : ''}

3. TIMELINE: ${timeline}
   → ALL initiatives MUST be executable within: ${timeline}
   → Your "timeline" field MUST say: "${timeline}" or a subset (e.g., "2 days" if user said "1-3 days")
   → NEVER use different time units (days vs weeks vs months)

4. ADDITIONAL REQUIREMENTS: ${additional || 'None specified'}
   ${additional ? `→ THIS IS CRITICAL: You MUST incorporate these specific requirements: "${additional}"` : ''}
   ${additional ? '→ If they mention location, venue, date, or special needs - address ALL of them' : ''}
   ${additional ? '→ Read this carefully and ensure EVERY point is addressed in your recommendations' : ''}

════════════════════════════════════════════════════════════

STRICT VALIDATION CHECKLIST (verify each recommendation):
✓ Is this initiative about ${cause}? (NOT other causes)
✓ Does the volunteer count match ${scale}?
✓ Can this be executed within ${timeline}?
${additional ? `✓ Does this address: "${additional}"?` : ''}
✓ Is this initiative practical and realistic?

Generate 3 DIFFERENT initiatives that meet ALL requirements above.

Return ONLY this JSON format (no markdown, no code blocks, no explanations):
[
  {
    "title": "Specific Initiative Name (related to ${cause})",
    "description": "Detailed description that addresses ${cause}, fits ${scale}, can be done in ${timeline}${additional ? `, and incorporates: ${additional}` : ''}",
    "volunteers": "Number matching ${scale}",
    "timeline": "${timeline}",
    "impact": "Measurable positive outcome"
  }
]

FINAL REMINDER: 
- Cause = ${cause} ONLY
- Scale = ${scale}
- Timeline = ${timeline} EXACTLY
${additional ? `- Special Requirements = ${additional} (MUST BE ADDRESSED)` : ''}`;

    const aiResponse = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.1-8b-instant',
        messages: [
          { 
            role: 'system', 
            content: `You are a precise community initiative expert who STRICTLY follows user requirements.

ABSOLUTE RULES YOU MUST FOLLOW:
1. NEVER suggest initiatives outside the specified cause
2. ALWAYS match volunteer numbers to the specified scale
3. ALWAYS use the EXACT timeline format provided
4. CAREFULLY read and incorporate ALL additional requirements
5. If additional requirements mention specific details (location, venue, dates, family-friendly, etc.) - they are MANDATORY
6. Return ONLY valid JSON - no markdown, no explanations

You will be evaluated on how well you follow these requirements. Deviation = failure.` 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5, // Lower temperature for stricter adherence
        max_tokens: 1000,
        top_p: 0.85
      },
      {
        headers: { 
          'Authorization': `Bearer ${apiKey}`, 
          'Content-Type': 'application/json' 
        },
        timeout: 30000
      }
    );

    const content = aiResponse.data.choices[0].message.content;
    const cleaned = content.trim().replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const jsonMatch = cleaned.match(/\[[\s\S]*\]/);

    if (!jsonMatch) throw new Error('Invalid AI response');

    let recommendations = JSON.parse(jsonMatch[0]).slice(0, 3);
    
    // ✅ COMPREHENSIVE VALIDATION AND ENFORCEMENT
    console.log('\n🔍 VALIDATING AI RECOMMENDATIONS:');
    console.log('═══════════════════════════════════════');
    console.log('Required Cause:', cause);
    console.log('Required Scale:', scale);
    console.log('Required Timeline:', timeline);
    console.log('Additional Requirements:', additional || 'None');
    console.log('═══════════════════════════════════════\n');

    recommendations = recommendations.map((rec, index) => {
      console.log(`Recommendation ${index + 1}: ${rec.title}`);
      
      // Validate and enforce timeline
      let validatedTimeline = String(rec.timeline || timeline);
      const timelineKeyword = timeline.toLowerCase().split(' ')[0]; // e.g., "1-3", "4-7", "within"
      
      if (!validatedTimeline.toLowerCase().includes(timelineKeyword)) {
        console.warn(`  ⚠️  Timeline mismatch! Expected: ${timeline}, Got: ${validatedTimeline}`);
        console.warn(`  ✅ Forcing correct timeline: ${timeline}`);
        validatedTimeline = timeline;
      } else {
        console.log(`  ✅ Timeline correct: ${validatedTimeline}`);
      }

      // Validate cause mention
      const descLower = (rec.description || '').toLowerCase();
      const causeLower = cause.toLowerCase();
      if (!descLower.includes(causeLower) && !rec.title.toLowerCase().includes(causeLower)) {
        console.warn(`  ⚠️  Cause "${cause}" not clearly mentioned in description or title`);
      } else {
        console.log(`  ✅ Cause "${cause}" addressed`);
      }

      // Validate additional requirements if present
      if (additional && additional.trim().length > 0) {
        const additionalLower = additional.toLowerCase();
        const keywords = additionalLower.split(/[\s,]+/).filter(w => w.length > 3);
        let mentionedCount = 0;
        
        keywords.forEach(keyword => {
          if (descLower.includes(keyword) || rec.title.toLowerCase().includes(keyword)) {
            mentionedCount++;
          }
        });
        
        if (mentionedCount === 0) {
          console.warn(`  ⚠️  Additional requirements not addressed: "${additional}"`);
        } else {
          console.log(`  ✅ Additional requirements considered (${mentionedCount}/${keywords.length} keywords found)`);
        }
      }

      console.log(''); // Empty line between recommendations
      
      return {
        title: String(rec.title || 'Community Initiative'),
        description: String(rec.description || 'A meaningful initiative'),
        volunteers: String(rec.volunteers || '10-15 people'),
        timeline: validatedTimeline,
        impact: String(rec.impact || 'Positive community impact')
      };
    });

    setCachedRecommendation(answers, recommendations);

    console.log('✅ VALIDATION COMPLETE - Recommendations ready\n');
    
    return res.json({ 
      recommendations,
      source: 'ai'
    });

  } catch (error) {
    console.log('❌ AI generation failed:', error.message);
    
    if (error.code === 'ECONNABORTED') {
      return res.status(504).json({ 
        error: 'Request timeout - AI service took too long to respond',
        details: 'Please try again'
      });
    }
    
    return res.status(500).json({ 
      error: 'Failed to generate recommendations',
      details: error.message 
    });
  }
});

// ==================== START SERVER ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`⚡ AI-only recommendation mode active`);
  console.log(`📦 Smart caching enabled`);
  console.log(`🎯 ULTRA-STRICT requirement enforcement enabled`);
  console.log(`🔍 Comprehensive validation active`);
});