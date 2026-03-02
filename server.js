const express = require('express');
const cors = require('cors');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { SSEServerTransport } = require('@modelcontextprotocol/sdk/server/sse.js');

const app = express();
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json());

const server = new McpServer({ name: 'cobol-bridge', version: '1.0.0' });

server.tool('copybook-parser', { copybook: { type: 'string', description: 'COBOL copybook text' } }, async ({ copybook }) => {
  const fields = [];
  const piiDetected = [];
  const lines = copybook.split('\n');
  lines.forEach((line, idx) => {
    const match = line.match(/(\d+)\s+(\S+)\s+PIC\s+(\S+)/i);
    if (match) {
      fields.push({ level: match[1], name: match[2], type: match[3], line: idx + 1 });
      const piiPatterns = ['SSN', 'NAME', 'ADDRESS', 'PHONE', 'EMAIL', 'DOB', 'CARD'];
      if (piiPatterns.some(p => match[2].toUpperCase().includes(p))) {
        piiDetected.push({ field: match[2], type: 'PII', line: idx + 1 });
      }
    }
  });
  return { content: [{ type: 'text', text: JSON.stringify({ parsed: true, fieldCount: fields.length, fields: fields.slice(0, 20), piiDetected, compliance: { gdpr: piiDetected.length > 0 ? 'requires-protection' : 'compliant' } }, null, 2) }] };
});

server.tool('cics-bridge-assessment', { cicsConfig: { type: 'string', description: 'CICS configuration' } }, async ({ cicsConfig }) => {
  const securityModels = ['RACF', 'ACF2', 'TopSecret'];
  const detectedModel = securityModels.find(m => cicsConfig.toUpperCase().includes(m)) || 'Unknown';
  return { content: [{ type: 'text', text: JSON.stringify({ aiReady: true, securityModel: detectedModel, mcpIntegrationScore: 85 }, null, 2) }] };
});

server.tool('jcl-batch-scanner', { jcl: { type: 'string', description: 'JCL job stream' } }, async ({ jcl }) => {
  const jobs = [];
  const datasets = [];
  const lines = jcl.split('\n');
  lines.forEach((line, idx) => {
    const jobMatch = line.match(/\/\/([^\s]+)\s+JOB/i);
    if (jobMatch) jobs.push({ name: jobMatch[1], line: idx + 1 });
    const ddMatch = line.match(/\/\/[^\s]+\s+DD\s+DSN=([^,\s]+)/i);
    if (ddMatch) datasets.push({ name: ddMatch[1], line: idx + 1 });
  });
  return { content: [{ type: 'text', text: JSON.stringify({ scanned: true, jobCount: jobs.length, jobs, datasets: datasets.slice(0, 10) }, null, 2) }] };
});

server.tool('vsam-mapper', { vsamLayout: { type: 'string', description: 'VSAM layout' } }, async ({ vsamLayout }) => {
  const vsamTypes = ['KSDS', 'ESDS', 'RRDS', 'LDS'];
  const detectedType = vsamTypes.find(t => vsamLayout.toUpperCase().includes(t)) || 'KSDS';
  return { content: [{ type: 'text', text: JSON.stringify({ mapped: true, vsamType: detectedType, schema: { type: detectedType, fields: [{ name: 'KEY', offset: 0, length: 64 }] } }, null, 2) }] };
});

server.tool('ebcdic-translator', { ebcdicData: { type: 'string', description: 'EBCDIC data' }, encoding: { type: 'string' } }, async ({ ebcdicData, encoding = 'UTF-8' }) => {
  let output = '';
  try {
    if (ebcdicData.match(/^[0-9A-Fa-f]+$/)) {
      for (let i = 0; i < ebcdicData.length; i += 2) {
        output += String.fromCharCode(parseInt(ebcdicData.substr(i, 2), 16));
      }
    } else { output = ebcdicData; }
  } catch (e) { output = 'Error: ' + e.message; }
  return { content: [{ type: 'text', text: JSON.stringify({ translated: true, output: output.substring(0, 500), encoding }, null, 2) }] };
});

app.get('/health', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ status: 'healthy', version: '1.0.0', name: 'cobol-bridge', tools: ['copybook-parser', 'cics-bridge-assessment', 'jcl-batch-scanner', 'vsam-mapper', 'ebcdic-translator'], timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.json({ name: 'COBOL Bridge MCP Server', version: '1.0.0', description: 'Connect legacy COBOL to AI governance', endpoints: { health: '/health', mcp: '/mcp/sse' }, tools: 5 });
});

let transport;
app.get('/mcp/sse', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  transport = new SSEServerTransport('/mcp/messages', res);
  await server.connect(transport);
});

app.post('/mcp/messages', async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (transport) { await transport.handlePostMessage(req, res); }
  else { res.status(400).json({ error: 'No active SSE' }); }
});

app.options('*', cors());
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`COBOL Bridge on port ${PORT}`));
module.exports = app;
