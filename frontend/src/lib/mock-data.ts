export interface Tool {
  id: string;
  name: string;
  category: string;
  builder: string;
  composite: number;
  metrics: {
    schemaHealth: number;
    discoverability: number;
    successRate: number;
  };
  trend: number[];
  lastTested: string;
  description: string;
  // Integration fields
  githubUrl?: string;
  repoName?: string;
  sourceFile?: string;
  inputSchema?: string; // raw JSON string of parsed_schema
}

export const TOOLS: Tool[] = [
  { id: '1', name: 'mcp-web-search', category: 'Search', builder: '0x7099...79C8', composite: 96, metrics: { schemaHealth: 97, discoverability: 94, successRate: 96 }, trend: [72, 78, 82, 88, 85, 91, 94], lastTested: '2m ago', description: 'Universal web search tool with structured result extraction and multi-engine fallback.' },
  { id: '2', name: 'mcp-swap-tokens', category: 'DeFi', builder: '0x3C44...93BC', composite: 89, metrics: { schemaHealth: 91, discoverability: 87, successRate: 88 }, trend: [65, 70, 74, 78, 82, 85, 87], lastTested: '5m ago', description: 'Cross-chain token swap via aggregated DEX routing with slippage protection.' },
  { id: '3', name: 'mcp-code-executor', category: 'DevTools', builder: '0xf39F...2266', composite: 89, metrics: { schemaHealth: 88, discoverability: 91, successRate: 89 }, trend: [70, 74, 78, 80, 83, 86, 88], lastTested: '8m ago', description: 'Sandboxed code execution supporting Python, JavaScript, and Rust with resource limits.' },
  { id: '4', name: 'mcp-db-query', category: 'Database', builder: '0x9876...5432', composite: 76, metrics: { schemaHealth: 82, discoverability: 78, successRate: 68 }, trend: [60, 62, 65, 68, 70, 73, 75], lastTested: '12m ago', description: 'Natural language to SQL translation with read-only execution on connected databases.' },
  { id: '5', name: 'mcp-image-gen', category: 'AI', builder: '0xABCD...EF01', composite: 83, metrics: { schemaHealth: 85, discoverability: 80, successRate: 84 }, trend: [58, 65, 70, 74, 78, 80, 82], lastTested: '15m ago', description: 'AI image generation with style control, resolution options, and prompt enhancement.' },
  { id: '6', name: 'mcp-nft-mint', category: 'DeFi', builder: '0x1234...ABCD', composite: 71, metrics: { schemaHealth: 78, discoverability: 65, successRate: 70 }, trend: [50, 55, 60, 63, 66, 69, 71], lastTested: '20m ago', description: 'NFT minting tool with metadata upload, collection management, and multi-chain support.' },
  { id: '7', name: 'mcp-translate', category: 'AI', builder: '0x5678...DCBA', composite: 91, metrics: { schemaHealth: 93, discoverability: 89, successRate: 91 }, trend: [75, 79, 82, 85, 87, 89, 90], lastTested: '3m ago', description: 'Multi-language translation with context awareness, domain-specific glossaries, and tone adjustment.' },
  { id: '8', name: 'mcp-file-convert', category: 'DevTools', builder: '0xAAAA...BBBB', composite: 79, metrics: { schemaHealth: 84, discoverability: 76, successRate: 77 }, trend: [62, 66, 69, 72, 75, 77, 79], lastTested: '25m ago', description: 'Universal file format converter supporting PDF, DOCX, CSV, JSON, and 20+ formats.' },
  { id: '9', name: 'mcp-weather-api', category: 'Data', builder: '0xCCCC...DDDD', composite: 85, metrics: { schemaHealth: 90, discoverability: 83, successRate: 82 }, trend: [68, 72, 75, 78, 81, 83, 85], lastTested: '7m ago', description: 'Real-time weather data with forecasts, historical data, and severe weather alerts.' },
  { id: '10', name: 'mcp-email-send', category: 'Communication', builder: '0xEEEE...FFFF', composite: 68, metrics: { schemaHealth: 72, discoverability: 65, successRate: 66 }, trend: [45, 50, 55, 58, 62, 65, 68], lastTested: '30m ago', description: 'Email sending with template support, attachments, and delivery tracking.' },
];

export const CATEGORIES = ['All', 'Search', 'DeFi', 'DevTools', 'Database', 'AI', 'Data', 'Communication'];

export function scoreColor(v: number): string {
  if (v >= 85) return 'text-green';
  if (v >= 60) return 'text-white';
  return 'text-amber';
}

export function scoreBg(v: number): string {
  if (v >= 85) return 'bg-green';
  if (v >= 60) return 'bg-blue';
  return 'bg-amber';
}
