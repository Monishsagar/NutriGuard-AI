const fs = require('fs');

async function main() {
  const env = fs.readFileSync('.env.local', 'utf-8');
  let keyStr = '';
  
  for (const line of env.split('\n')) {
    if (line.startsWith('GEMINI_API_KEY=')) keyStr = line.split('=')[1].trim();
  }

  console.log("Fetching available models...");
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${keyStr}`);
  const data = await res.json();
  
  if (data.error) {
    console.log("Error:", data.error.message);
    return;
  }
  
  const models = data.models
    .filter(m => m.supportedGenerationMethods.includes("generateContent"))
    .map(m => m.name);
  console.log("Available models for generateContent:");
  console.log(models.join('\n'));
}

main().catch(console.error);
