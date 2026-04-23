/**
 * Shared constants across all Atlante modules.
 */

/** Extension identifier */
export const EXTENSION_ID = 'atlante';

/** Webview panel view type */
export const DIAGRAM_PANEL_VIEW_TYPE = 'archlens.diagramPanel';

/** Source file extensions supported (used by FileWatcher and AST Worker) */
export const SUPPORTED_EXTENSIONS: Record<string, string> = {
  '.ts': 'typescript',
  '.tsx': 'typescript',
  '.js': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.java': 'java',
  '.cs': 'csharp',
  '.go': 'go',
  '.rs': 'rust',
  '.kt': 'kotlin',
  '.swift': 'swift',
  '.rb': 'ruby',
  '.php': 'php',
};

/** Color palette for component types in diagrams. */
export const COMPONENT_COLORS: Record<string, string> = {
  controller: '#b8705a',    // muted terracotta
  service: '#6b8599',       // muted slate-blue
  repository: '#7a9470',    // sage green
  model: '#c49a3c',         // warm golden
  middleware: '#7c6e9b',    // dusty purple
  utility: '#8a857d',       // warm gray
  configuration: '#8a8078', // warm stone
  gateway: '#b07a8a',       // muted rose
  port: '#6a9a8f',          // sage-teal
  adapter: '#5e939e',       // muted teal-blue
  'use-case': '#b8705a',    // terracotta
  'domain-entity': '#c49a3c', // golden
  'event-handler': '#c27158', // warm rust
  factory: '#9a7db8',       // muted lavender
  provider: '#5b8fa8',      // muted sky-blue
  module: '#7a8693',        // cool warm-gray
  other: '#9a9590',         // warm neutral
};

/** Ghost Diff colors. */
export const DIFF_COLORS = {
  added: '#5a8a6a',         // sage olive green
  removed: '#c27158',       // muted coral
  modified: '#c49a3c',      // warm amber
  unchanged: '#9a9590',     // warm gray
} as const;

/** Violation severity colors (warm earth-tone palette) */
export const VIOLATION_COLORS = {
  error: '#b85c4a',         // warm brick — matches KPI red tier
  warning: '#c4845c',       // warm clay — matches KPI orange tier
  info: '#9a9590',          // warm gray — same as textTertiary
  errorBg: '#f8efeb',
  warningBg: '#f9f2ec',
  infoBg: '#f5f4ef',
  errorBorder: '#fde8df',
  warningBorder: '#f0e6df',
} as const;

/** Color palette for cluster cards (up to 6 clusters) */
export const CLUSTER_PALETTE = [
  { main: '#7c5cfc', light: '#f0edff', text: '#4c3cb0' },  // violet
  { main: '#10b981', light: '#ecfdf5', text: '#065f46' },  // emerald
  { main: '#f59e0b', light: '#fffbeb', text: '#92400e' },  // amber
  { main: '#3b82f6', light: '#eff6ff', text: '#1e40af' },  // blue
  { main: '#ef4444', light: '#fef2f2', text: '#991b1b' },  // rose
  { main: '#14b8a6', light: '#f0fdfa', text: '#115e59' },  // teal
] as const;

