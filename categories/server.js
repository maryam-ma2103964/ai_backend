require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Comprehensive category list with keywords for better matching
const CATEGORIES = {
  'Environment': [
    'environment', 'sustainability', 'climate', 'recycling', 'pollution',
    'clean', 'green', 'nature', 'conservation', 'wildlife', 'ocean',
    'forest', 'tree', 'plant', 'eco', 'renewable', 'carbon', 'waste',
    'beach', 'park', 'garden', 'biodiversity', 'ecosystem'
  ],
  'Education': [
    'education', 'literacy', 'teaching', 'tutoring', 'school', 'student',
    'learning', 'training', 'workshop', 'mentor', 'academic', 'study',
    'reading', 'writing', 'math', 'science', 'homework', 'library',
    'scholarship', 'university', 'college', 'classroom'
  ],
  'Health': [
    'health', 'medical', 'healthcare', 'hospital', 'clinic', 'doctor',
    'nurse', 'patient', 'wellness', 'fitness', 'mental health', 'therapy',
    'nutrition', 'diet', 'exercise', 'disease', 'medicine', 'blood',
    'donation', 'care', 'support', 'rehabilitation', 'hygiene'
  ],
  'Community Service': [
    'community', 'neighborhood', 'local', 'development', 'housing',
    'infrastructure', 'urban', 'rural', 'village', 'town', 'city',
    'social', 'outreach', 'engagement', 'inclusion', 'diversity'
  ],
  'Poverty': [
    'poverty', 'hunger', 'food', 'homeless', 'shelter', 'meal', 'feeding',
    'donation', 'relief', 'aid', 'assistance', 'charity', 'vulnerable',
    'underprivileged', 'kitchen', 'pantry', 'bank', 'basic needs'
  ],
  'Children & Youth': [
    'children', 'child', 'youth', 'kid', 'teen', 'teenager', 'young',
    'orphan', 'daycare', 'playground', 'recreation', 'after school',
    'summer camp', 'child care', 'parenting', 'family support'
  ],
  'Elderly Care': [
    'elderly', 'senior', 'aging', 'retirement', 'nursing home',
    'care home', 'companionship', 'older adult', 'aged care'
  ],
  'Animal Care': [
    'animal', 'pet', 'wildlife', 'rescue', 'shelter', 'adoption',
    'veterinary', 'zoo', 'sanctuary', 'dog', 'cat', 'bird', 'horse',
    'endangered', 'species', 'marine life', 'aquatic'
  ],
  'Arts & Culture': [
    'art', 'culture', 'music', 'dance', 'theater', 'performance',
    'painting', 'sculpture', 'museum', 'gallery', 'heritage', 'history',
    'festival', 'creative', 'exhibition', 'cultural', 'traditional'
  ],
  'Sports': [
    'sport', 'recreation', 'athletic', 'fitness', 'game', 'tournament',
    'competition', 'team', 'coaching', 'training', 'physical activity',
    'football', 'basketball', 'soccer', 'swimming', 'running', 'cycling'
  ],
  'Technology & Innovation': [
    'technology', 'tech', 'digital', 'computer', 'coding', 'programming',
    'software', 'app', 'website', 'innovation', 'STEM', 'robotics',
    'AI', 'artificial intelligence', 'data', 'cyber', 'internet'
  ],
  'Disaster Relief': [
    'disaster', 'emergency', 'relief', 'crisis', 'rescue', 'response',
    'recovery', 'earthquake', 'flood', 'hurricane', 'fire', 'storm',
    'evacuation', 'first aid', 'search and rescue'
  ],
  'Human Rights': [
    'human rights', 'advocacy', 'justice', 'equality', 'rights',
    'legal aid', 'law', 'policy', 'activism', 'campaign', 'awareness',
    'discrimination', 'freedom', 'empowerment', 'civil rights',
    'women', 'girl', 'female', 'gender', 'women rights', 'maternal', 'feminism'
  ],
  'Disability Support': [
    'disability', 'special needs', 'accessible', 'inclusion',
    'handicap', 'wheelchair', 'blind', 'deaf', 'autism', 'therapy'
  ],
  'Economic Development': [
    'economic', 'entrepreneurship', 'business', 'microfinance',
    'job', 'employment', 'skill', 'vocational', 'trade', 'income'
  ]
};

