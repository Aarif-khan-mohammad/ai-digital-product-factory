-- Update the product_content_generation prompt template to constrain
-- instructions to PDF-only, removing any references to .xlsx/.docx companion files.
UPDATE prompt_templates
SET template = REPLACE(
  template,
  '"instructions": "Step-by-step instructions for a first-time user: how to navigate the product, in what order to work through it, and what to do when finished."',
  '"instructions": "Step-by-step instructions for a first-time user of this PDF guide only — how to navigate the PDF, in what order to read the sections, and what to do when finished. Do NOT reference any external files, spreadsheets (.xlsx), Word documents (.docx), zip files, or companion files that are not part of this PDF."'
)
WHERE name = 'product_content_generation' AND active = true;

SELECT name, version, LEFT(template, 200) AS template_preview
FROM prompt_templates
WHERE name = 'product_content_generation';
