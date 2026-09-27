-- ============================================================
-- SEED DATA — Default configuration
-- ============================================================

-- Default settings
INSERT INTO settings (key, value, description) VALUES
('ai_provider',           '"ollama"',                                    'AI provider: ollama | cloudflare | manual'),
('ai_base_url',           '"http://localhost:11434"',                    'Ollama base URL'),
('ai_model',              '"llama3.2"',                                  'Default LLM model'),
('embedding_model',       '"nomic-embed-text"',                          'Embedding model'),
('image_model',           '"stable-diffusion"',                          'Image generation model'),
('auto_research',         'true',                                        'Run research automatically'),
('auto_create',           'false',                                       'Create products automatically'),
('auto_qa',               'true',                                        'Run QA automatically'),
('auto_publish',          'false',                                       'Publish automatically (default OFF)'),
('auto_price',            'true',                                        'Set price automatically'),
('products_per_day',      '3',                                           'Max products to create per day'),
('max_daily_ai_calls',    '200',                                         'Max AI API calls per day'),
('min_opportunity_score', '70',                                          'Minimum score to proceed'),
('min_qa_score',          '85',                                          'Minimum QA score to publish'),
('max_revisions',         '3',                                           'Max automatic revisions'),
('default_currency',      '"USD"',                                       'Default currency'),
('default_product_price', '27.00',                                       'Default product price'),
('research_frequency',    '"0 6 * * *"',                                 'Research cron schedule'),
('scoring_weights',       '{"demand":0.20,"buyer_intent":0.20,"problem_severity":0.15,"differentiation":0.15,"price_potential":0.10,"trend_momentum":0.10,"competition_opportunity":0.10}', 'Opportunity scoring weights')
ON CONFLICT (key) DO NOTHING;

-- Default publishing channels (upsert by channel_type)
INSERT INTO publishing_channels (name, channel_type, enabled, config) VALUES
('Own Store',  'OWN_STORE', true,  '{"url": "http://localhost:3000/store"}'),
('Manual',     'MANUAL',    true,  '{}'),
('Gumroad',    'GUMROAD',   false, '{}'),
('Payhip',     'PAYHIP',    false, '{}')
ON CONFLICT (channel_type) DO NOTHING;

-- Default prompt templates
INSERT INTO prompt_templates (name, version, purpose, template, model, temperature, active) VALUES

('market_research', 1, 'Generate market research opportunities from a keyword',
'You are a market research analyst. Given the keyword "{{keyword}}" in the niche "{{niche}}", identify the core customer problem, target customer, demand evidence, and competition level.

Respond ONLY with a valid JSON object — no prose, no markdown:
{
  "problem": "one sentence description of the core problem",
  "target_customer": "who specifically experiences this problem",
  "evidence": "what signals show demand for a solution",
  "demand_signal": 7,
  "competition_signal": 4
}

Base your analysis on general market knowledge. Do not fabricate statistics.',
NULL, 0.7, true),

('opportunity_scoring', 1, 'Score a product opportunity',
'You are a digital product business analyst. Score this opportunity:

Keyword: {{keyword}}
Niche: {{niche}}
Problem: {{problem}}
Target Customer: {{target_customer}}
Evidence: {{evidence}}

Respond ONLY with a valid JSON object — no prose, no markdown. All values must be integers 0-100:
{
  "demand_score": 75,
  "competition_score": 65,
  "problem_severity": 80,
  "buyer_intent": 70,
  "creation_difficulty": 60,
  "production_cost": 90,
  "price_potential": 65,
  "differentiation_potential": 70,
  "seasonality": 75,
  "trend_momentum": 70
}

These are internal decision-support scores only.',
NULL, 0.5, true),

