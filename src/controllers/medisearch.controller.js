import WebSocket from 'ws';

const generateID = () => {
  let id = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
};

const startConversation = (req, res) => {
  const apiKey = process.env.API_KEY; // Use your actual API key
  const question = req.body.question;
  const conversationId = generateID();

  const userConversation = {
    event: "user_message",
    conversation: [question],
    key: apiKey,
    id: conversationId,
    settings: {
      language: "English"
    }
  };

  const ws = new WebSocket('wss://public.backend.medisearch.io:443/ws/medichat/api');
  let finalResponse = '';

  ws.on('open', () => {
    ws.send(JSON.stringify(userConversation));
  });

  ws.on('message', (data) => {
    const jsonData = JSON.parse(data.toString('utf8'));

    if (jsonData.event === "llm_response") {
      finalResponse = jsonData.text; // Always store the latest message
    } else if (jsonData.event === "articles") {
      // Find the first occurrence of '[' and trim everything after it
      const bracketIndex = finalResponse.indexOf('[');
      if (bracketIndex !== -1) {
        finalResponse = finalResponse.substring(0, bracketIndex).trim() + '.';
      }
      
      // Once articles are received, consider the finalResponse to be complete
      res.json({ llm_response: finalResponse, articles: jsonData.articles });
      ws.close();
    } else if (jsonData.event === "error") {
      res.status(500).json(jsonData);
      ws.close();
    }
  });

  ws.on('error', (error) => {
    res.status(500).json({ error: error.message });
  });
};

export { startConversation };
