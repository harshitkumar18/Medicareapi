import fetch from 'node-fetch';

const generateID = () => {
  let id = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    id += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return id;
};

const startConversation = async (req, res) => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'Missing API_KEY in environment' });
    }

    const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
    if (!question) {
      return res.status(400).json({ error: 'question is required' });
    }

    const conversationId = generateID();

    const payload = {
      event: 'user_message',
      conversation: [question],
      key: apiKey,
      id: conversationId,
      settings: {
        language: 'English',
        filters: {
          sources: [
            'scientificArticles',
            'internationalHealthGuidelines',
            'medicineGuidelines',
            'healthline',
            'books'
          ],
          year_start: null,
          year_end: null,
          only_high_quality: false,
          article_types: ['metaAnalysis', 'reviews', 'clinicalTrials', 'other']
        },
        model_type: 'standard'
      }
    };

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const response = await fetch('https://api.backend.medisearch.io/sse/medichat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
        'Connection': 'keep-alive'
      },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(response.status).json({ event: 'error', data: errorText });
    }

    const stream = response.body;
    let buffer = '';
    let finalResponse = '';
    let responded = false;

    stream.on('data', (chunk) => {
      buffer += chunk.toString('utf8');
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line.startsWith('data: ')) continue;
        const content = line.substring(6);
        try {
          const message = JSON.parse(content);
          if (message.event === 'llm_response') {
            finalResponse = message.data || finalResponse;
          } else if (message.event === 'articles') {
            if (!responded) {
              responded = true;
              const articlesInput = Array.isArray(message.data) ? message.data : [];
              const tldrs = articlesInput
                .map(a => (typeof a?.tldr === 'string' ? a.tldr.trim() : ''))
                .filter(s => s.length > 0);
              const llmText = tldrs.length > 0 ? tldrs.join('\n') : (finalResponse || '');

              const articles = articlesInput.map(a => ({
                title: typeof a?.title === 'string' ? a.title : '',
                url: typeof a?.url === 'string' ? a.url : '',
                authors: Array.isArray(a?.authors) ? a.authors.filter(Boolean) : [],
                year: (a?.year || a?.publication_date || '').toString()
              }));

              res.json({ llm_response: llmText, articles });
            }
          } else if (message.event === 'error') {
            if (!responded) {
              responded = true;
              res.status(500).json(message);
            }
          }
        } catch (e) {
          // ignore JSON parse errors for non-data lines
        }
      }
    });

    stream.on('end', () => {
      if (!responded) {
        res.status(500).json({ event: 'error', data: 'Stream ended before articles event' });
      }
    });

    stream.on('error', (err) => {
      if (!responded) {
        res.status(502).json({ event: 'error', data: err.message });
      }
    });
  } catch (error) {
    const isAbort = error?.name === 'AbortError';
    res.status(500).json({ event: 'error', data: isAbort ? 'Upstream timeout' : error.message });
  }
};

export { startConversation };