('product_idea_generation', 1, 'Generate 3 product concepts for an opportunity',
'You are a digital product creator. Generate exactly 3 product concepts for this opportunity.

Niche: {{niche}}
Problem: {{problem}}
Target Customer: {{target_customer}}
Demand Evidence: {{evidence}}

Respond ONLY with a valid JSON array of exactly 3 objects. No prose, no markdown, no explanation before or after.

Each object MUST use exactly these keys:
- "title": short product name (string)
- "product_type": exactly one of: PDF_GUIDE, EBOOK, CHECKLIST, WORKBOOK, TEMPLATE, SPREADSHEET_TEMPLATE, PROMPT_PACK, FINANCIAL_TRACKER, CONTENT_CALENDAR, RESOURCE_LIBRARY
- "unique_value": one sentence describing the unique benefit (string)
- "estimated_price": price in USD as a number, e.g. 37
- "estimated_creation_time": hours to create as a number, e.g. 4
- "difficulty": difficulty 1-10 as a number, e.g. 5
- "differentiation_strategy": one sentence on how it stands out (string)

Example of correct output format (replace with real content for the actual niche):
[
  {
    "title": "Freelancer Client Onboarding Kit",
    "product_type": "TEMPLATE",
    "unique_value": "Saves freelancers 3 hours per client with ready-to-send contracts, welcome emails, and project briefs.",
    "estimated_price": 37,
    "estimated_creation_time": 5,
    "difficulty": 4,
    "differentiation_strategy": "The only kit that includes editable Notion and Google Docs versions with built-in automation instructions."
  },
  {
    "title": "90-Day Content Calendar for Coaches",
    "product_type": "CONTENT_CALENDAR",
    "unique_value": "Gives coaches 90 days of pre-planned social media content mapped to their sales funnel stages.",
    "estimated_price": 27,
    "estimated_creation_time": 6,
    "difficulty": 3,
    "differentiation_strategy": "Integrates engagement hooks and call-to-action formulas that other calendars omit."
  },
  {
    "title": "Side Hustle Income Tracker",
    "product_type": "SPREADSHEET_TEMPLATE",
    "unique_value": "Automatically calculates monthly profit, tax estimates, and goal progress for side hustlers.",
    "estimated_price": 17,
    "estimated_creation_time": 3,
    "difficulty": 3,
    "differentiation_strategy": "Built-in tax estimation dashboard that competitors charge $97 for separately."
  }
]

Now generate 3 real concepts for the niche above. Output ONLY the JSON array.',
NULL, 0.8, true),

('product_content_generation', 1, 'Generate complete product content',
'You are an expert digital product creator. Write the full content for a {{product_type}} titled "{{title}}" targeting {{target_customer}}.

Problem it solves: {{problem}}
Unique value: {{unique_value}}
Niche: {{niche}}

Respond ONLY with a single valid JSON object — no markdown, no prose, no explanation before or after.

IMPORTANT: The keys inside "sections" must EXACTLY match the strings in "outline".

Output this exact structure:
{
  "outline": ["Section Title 1", "Section Title 2", "Section Title 3", "Section Title 4"],
  "sections": {
    "Section Title 1": {
      "intro": "2-3 sentence introduction that explains why this section matters and what the reader will gain.",
      "key_points": [
        "First important concept or insight, explained in one complete sentence.",
        "Second important concept or insight, explained in one complete sentence.",
        "Third important concept or insight, explained in one complete sentence."
      ],
      "steps": [
        "Step one: specific action the reader takes, with enough detail to act on immediately.",
        "Step two: the next concrete action, building on step one.",
        "Step three: how to complete or verify this section of the work."
      ],
      "exercise": "A hands-on activity the reader does right now. Be specific: tell them exactly what to write, calculate, or create. Example: Write down your top 3 priorities for this week and rank them by impact.",
      "takeaway": "The single most important thing to remember from this section, written as a clear, memorable statement."
    },
    "Section Title 2": { ... same structure ... },
    "Section Title 3": { ... same structure ... },
    "Section Title 4": { ... same structure ... }
  },
  "faq": [
    {"q": "A real question the target customer would ask before buying.", "a": "A thorough, reassuring 2-3 sentence answer."},
    {"q": "A question about how long this takes or what is required.", "a": "A concrete, honest answer with a timeframe or effort estimate."},
    {"q": "A question about customization or if it works for their specific situation.", "a": "An answer that confirms flexibility and gives one example."}
  ],
  "quick_start": "Tell the reader exactly what to do in the next 5 minutes to begin. Be specific and action-oriented — not vague. Example: Open page 1, read the intro, then complete the Exercise in Section 1 before moving on.",
  "usage_guide": "Explain how to get the most value from this product over time. Mention frequency, order, and any tips for applying it to real situations.",
  "instructions": "Step-by-step instructions for a first-time user of this PDF guide only — how to navigate the PDF, in what order to read the sections, and what to do when finished. Do NOT reference any external files, spreadsheets (.xlsx), Word documents (.docx), zip files, or companion files that are not part of this PDF."
}

Write every field with real, specific content tailored to the actual title, niche, and customer — never use placeholder text like Section Title 1 or ellipsis.',
NULL, 0.7, true),

