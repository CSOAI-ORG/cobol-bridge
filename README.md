# COBOL Bridge MCP Server

Connect legacy COBOL mainframe systems to modern AI governance via MCP.

## Tools

- **copybook-parser**: Parse COBOL copybooks with PII detection
- **cics-bridge-assessment**: Assess CICS integration readiness
- **jcl-batch-scanner**: Scan JCL job streams
- **vsam-mapper**: Map VSAM file structures
- **ebcdic-translator**: Translate EBCDIC to UTF-8

## Usage

```json
{
  "mcpServers": {
    "cobol-bridge": {
      "command": "npx",
      "args": ["-y", "@csga-global/cobol-bridge"]
    }
  }
}
```

## Deployment

Live at: https://cobol-bridge.vercel.app

Health check: https://cobol-bridge.vercel.app/health