// Mapping for aliases to correct category names
const CATEGORY_ALIASES = {
  'ai': 'Technology & Innovation',
  'artificial intelligence': 'Technology & Innovation',
  'tech': 'Technology & Innovation',
  'digital': 'Technology & Innovation'
};

// Quick keyword-based categorization (fallback)
function quickCategorize(name, description) {
  const text = `${name} ${description}`.toLowerCase();
  
  for (const [category, keywords] of Object.entries(CATEGORIES)) {
    for (const keyword of keywords) {
      if (text.includes(keyword.toLowerCase())) {
        return category;
      }
    }
  }
  
  return null;
}

// AI (GROQ) categorization with better error handling
async function categorizeWithGroq(name, description, requirements) {
  try {
    const categoryList = Object.keys(CATEGORIES).join('\n- ');
    
    const response = await axios.post(
      'https://api.groq.com/openai/v1/chat/completions',
      {
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content: `You are a categorization expert. Categorize volunteer initiatives into ONE of these categories:

${categoryList}

RULES:
1. Respond with ONLY the category name from the list above
2. Choose the MOST relevant category
3. If absolutely no category fits, respond with exactly: "Community Service"
4. No explanations, no additional text, just the category name`
          },
          {
            role: 'user',
            content: `Initiative Name: ${name}

Description: ${description}

${requirements ? `Requirements: ${JSON.stringify(requirements)}` : ''}

Category:`
          }
        ],
        temperature: 0.1,
        max_tokens: 30
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000 // Increased to 15 seconds
      }
    );

    let category = response.data.choices[0].message.content.trim();
    
    // Log raw response
    console.log('🤖 Raw AI response:', category);

    // Normalize category
    const normalizedCategory = Object.keys(CATEGORIES).find(
      c => c.toLowerCase() === category.toLowerCase()
    );

    if (normalizedCategory) {
      console.log('✅ Normalized to:', normalizedCategory);
      return normalizedCategory;
    }

    // Check aliases
    if (CATEGORY_ALIASES[category.toLowerCase()]) {
      console.log('✅ Found alias:', CATEGORY_ALIASES[category.toLowerCase()]);
      return CATEGORY_ALIASES[category.toLowerCase()];
    }

    console.log('⚠️ Category not found in list:', category);
    return null;

  } catch (error) {
    console.error('❌ GROQ API Error:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return null;
  }
}
// Health check
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'Initiative Categorization Service',
    version: '1.0.0',
    categories: Object.keys(CATEGORIES).length
  });
});

// Main categorization
app.post('/categorize', async (req, res) => {
  try {
    const { name, description, requirements } = req.body;
    if (!name || !description) {
      return res.status(400).json({ success: false, error: 'Missing name or description' });
    }

    console.log(`📥 Categorizing: ${name}`);
    const startTime = Date.now();

    let category = await categorizeWithGroq(name, description, requirements);

    if (!category) {
      console.log('⚡ Using fallback keyword matching');
      category = quickCategorize(name, description);
    }

    const duration = Date.now() - startTime;

    res.json({
      success: true,
      category: category,
      duration_ms: duration,
      method: category ? 'ai' : 'keyword'
    });

  } catch (error) {
    console.error('❌ Categorization error:', error);
    res.status(500).json({ success: false, error: 'Internal server error', category: null });
  }
});

// Batch categorization
app.post('/categorize-batch', async (req, res) => {
  try {
    const { initiatives } = req.body;
    if (!Array.isArray(initiatives)) {
      return res.status(400).json({ success: false, error: 'Expected array of initiatives' });
    }

    const startTime = Date.now();
    const results = await Promise.all(
      initiatives.map(async (init) => {
        let category = await categorizeWithGroq(init.name, init.description, init.requirements);
        if (!category) category = quickCategorize(init.name, init.description);
        return { id: init.id, name: init.name, category };
      })
    );

    const duration = Date.now() - startTime;
    res.json({ success: true, results, total: initiatives.length, duration_ms: duration });

  } catch (error) {
    console.error('❌ Batch categorization error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// Get all categories
app.get('/categories', (req, res) => {
  res.json({ success: true, categories: Object.keys(CATEGORIES), total: Object.keys(CATEGORIES).length });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Categories available: ${Object.keys(CATEGORIES).length}`);
  console.log(`🔑 GROQ API Key: ${process.env.GROQ_API_KEY ? '✓ Configured' : '✗ Missing'}`);
});
