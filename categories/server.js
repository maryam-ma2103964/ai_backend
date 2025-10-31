const express = require('express');
const cors = require('cors');
const Groq = require('groq-sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 10000;

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
});

// Middleware
app.use(cors());
app.use(express.json());

// Expanded valid categories
const VALID_CATEGORIES = [
  'Community Service',
  'Environmental',
  'Health Care',
  'Education',
  'Animals',
  'Sports',
  'Charity',
  'Technology',
  'Youth Empowerment',
  'Women Empowerment',
  'Cultural Preservation',
  'Arts and Music',
  'Disability Support',
  'Human Rights',
  'Poverty Alleviation',
  'Elderly Care',
  'Disaster Relief',
  'Mental Health',
  'Food Security',
  'Water and Sanitation',
  'Social Innovation',
  'Entrepreneurship',
  'STEM Education',
  'Digital Literacy',
  'Civic Engagement',
  'Public Safety',
  'Peacebuilding',
  'Refugee Support',
  'Homelessness',
  'Child Welfare',
  'Family Support',
  'Employment and Training',
  'Transportation Assistance',
  'Rural Development',
  'Urban Development',
  'Sustainable Agriculture',
  'Climate Change Action',
  'Gender Equality',
  'Crisis Response',
  'Advocacy and Awareness',
  'Research and Development',
  'Cultural Exchange',
  'Rehabilitation and Recovery',
  'Innovation and Technology for Good'
];

// Create system instruction text dynamically
const categoryListText = VALID_CATEGORIES.map(c => `- ${c}`).join('\n');

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'API is running',
    timestamp: new Date().toISOString(),
    categoryCount: VALID_CATEGORIES.length
  });
});

// Classification endpoint
app.post('/classify-initiative', async (req, res) => {
  try {
    const { name, description } = req.body;

    // Validation
    if (!name || !description) {
      return res.status(400).json({
        error: 'Both name and description are required',
        category: '' // Leave empty
      });
    }

    console.log(`Classifying: "${name}"`);

    // Call GROQ API
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: `You are a volunteer initiative classifier. Classify each initiative into ONE of the following categories ONLY:
${categoryListText}

Respond with ONLY the category name, nothing else. If uncertain, respond with an empty string.`
        },
        {
          role: 'user',
          content: `Initiative Name: ${name}\nDescription: ${description}`
        }
      ],
      model: 'llama3-8b-8192',
      temperature: 0.3,
      max_tokens: 20,
    });

    let category = chatCompletion.choices[0]?.message?.content?.trim();

    // Validate and clean the response
    if (!category || !VALID_CATEGORIES.includes(category)) {
      console.log(`⚠️ Could not determine category, leaving it empty`);
      category = '';
    }

    console.log(`✅ Classified as: ${category || '(none)'}`);

    res.json({ category });

  } catch (error) {
    console.error('Error classifying initiative:', error.message);

    // Return empty category on error
    res.status(200).json({
      category: '',
      error: error.message
    });
  }
});

// Batch classification endpoint (for Excel imports)
app.post('/classify-batch', async (req, res) => {
  try {
    const { initiatives } = req.body;

    if (!Array.isArray(initiatives) || initiatives.length === 0) {
      return res.status(400).json({
        error: 'initiatives array is required'
      });
    }

    console.log(`Batch classifying ${initiatives.length} initiatives`);

    const results = await Promise.all(
      initiatives.map(async (item) => {
        try {
          const chatCompletion = await groq.chat.completions.create({
            messages: [
              {
                role: 'system',
                content: `Classify each initiative into ONE of the following categories ONLY:
${categoryListText}

Respond with ONLY the category name, nothing else. If uncertain, respond with an empty string.`
              },
              {
                role: 'user',
                content: `Initiative Name: ${item.name}\nDescription: ${item.description}`
              }
            ],
            model: 'llama3-8b-8192',
            temperature: 0.3,
            max_tokens: 20,
          });

          let category = chatCompletion.choices[0]?.message?.content?.trim();

          if (!VALID_CATEGORIES.includes(category)) {
            category = '';
          }

          return {
            id: item.id,
            category
          };
        } catch (error) {
          console.error(`Error classifying ${item.name}:`, error.message);
          return {
            id: item.id,
            category: ''
          };
        }
      })
    );

    console.log(`✅ Batch classification complete`);
    res.json({ results });

  } catch (error) {
    console.error('Batch classification error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📡 Classification endpoint: POST /classify-initiative`);
  console.log(`📡 Batch endpoint: POST /classify-batch`);
});
