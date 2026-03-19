const messages = [
  { role: 'user', content: 'What is Heparin?' }
];

async function testChat() {
  try {
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      console.error('Status:', response.status);
      console.error('Text:', await response.text());
      return;
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();
    
    console.log('Response started:');
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      process.stdout.write(decoder.decode(value));
    }
    console.log('\nResponse finished.');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Since we can't easily run next dev and this script together in one turn,
// I will instead try to run a standalone script that calls the logic directly.