/** Atlante design language tokens */
export const ARCHLENS_THEME = {
  // Backgrounds
  canvasBg: '#FFFDF7',
  cardBg: '#ffffff',
  surfaceBg: '#f7f5f0',

  // Text
  textPrimary: '#3D3929',
  textSecondary: '#6b6560',
  textTertiary: '#9a9590',

  // Borders
  borderDefault: '#e5e2db',
  borderSubtle: '#ede9e1',

  // Accents
  accentPrimary: '#3D3929',
  accentHover: '#2e2b1f',

  // Status (UI chrome — not severity)
  statusSuccess: '#7a8c6e',
  statusSuccessText: '#16a34a',

  // Alert banners (full-page error/warning states)
  alertErrorText: '#991b1b',
  alertErrorBg: '#fef2f2',
  alertErrorBorder: '#fecaca',
  alertWarningText: '#92400e',
  alertWarningBg: '#fffbeb',
  alertWarningBorder: '#fde68a',

  // Semantic term highlights (Architecture page — tech stack vs domain context)
  termTechBg: '#e8edf3',     // cool blue tint — libraries, frameworks, formats, algorithms
  termDomainBg: '#f3e8de',   // warm orange tint — external systems, data sources, organizations

  // Shadows
  shadowSm: '0 1px 2px rgba(26,25,21,0.04), 0 1px 4px rgba(26,25,21,0.06)',
  shadowMd: '0 2px 4px rgba(26,25,21,0.04), 0 4px 12px rgba(26,25,21,0.08)',
  shadowLg: '0 4px 8px rgba(26,25,21,0.04), 0 8px 24px rgba(26,25,21,0.10)',

  // Diff tint backgrounds (very subtle on white cards)
  diffAddedBg: '#f6faf7',
  diffRemovedBg: '#fdf6f4',
  diffModifiedBg: '#fdfaf2',
} as const;

/** Performance budgets (milliseconds) */
export const PERFORMANCE_BUDGET = {
  astParse: 50,
  cacheCheck: 10,
  diffComputation: 50,
  layoutComputation: 100,
  webviewRender: 100,
  totalIncremental: 2000,
} as const;

/** Default debounce for file watcher (ms) */
export const DEFAULT_DEBOUNCE_MS = 500;

/** Max files for full analysis before warning */
export const MAX_FILES_WARNING_THRESHOLD = 500;

/** Edge label display settings */
export const EDGE_LABEL_MAX_CHARS = 20;
export const SAME_LAYER_ARC_MAX_HEIGHT = 60;

/** Root folder name for all Atlante data stored in the project */
export const ARCHLENS_DIR = '.atlante';

/** Relative paths (from ARCHLENS_DIR) for each feature's persisted data */
export const STORAGE_PATHS = {
  model:      'analysis/model.json',
  hypothesis: 'analysis/hypothesis.json',
  diagram:    'analysis/diagram.json',
  inventory:  'inventory/inventory.json',
  hashes:     'analysis/hashes.json',
  evidence:   'analysis/evidence.json',
  clusters:   'clusters/clusters.json',
  flows:      'flows/flows.json',
  logic:      'flows/logic.json',
  health:     'health/health.json',
  rules:      'rules/rules.json',
  uiState:    'ui/state.json',
  gitNarrative: 'git/narrative.json',
  usage:      'usage/usage.json',
} as const;

// ─── Library Tracker Allowlists ─────────────────────────────────────

/** Frameworks and the runtime deps they implicitly require (never imported directly). */
export const FRAMEWORK_IMPLICIT_DEPS: Record<string, string[]> = {
  '@angular/core': ['zone.js', '@angular/compiler', 'tslib', '@angular/animations', '@angular/platform-browser-dynamic'],
  'next': ['react', 'react-dom'],
  'nuxt': ['vue', 'vue-router'],
  'gatsby': ['react', 'react-dom'],
  '@sveltejs/kit': ['svelte'],
};

/** Packages that provide only CSS/font assets, never imported in JS/TS source. */
export const CSS_ONLY_PACKAGES = new Set([
  'primeicons', 'primeflex', 'normalize.css', 'reset-css',
  'font-awesome', '@fortawesome/fontawesome-free', 'animate.css',
]);

/** Python packages invoked as CLI commands, never imported in source. */
export const PYTHON_CLI_PACKAGES = new Set([
  'uvicorn', 'gunicorn', 'celery', 'daphne', 'hypercorn', 'waitress', 'flower',
]);

/** Python packages that are optional engine deps of a parent library. */
export const PYTHON_IMPLICIT_ENGINE_DEPS: Record<string, string[]> = {
  'pandas': ['openpyxl', 'xlrd', 'xlsxwriter', 'pyarrow', 'fastparquet', 'tables', 'lxml'],
  'sqlalchemy': ['psycopg2', 'psycopg2-binary', 'pymysql', 'mysqlclient', 'cx-oracle', 'pyodbc'],
  'matplotlib': ['kiwisolver', 'cycler', 'fonttools'],
};