('product_marketing_copy', 1, 'Generate marketing copy for a product',
'You are a copywriter specializing in digital products. Write marketing copy for:

Title: {{title}}
Type: {{product_type}}
Target Customer: {{target_customer}}
Problem Solved: {{problem}}
Unique Value: {{unique_value}}

Respond ONLY with a single valid JSON object — no markdown, no prose, no explanation. Use exactly these keys:
{
  "sales_description": "150-word sales description",
  "short_description": "One sentence summary",
  "bullet_points": ["Benefit 1", "Benefit 2", "Benefit 3", "Benefit 4", "Benefit 5"],
  "tags": ["tag1", "tag2", ...],
  "keywords": ["keyword1", "keyword2", ...],
  "subtitle": "Compelling subtitle",
  "upsell_ideas": ["Idea 1", "Idea 2", "Idea 3"],
  "cross_sell_ideas": ["Idea 1", "Idea 2", "Idea 3"]
}

No fake testimonials, no false claims, no misleading earnings promises.',
NULL, 0.8, true),

('qa_review', 1, 'Quality control review of product content',
'You are a quality control reviewer for digital products. Review this product:

Title: {{title}}
Type: {{product_type}}
Content Summary: {{content_summary}}

Score each area 0-100. passed = score >= 70.

Respond ONLY with a single valid JSON object — no markdown, no prose. Use exactly this structure:
{
  "overall_score": 85,
  "checks": [
    {"type": "content_completeness", "score": 80, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "readability",          "score": 85, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "grammar",              "score": 90, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "structure",            "score": 80, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "instruction_clarity",  "score": 75, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "copyright_risk",       "score": 95, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "misleading_claims",    "score": 95, "passed": true, "message": "...", "severity": "INFO"},
    {"type": "safety_risk",          "score": 100,"passed": true, "message": "...", "severity": "INFO"}
  ]
}',
NULL, 0.3, true),

('revision_instructions', 1, 'Generate revision instructions for failed QA',
'A digital product failed quality control. Generate specific revision instructions.

Product: {{title}}
QA Issues:
{{qa_issues}}

Respond ONLY with a single valid JSON object — no markdown, no prose. Use exactly these keys:
{
  "priority_fixes": ["Fix 1", "Fix 2"],
  "recommended_improvements": ["Improvement 1", "Improvement 2"],
  "rewrite_instructions": ["Instruction 1", "Instruction 2"]
}',
NULL, 0.5, true),

('performance_analysis', 1, 'Analyze product performance and generate insights',
'Analyze this digital product performance data and generate insights:

{{performance_data}}

Identify:
1. What is working well
2. What needs improvement
3. Patterns in successful products
4. Recommendations for future products

IMPORTANT: Label each insight as:
- OBSERVATION: Something clearly visible in the data
- POSSIBLE_PATTERN: A trend that may exist but needs more data
- REQUIRES_MORE_DATA: Insufficient data to conclude

Do not claim causation from correlation. Respond in JSON format.',
NULL, 0.6, true)

ON CONFLICT (name, version) DO NOTHING;

-- Demo admin user — bcrypt hash of a placeholder password.
-- Change via Dashboard → Settings or re-hash your own password with bcryptjs.
INSERT INTO users (email, password_hash, name, role) VALUES
('admin@factory.local', '$2b$10$rOzJqQZQZQZQZQZQZQZQZuKKKKKKKKKKKKKKKKKKKKKKKKKKKKKKK', 'Admin', 'admin')
ON CONFLICT (email) DO NOTHING;
