import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ARCHLENS_THEME } from '../../shared/constants';
import type { FileInventoryItem, FileInventoryPayload } from '../../shared/types/inventory';

interface SourceInventoryPageProps {
  workspaceName: string;
  inventory: FileInventoryPayload | null;
  status: 'idle' | 'analyzing' | 'complete' | 'error' | 'stale';
  statusMessage?: string;
  error: string | null;
  onAnalyze: () => void;
  onRefresh: () => void;
  onSwitchProject: () => void;
  onOpenFile: (filePath: string) => void;
}

type SortKey = 'path' | 'language' | 'loc' | 'imports' | 'exports' | 'fanIn' | 'fanOut';
type SortDirection = 'asc' | 'desc';
type ViewMode = 'table' | 'graph';
type GraphEdgeMode = 'all' | 'selected';
type QuickFilter = 'all' | 'large' | 'fanIn' | 'fanOut';
type DependencyGraphNode = {
  file: FileInventoryItem;
  filePath: string;
  x: number;
  y: number;
  r: number;
  criticalR: number;
  criticalMass: number;
};
type GraphViewport = { zoom: number; offsetX: number; offsetY: number };
type GraphViewportSize = { width: number; height: number };
type GraphPanSession = {
  pointerId: number;
  startX: number;
  startY: number;
  originOffsetX: number;
  originOffsetY: number;
};

const GRAPH_NODE_LIMIT = 140;
const GRAPH_MIN_ZOOM = 0.22;
const GRAPH_MAX_ZOOM = 4;
const GRAPH_DEFAULT_VIEWPORT: GraphViewport = { zoom: 1, offsetX: 0, offsetY: 0 };
const GRAPH_DEFAULT_VIEWPORT_SIZE: GraphViewportSize = { width: 0, height: 0 };

const primaryButtonStyle: React.CSSProperties = {
  border: 'none',
  borderRadius: 2,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  background: ARCHLENS_THEME.accentPrimary,
  color: '#fff',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
  borderRadius: 2,
  padding: '10px 14px',
  fontSize: 12,
  fontWeight: 700,
  background: ARCHLENS_THEME.cardBg,
  color: ARCHLENS_THEME.textPrimary,
  cursor: 'pointer',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
  borderRadius: 2,
  padding: '10px 12px',
  background: '#fff',
  color: ARCHLENS_THEME.textPrimary,
  fontSize: 12,
  boxSizing: 'border-box',
  minWidth: 0,
};

export function SourceInventoryPage({
  workspaceName,
  inventory,
  status,
  statusMessage,
  error,
  onAnalyze,
  onRefresh,
  onSwitchProject,
  onOpenFile,
}: SourceInventoryPageProps) {
  const [search, setSearch] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [directoryFilter, setDirectoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortKey>('loc');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTableFilePath, setSelectedTableFilePath] = useState<string | null>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedGraphFilePath, setSelectedGraphFilePath] = useState<string | null>(null);
  const [hoveredGraphFilePath, setHoveredGraphFilePath] = useState<string | null>(null);

  const languages = useMemo(
    () => inventory ? [...new Set(inventory.files.map((file) => file.language))].sort() : [],
    [inventory],
  );
  const directories = useMemo(
    () => inventory ? [...new Set(inventory.files.map((file) => file.topLevelDirectory))].sort() : [],
    [inventory],
  );

  const visibleFiles = useMemo(() => {
    if (!inventory) return [];
    const query = search.trim().toLowerCase();
    return inventory.files
      .filter((file) => {
        const matchesSearch = query.length === 0
          || file.filePath.toLowerCase().includes(query)
          || file.exports.some((entry) => entry.name.toLowerCase().includes(query))
          || file.imports.some((entry) => entry.source.toLowerCase().includes(query));
        const matchesLanguage = languageFilter === 'all' || file.language === languageFilter;
        const matchesDirectory = directoryFilter === 'all' || file.topLevelDirectory === directoryFilter;
        return matchesSearch && matchesLanguage && matchesDirectory && matchesQuickFilter(file, quickFilter);
      })
      .sort((left, right) => compareFiles(left, right, sortBy, sortDirection));
  }, [directoryFilter, inventory, languageFilter, quickFilter, search, sortBy, sortDirection]);

  const totalLoc = inventory?.files.reduce((total, file) => total + file.loc, 0) ?? 0;
  const selectedTableFile = selectedTableFilePath && inventory
    ? inventory.files.find((file) => file.filePath === selectedTableFilePath) ?? null
    : null;
  const tableGridColumns = '44px minmax(260px, 3fr) 96px 96px repeat(4, 76px)';
  const actionLabel = status === 'stale' ? 'Refresh' : 'Analyze';
  const actionHandler = status === 'stale' ? onRefresh : onAnalyze;

  const handleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortDirection((current) => current === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(key);
    setSortDirection(key === 'path' || key === 'language' ? 'asc' : 'desc');
  };

  return (
    <div
      style={{
        height: '100vh',
        background: ARCHLENS_THEME.canvasBg,
        color: ARCHLENS_THEME.textPrimary,
        fontFamily: 'Geist, Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        padding: 16,
        overflow: 'hidden',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 24, lineHeight: 1.1 }}>
            {workspaceName}
          </h1>
          <div style={{ marginTop: 6, fontSize: 12, color: ARCHLENS_THEME.textSecondary }}>
            {inventory
              ? viewMode === 'table'
                ? `${inventory.summary.totalFiles.toLocaleString()} files / ${totalLoc.toLocaleString()} lines / refactor targets first`
                : `${inventory.summary.totalFiles.toLocaleString()} files / ${totalLoc.toLocaleString()} lines / dependency map ready`
              : 'Deterministic source inventory. No external calls.'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={onSwitchProject} style={secondaryButtonStyle}>Switch Project</button>
          <button onClick={actionHandler} style={primaryButtonStyle}>{actionLabel}</button>
        </div>
      </header>

      {statusMessage && !inventory && (
        <div style={{ fontSize: 12, color: status === 'error' ? ARCHLENS_THEME.alertErrorText : ARCHLENS_THEME.textSecondary }}>
          {statusMessage}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '12px 14px',
            background: ARCHLENS_THEME.alertErrorBg,
            border: `1px solid ${ARCHLENS_THEME.alertErrorBorder}`,
            color: ARCHLENS_THEME.alertErrorText,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {inventory ? (
        <>
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <Kpi label="Files" value={inventory.summary.totalFiles.toLocaleString()} />
            <Kpi label="Lines" value={totalLoc.toLocaleString()} />
            <Kpi label="Internal Edges" value={inventory.summary.internalDependencyEdges.toLocaleString()} />
            <Kpi label="Languages" value={inventory.summary.languages.length.toLocaleString()} />
          </section>

          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(220px, 1fr) minmax(140px, 180px) minmax(140px, 220px) minmax(150px, 170px)',
              gap: 8,
              flexShrink: 0,
              padding: 8,
              border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
              background: ARCHLENS_THEME.surfaceBg,
              borderRadius: 4,
            }}
          >
            <input
              style={inputStyle}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter files, imports, exports"
            />
            <select style={inputStyle} value={languageFilter} onChange={(event) => setLanguageFilter(event.target.value)}>
              <option value="all">All languages</option>
              {languages.map((language) => (
                <option key={language} value={language}>{language}</option>
              ))}
            </select>
            <select style={inputStyle} value={directoryFilter} onChange={(event) => setDirectoryFilter(event.target.value)}>
              <option value="all">All folders</option>
              {directories.map((directory) => (
                <option key={directory} value={directory}>{directory}</option>
              ))}
            </select>
            <ViewToggle value={viewMode} onChange={setViewMode} />
          </section>
          <QuickFilterBar value={quickFilter} onChange={setQuickFilter} />

          <main
            style={{
              flex: 1,
              minHeight: 0,
              background: ARCHLENS_THEME.cardBg,
              border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
              borderRadius: 4,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative',
            }}
          >
            {viewMode === 'table' ? (
              <>
                <TableContextBar visibleCount={visibleFiles.length} totalCount={inventory.files.length} />
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: tableGridColumns,
                    gap: 10,
                    padding: '10px 12px',
                    borderBottom: `1px solid ${ARCHLENS_THEME.borderDefault}`,
                    fontSize: 11,
                    fontWeight: 700,
                    color: ARCHLENS_THEME.textTertiary,
                    background: ARCHLENS_THEME.surfaceBg,
                  }}
                >
                  <div style={{ textAlign: 'right' }}>#</div>
                  <HeaderCell label="File" sortKey="path" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                  <HeaderCell label="Language" sortKey="language" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                  <HeaderCell label="Lines" sortKey="loc" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} featured />
                  <HeaderCell label="Imports" sortKey="imports" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                  <HeaderCell label="Exports" sortKey="exports" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                  <HeaderCell label="Fan In" sortKey="fanIn" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                  <HeaderCell label="Fan Out" sortKey="fanOut" sortBy={sortBy} sortDirection={sortDirection} onSort={handleSort} />
                </div>

                <div style={{ flex: 1, minHeight: 0, overflow: 'auto', position: 'relative' }}>
                  {visibleFiles.map((file, index) => {
                    const selected = selectedTableFilePath === file.filePath;
                    const rank = index + 1;
                    const rankedByLines = sortBy === 'loc' && sortDirection === 'desc';
                    return (
                      <button
                        key={file.filePath}
                        onClick={() => setSelectedTableFilePath(selected ? null : file.filePath)}
                        style={{
                          width: '100%',
                          display: 'grid',
                          gridTemplateColumns: tableGridColumns,
                          gap: 10,
                          alignItems: 'center',
                          padding: '10px 12px',
                          border: 'none',
                          borderBottom: `1px solid ${ARCHLENS_THEME.borderSubtle}`,
                          background: selected ? '#eef6f8' : rankedByLines && rank <= 3 ? '#fbfcf8' : ARCHLENS_THEME.cardBg,
                          boxShadow: rankedByLines && rank <= 3 ? 'inset 3px 0 0 #66c7d8' : undefined,
                          color: ARCHLENS_THEME.textPrimary,
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontSize: 12,
                        }}
                      >
                        <RankCell rank={rank} highlight={rankedByLines && rank <= 10} />
                        <FileNameCell filePath={file.filePath} />
                        <LanguageBadge language={file.language} />
                        <NumberCell value={file.loc} featured />
                        <NumberCell value={file.importCount} />
                        <NumberCell value={file.exportCount} />
                        <NumberCell value={file.fanIn} />
                        <NumberCell value={file.fanOut} />
                      </button>
                    );
                  })}
                  {visibleFiles.length === 0 && (
                    <div style={{ padding: 20, fontSize: 13, color: ARCHLENS_THEME.textSecondary }}>
                      No files match the current filters.
                    </div>
                  )}
                  {selectedTableFile && (
                    <InventoryFileDrawer
                      file={selectedTableFile}
                      onClose={() => setSelectedTableFilePath(null)}
                      onOpenFile={onOpenFile}
                    />
                  )}
                </div>
              </>
            ) : (
              <DependencyGraphView
                files={visibleFiles}
                selectedFilePath={selectedGraphFilePath}
                hoveredFilePath={hoveredGraphFilePath}
                onSelectFile={setSelectedGraphFilePath}
                onHoverFile={setHoveredGraphFilePath}
                onOpenFile={onOpenFile}
              />
            )}
          </main>
        </>
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            background: ARCHLENS_THEME.cardBg,
            border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
          }}
        >
          <div style={{ maxWidth: 420, padding: 24 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>Source Inventory</h2>
            <p style={{ margin: '10px 0 18px', fontSize: 13, lineHeight: 1.6, color: ARCHLENS_THEME.textSecondary }}>
              {status === 'analyzing'
                ? statusMessage ?? 'Building source inventory...'
                : 'Run a deterministic scan to load files, line counts, imports, exports, and dependency KPIs.'}
            </p>
            <button onClick={onAnalyze} style={primaryButtonStyle}>Analyze Workspace</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        background: ARCHLENS_THEME.cardBg,
        border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
        padding: '7px 10px',
        borderRadius: 2,
        minHeight: 42,
      }}
    >
      <div style={{ fontSize: 10, color: ARCHLENS_THEME.textTertiary, fontWeight: 700, marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 17, fontWeight: 800, color: ARCHLENS_THEME.textPrimary }}>
        {value}
      </div>
    </div>
  );
}

function QuickFilterBar({ value, onChange }: { value: QuickFilter; onChange: (value: QuickFilter) => void }) {
  const filters: Array<{ key: QuickFilter; label: string }> = [
    { key: 'all', label: 'All files' },
    { key: 'large', label: 'Largest files' },
    { key: 'fanIn', label: 'High fan-in' },
    { key: 'fanOut', label: 'High fan-out' },
  ];
  // TODO: Restore unresolved-import surfacing once path aliases and package resolution stop producing noisy false positives.

  return (
    <section style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flexShrink: 0 }}>
      {filters.map((filter) => {
        const active = value === filter.key;
        return (
          <button
            key={filter.key}
            onClick={() => onChange(filter.key)}
            style={{
              border: `1px solid ${active ? ARCHLENS_THEME.accentPrimary : ARCHLENS_THEME.borderDefault}`,
              background: active ? '#edf7fa' : ARCHLENS_THEME.cardBg,
              color: active ? ARCHLENS_THEME.textPrimary : ARCHLENS_THEME.textSecondary,
              padding: '6px 9px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {filter.label}
          </button>
        );
      })}
    </section>
  );
}

function ViewToggle({ value, onChange }: { value: ViewMode; onChange: (value: ViewMode) => void }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
        background: '#fff',
        minHeight: 38,
        borderRadius: 4,
        overflow: 'hidden',
      }}
    >
      {(['table', 'graph'] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            aria-pressed={active}
            title={mode === 'table' ? 'Table view' : 'Graph view'}
            style={{
              border: 'none',
              borderRight: mode === 'table' ? `1px solid ${ARCHLENS_THEME.borderDefault}` : 'none',
              background: active ? ARCHLENS_THEME.accentPrimary : '#fff',
              color: active ? '#fff' : ARCHLENS_THEME.textSecondary,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {mode === 'table' ? 'Table' : 'Graph'}
          </button>
        );
      })}
    </div>
  );
}

function TableContextBar({ visibleCount, totalCount }: { visibleCount: number; totalCount: number }) {
  const filtered = visibleCount !== totalCount;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '9px 12px',
        borderBottom: `1px solid ${ARCHLENS_THEME.borderSubtle}`,
        background: '#fbfcfd',
        fontSize: 12,
      }}
    >
      <div style={{ minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 12, color: ARCHLENS_THEME.textPrimary }}>Refactor queue</strong>
        <span style={{ color: ARCHLENS_THEME.textSecondary }}>
          Largest files first, with dependency signals
        </span>
      </div>
      <span
        style={{
          flexShrink: 0,
          color: ARCHLENS_THEME.textTertiary,
          fontVariantNumeric: 'tabular-nums',
          fontWeight: 700,
        }}
      >
        {filtered ? `${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} files` : `${totalCount.toLocaleString()} files`}
      </span>
    </div>
  );
}

function DependencyGraphView({
  files,
  selectedFilePath,
  hoveredFilePath,
  onSelectFile,
  onHoverFile,
  onOpenFile,
}: {
  files: FileInventoryItem[];
  selectedFilePath: string | null;
  hoveredFilePath: string | null;
  onSelectFile: (filePath: string | null) => void;
  onHoverFile: (filePath: string | null) => void;
  onOpenFile: (filePath: string) => void;
}) {
  const graphFiles = files.slice(0, GRAPH_NODE_LIMIT);
  const layout = useMemo(() => buildDependencyGraphLayout(graphFiles), [graphFiles]);
  const activeFilePath = hoveredFilePath ?? selectedFilePath;
  const selectedFile = selectedFilePath ? layout.fileByPath.get(selectedFilePath) ?? null : null;
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const panSessionRef = useRef<GraphPanSession | null>(null);
  const viewportAnimationRef = useRef<number | null>(null);
  const [viewportSize, setViewportSize] = useState<GraphViewportSize>(GRAPH_DEFAULT_VIEWPORT_SIZE);
  const [viewport, setViewport] = useState<GraphViewport>(GRAPH_DEFAULT_VIEWPORT);
  const [viewportInteracted, setViewportInteracted] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [edgeMode, setEdgeMode] = useState<GraphEdgeMode>('all');
  const [criticalMassEnabled, setCriticalMassEnabled] = useState(false);
  const legendLanguages = useMemo(
    () => [...new Set(graphFiles.map((file) => file.language))].sort().slice(0, 5),
    [graphFiles],
  );
  const connectedFilePaths = useMemo(() => {
    const connected = new Set<string>();
    if (!activeFilePath) return connected;
    connected.add(activeFilePath);
    for (const edge of layout.edges) {
      if (edge.from.filePath === activeFilePath) connected.add(edge.to.filePath);
      if (edge.to.filePath === activeFilePath) connected.add(edge.from.filePath);
    }
    return connected;
  }, [activeFilePath, layout.edges]);
  const visibleEdges = useMemo(() => {
    if (edgeMode === 'all') return layout.edges;
    if (!selectedFilePath) return [];
    return layout.edges.filter((edge) => edge.from.filePath === selectedFilePath || edge.to.filePath === selectedFilePath);
  }, [edgeMode, layout.edges, selectedFilePath]);

  useEffect(() => {
    const element = canvasRef.current;
    if (!element) return undefined;

    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      setViewportSize({
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
      });
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => () => {
    if (viewportAnimationRef.current !== null) {
      window.cancelAnimationFrame(viewportAnimationRef.current);
    }
  }, []);

  useEffect(() => {
    if (!fullscreen) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fullscreen]);

  useEffect(() => {
    if (viewportInteracted || viewportSize.width <= 1 || viewportSize.height <= 1) {
      return;
    }
    setViewport(computeFitViewport(layout, viewportSize));
  }, [layout, viewportInteracted, viewportSize]);

  const resetViewport = () => {
    if (viewportSize.width <= 1 || viewportSize.height <= 1) {
      return;
    }
    stopViewportAnimation();
    setViewportInteracted(false);
    setViewport(computeFitViewport(layout, viewportSize));
  };

  const stopViewportAnimation = () => {
    if (viewportAnimationRef.current !== null) {
      window.cancelAnimationFrame(viewportAnimationRef.current);
      viewportAnimationRef.current = null;
    }
  };

  const animateViewportTo = (target: GraphViewport) => {
    stopViewportAnimation();
    const start = viewport;
    const startedAt = performance.now();
    const duration = 260;

    const step = (time: number) => {
      const progress = clamp((time - startedAt) / duration, 0, 1);
      const eased = 1 - (1 - progress) ** 3;
      setViewport({
        zoom: start.zoom + (target.zoom - start.zoom) * eased,
        offsetX: start.offsetX + (target.offsetX - start.offsetX) * eased,
        offsetY: start.offsetY + (target.offsetY - start.offsetY) * eased,
      });

      if (progress < 1) {
        viewportAnimationRef.current = window.requestAnimationFrame(step);
      } else {
        viewportAnimationRef.current = null;
      }
    };

    viewportAnimationRef.current = window.requestAnimationFrame(step);
  };

  const zoomAroundPoint = (nextZoom: number, pointerX: number, pointerY: number) => {
    stopViewportAnimation();
    const zoom = clamp(nextZoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    const graphX = (pointerX - viewport.offsetX) / viewport.zoom;
    const graphY = (pointerY - viewport.offsetY) / viewport.zoom;
    setViewport({
      zoom,
      offsetX: pointerX - graphX * zoom,
      offsetY: pointerY - graphY * zoom,
    });
  };

  const handleWheel = (event: React.WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const factor = event.deltaY < 0 ? 1.13 : 0.88;
    setViewportInteracted(true);
    zoomAroundPoint(viewport.zoom * factor, pointerX, pointerY);
  };

  const handlePointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) {
      return;
    }
    const target = event.target instanceof Element ? event.target.closest('[data-graph-node="true"]') : null;
    if (target) {
      return;
    }
    stopViewportAnimation();
    panSessionRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originOffsetX: viewport.offsetX,
      originOffsetY: viewport.offsetY,
    };
    setIsPanning(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    const session = panSessionRef.current;
    if (!session || session.pointerId !== event.pointerId) {
      return;
    }
    setViewportInteracted(true);
    setViewport({
      zoom: viewport.zoom,
      offsetX: session.originOffsetX + event.clientX - session.startX,
      offsetY: session.originOffsetY + event.clientY - session.startY,
    });
  };

  const stopPanning = () => {
    panSessionRef.current = null;
    setIsPanning(false);
  };

  const zoomByButton = (factor: number) => {
    if (viewportSize.width <= 1 || viewportSize.height <= 1) {
      return;
    }
    setViewportInteracted(true);
    zoomAroundPoint(viewport.zoom * factor, viewportSize.width / 2, viewportSize.height / 2);
  };

  const handleSelectNode = (node: { filePath: string; x: number; y: number }) => {
    const selected = selectedFilePath === node.filePath;
    onSelectFile(selected ? null : node.filePath);
    if (selected || viewportSize.width <= 1 || viewportSize.height <= 1) {
      return;
    }
    const zoom = clamp(Math.max(viewport.zoom, 1.18), GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    setViewportInteracted(true);
    animateViewportTo({
      zoom,
      offsetX: viewportSize.width / 2 - node.x * zoom,
      offsetY: viewportSize.height / 2 - node.y * zoom,
    });
  };

  if (files.length === 0) {
    return (
      <div style={{ padding: 20, fontSize: 13, color: ARCHLENS_THEME.textSecondary }}>
        No files match the current filters.
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: 'block',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 20 : undefined,
        background: fullscreen ? '#111315' : undefined,
      }}
    >
      <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 0, overflow: 'hidden', background: '#111315', display: 'flex', flexDirection: 'column' }}>
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(17,19,21,0.88)',
            fontSize: 12,
            color: 'rgba(246,244,238,0.68)',
          }}
        >
          <strong style={{ color: '#f6f4ee' }}>Dependency Constellation</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <GraphPill label="Files" value={layout.nodes.length.toLocaleString()} />
            <GraphPill label="Edges" value={visibleEdges.length.toLocaleString()} />
            {files.length > GRAPH_NODE_LIMIT && (
              <GraphPill label="Showing" value={`${GRAPH_NODE_LIMIT.toLocaleString()} of ${files.length.toLocaleString()}`} />
            )}
            <GraphToggle value={edgeMode} onChange={setEdgeMode} />
            <GraphImpactToggle enabled={criticalMassEnabled} onChange={setCriticalMassEnabled} />
            <GraphToolButton label="-" title="Zoom out" onClick={() => zoomByButton(0.82)} />
            <GraphToolButton label="+" title="Zoom in" onClick={() => zoomByButton(1.18)} />
            <GraphToolButton label="Fit" title="Fit graph" onClick={resetViewport} />
            <GraphToolButton
              label={fullscreen ? 'Exit' : 'Full'}
              title={fullscreen ? 'Exit fullscreen' : 'Fullscreen graph'}
              onClick={() => setFullscreen((current) => !current)}
            />
          </div>
        </div>
        <div ref={canvasRef} style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <GraphLegend languages={legendLanguages} criticalMassEnabled={criticalMassEnabled} />
        <svg
          viewBox={`0 0 ${Math.max(1, viewportSize.width)} ${Math.max(1, viewportSize.height)}`}
          preserveAspectRatio="none"
          onWheel={handleWheel}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopPanning}
          onPointerCancel={stopPanning}
          onPointerLeave={() => {
            if (isPanning) {
              stopPanning();
            }
          }}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            background: '#111315',
            touchAction: 'none',
          }}
        >
          <defs>
            <filter id="codeCheckerNebulaBlur">
              <feGaussianBlur stdDeviation="28" />
            </filter>
            <filter id="codeCheckerStarGlow">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <rect
            x={0}
            y={0}
            width={Math.max(1, viewportSize.width)}
            height={Math.max(1, viewportSize.height)}
            fill="transparent"
            style={{ cursor: isPanning ? 'grabbing' : 'grab' }}
          />
          <g transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.zoom})`}>
          {layout.clusters.map((cluster) => (
            <g key={cluster.key} transform={`translate(${cluster.x} ${cluster.y})`} filter="url(#codeCheckerNebulaBlur)" opacity={cluster.opacity}>
              {cluster.lobes.map((lobe, index) => (
                <ellipse
                  key={`${cluster.key}-${index}`}
                  cx={lobe.offsetX}
                  cy={lobe.offsetY}
                  rx={lobe.radiusX}
                  ry={lobe.radiusY}
                  fill={clusterNebulaFill(cluster.key, lobe.opacity)}
                />
              ))}
            </g>
          ))}
          {layout.ambientStars.map((star, index) => (
            <circle
              key={`ambient-${index}`}
              cx={star.x}
              cy={star.y}
              r={star.r}
              fill="#d8e4ff"
              opacity={star.opacity}
            />
          ))}
          {visibleEdges.map((edge) => {
            const active = activeFilePath !== null && (edge.from.filePath === activeFilePath || edge.to.filePath === activeFilePath);
            return (
              <path
                key={`${edge.from.filePath}->${edge.to.filePath}`}
                d={edge.path}
                fill="none"
                stroke={active ? '#7de3ff' : '#9eb7c0'}
                strokeWidth={active ? 1.65 : 0.75}
                opacity={activeFilePath ? (active ? 0.82 : 0.06) : 0.22}
                strokeLinecap="round"
              />
            );
          })}
          {layout.clusters.map((cluster) => (
            <text
              key={`${cluster.key}-label`}
              x={cluster.x}
              y={cluster.y + cluster.labelOffsetY}
              textAnchor="middle"
              fontSize="12"
              fontWeight="700"
              fill="rgba(246,244,238,0.58)"
            >
              {truncateLabel(cluster.key, 24)}
            </text>
          ))}
          {layout.nodes.map((node) => {
            const selected = selectedFilePath === node.filePath;
            const connected = connectedFilePaths.has(node.filePath);
            const dimmed = activeFilePath !== null && !connected;
            const nodeRadius = criticalMassEnabled ? node.criticalR : node.r;
            return (
              <g
                key={node.filePath}
                data-graph-node="true"
                onClick={() => handleSelectNode(node)}
                onMouseEnter={() => onHoverFile(node.filePath)}
                onMouseLeave={() => onHoverFile(null)}
                style={{ cursor: 'pointer' }}
              >
                <title>{`${node.filePath}\nDependency impact: ${node.criticalMass} (${node.file.fanIn} in / ${node.file.fanOut} out)`}</title>
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={selected ? nodeRadius + 3.5 : connected ? nodeRadius + 2 : nodeRadius}
                  fill={selected ? '#ffffff' : connected ? '#f9dfa5' : nodeStarFill(node.file.language)}
                  stroke={selected ? '#7de3ff' : connected ? '#f2b95d' : 'rgba(255,255,255,0.62)'}
                  strokeWidth={selected ? 1.8 : connected ? 1.2 : 0.55}
                  opacity={dimmed ? 0.22 : 0.94}
                  filter={selected || connected ? 'url(#codeCheckerStarGlow)' : undefined}
                />
              </g>
            );
          })}
          </g>
        </svg>
        </div>
      </div>
      {selectedFile && !fullscreen && (
        <GraphFilePanel file={selectedFile} onOpenFile={onOpenFile} onClose={() => onSelectFile(null)} />
      )}
    </div>
  );
}

function GraphFilePanel({
  file,
  onOpenFile,
  onClose,
}: {
  file: FileInventoryItem;
  onOpenFile: (filePath: string) => void;
  onClose: () => void;
}) {
  return (
    <aside
      style={{
        position: 'absolute',
        top: 56,
        right: 16,
        bottom: 16,
        width: 300,
        maxWidth: 'calc(100% - 32px)',
        overflow: 'auto',
        padding: 14,
        background: '#fcfbf8',
        border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
        boxShadow: '0 18px 42px rgba(0,0,0,0.24)',
        zIndex: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: ARCHLENS_THEME.textTertiary, fontWeight: 700, marginBottom: 8 }}>
            SELECTED FILE
          </div>
          <button
            onClick={onClose}
            title="Close details"
            style={{
              width: 26,
              height: 24,
              border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
              background: '#fff',
              color: ARCHLENS_THEME.textSecondary,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            x
          </button>
      </div>
          <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.35, overflowWrap: 'anywhere' }}>
            {file.filePath}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 8,
              margin: '14px 0',
            }}
          >
            <MiniMetric label="Lines" value={file.loc} />
            <MiniMetric label="Fan In" value={file.fanIn} />
            <MiniMetric label="Fan Out" value={file.fanOut} />
            <MiniMetric label="Imports" value={file.importCount} />
          </div>
          <button onClick={() => onOpenFile(file.filePath)} style={secondaryButtonStyle}>
            Open File
          </button>
          <div style={{ height: 16 }} />
          <DetailGroup title="Resolved Dependencies" values={file.resolvedDependencies} empty="No internal dependencies" />
          <div style={{ height: 14 }} />
          <DetailGroup title="Dependents" values={file.dependents} empty="No dependents" />
    </aside>
  );
}

function MiniMetric({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ border: `1px solid ${ARCHLENS_THEME.borderSubtle}`, background: '#fff', padding: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: ARCHLENS_THEME.textTertiary, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</div>
    </div>
  );
}

function GraphLegend({
  languages,
  criticalMassEnabled,
}: {
  languages: string[];
  criticalMassEnabled: boolean;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        left: 12,
        bottom: 12,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
        padding: '8px 10px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(17,19,21,0.72)',
        color: 'rgba(246,244,238,0.74)',
        fontSize: 11,
      }}
    >
      {languages.map((language) => (
        <span key={language} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: nodeStarFill(language),
              display: 'inline-block',
            }}
          />
          {language}
        </span>
      ))}
      <span style={{ color: 'rgba(246,244,238,0.52)' }}>
        {criticalMassEnabled ? 'size = dependency impact' : 'uniform size'}
      </span>
    </div>
  );
}

function GraphPill({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        minHeight: 24,
        padding: '0 8px',
        border: '1px solid rgba(255,255,255,0.12)',
        background: 'rgba(255,255,255,0.055)',
        color: 'rgba(246,244,238,0.8)',
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <span style={{ color: 'rgba(246,244,238,0.48)' }}>{label}</span>
      <span>{value}</span>
    </span>
  );
}

function GraphToggle({ value, onChange }: { value: GraphEdgeMode; onChange: (value: GraphEdgeMode) => void }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        height: 24,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.045)',
      }}
      title="Edge visibility"
    >
      {(['all', 'selected'] as const).map((mode) => {
        const active = value === mode;
        return (
          <button
            key={mode}
            onClick={() => onChange(mode)}
            style={{
              border: 'none',
              borderRight: mode === 'all' ? '1px solid rgba(255,255,255,0.12)' : 'none',
              background: active ? 'rgba(125,227,255,0.18)' : 'transparent',
              color: active ? '#f6f4ee' : 'rgba(246,244,238,0.62)',
              padding: '0 8px',
              fontSize: 11,
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {mode === 'all' ? 'All' : 'Focus'}
          </button>
        );
      })}
    </div>
  );
}

function GraphImpactToggle({ enabled, onChange }: { enabled: boolean; onChange: (enabled: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      title="Scale nodes by dependency importance"
      aria-pressed={enabled}
      style={{
        height: 24,
        border: `1px solid ${enabled ? 'rgba(125,227,255,0.48)' : 'rgba(255,255,255,0.14)'}`,
        background: enabled ? 'rgba(125,227,255,0.18)' : 'rgba(255,255,255,0.06)',
        color: enabled ? '#f6f4ee' : 'rgba(246,244,238,0.68)',
        padding: '0 9px',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      Impact
    </button>
  );
}

function GraphToolButton({ label, title, onClick }: { label: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: label.length > 2 ? 44 : 26,
        height: 24,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(255,255,255,0.06)',
        color: '#f6f4ee',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function computeFitViewport(layout: { width: number; height: number }, viewportSize: GraphViewportSize): GraphViewport {
  const horizontalPadding = 72;
  const verticalPadding = 72;
  const availableWidth = Math.max(120, viewportSize.width - horizontalPadding * 2);
  const availableHeight = Math.max(120, viewportSize.height - verticalPadding * 2);
  const zoom = clamp(Math.min(availableWidth / layout.width, availableHeight / layout.height), GRAPH_MIN_ZOOM, 1.18);
  return {
    zoom,
    offsetX: (viewportSize.width - layout.width * zoom) / 2,
    offsetY: (viewportSize.height - layout.height * zoom) / 2,
  };
}

function buildDependencyGraphLayout(files: FileInventoryItem[]): {
  width: number;
  height: number;
  clusters: Array<{
    key: string;
    x: number;
    y: number;
    labelOffsetY: number;
    opacity: number;
    lobes: Array<{ offsetX: number; offsetY: number; radiusX: number; radiusY: number; opacity: number }>;
  }>;
  ambientStars: Array<{ x: number; y: number; r: number; opacity: number }>;
  nodes: DependencyGraphNode[];
  edges: Array<{ from: FileInventoryItem; to: FileInventoryItem; path: string }>;
  fileByPath: Map<string, FileInventoryItem>;
} {
  const fileByPath = new Map(files.map((file) => [file.filePath, file]));
  const maxCriticalMass = Math.max(1, ...files.map((file) => file.fanIn + file.fanOut));
  const directoryNames = [...new Set(files.map((file) => file.topLevelDirectory || '.'))].sort();
  const grouped = new Map<string, FileInventoryItem[]>();

  for (const directoryName of directoryNames) {
    grouped.set(directoryName, []);
  }
  for (const file of files) {
    grouped.get(file.topLevelDirectory || '.')?.push(file);
  }
  for (const group of grouped.values()) {
    group.sort((left, right) => (right.fanIn + right.fanOut) - (left.fanIn + left.fanOut) || left.filePath.localeCompare(right.filePath));
  }

  const anchors = buildConstellationAnchors(directoryNames.length);
  const clusters: ReturnType<typeof buildDependencyGraphLayout>['clusters'] = [];
  const nodes: ReturnType<typeof buildDependencyGraphLayout>['nodes'] = [];

  for (const [directoryIndex, directoryName] of directoryNames.entries()) {
    const bucket = grouped.get(directoryName) ?? [];
    const anchor = anchors[directoryIndex] ?? { x: 0, y: 0 };
    const seed = hashString(directoryName);
    const baseRadiusX = Math.max(72, 30 + Math.sqrt(bucket.length) * 24);
    const baseRadiusY = Math.max(54, 24 + Math.sqrt(bucket.length) * 18);
    const lobes = buildClusterLobes(baseRadiusX, baseRadiusY, seed, bucket.length);
    const radiusY = Math.max(...lobes.map((lobe) => Math.abs(lobe.offsetY) + lobe.radiusY), baseRadiusY);

    clusters.push({
      key: directoryName,
      x: anchor.x,
      y: anchor.y,
      labelOffsetY: radiusY + 24,
      opacity: bucket.length > 24 ? 0.9 : bucket.length > 8 ? 0.72 : 0.52,
      lobes,
    });

    for (const [indexInDirectory, file] of bucket.entries()) {
      const position = buildOrganicNodePosition(file.filePath, indexInDirectory, bucket.length, baseRadiusX, baseRadiusY, seed);
      const criticalMass = file.fanIn + file.fanOut;
      const compactWeight = Math.min(3, criticalMass);
      const criticalScale = Math.sqrt(criticalMass) / Math.sqrt(maxCriticalMass);
      nodes.push({
        file,
        filePath: file.filePath,
        x: anchor.x + position.x,
        y: anchor.y + position.y,
        r: 2.6 + Math.sqrt(compactWeight + 1) * 0.48,
        criticalR: 2.8 + criticalScale * 12.5,
        criticalMass,
      });
    }
  }

  const bounds = getConstellationBounds(nodes, clusters);
  const paddingX = 150;
  const paddingY = 130;
  const normalizedNodes = nodes.map((node) => ({ ...node, x: node.x - bounds.minX + paddingX, y: node.y - bounds.minY + paddingY }));
  const normalizedClusters = clusters.map((cluster) => ({ ...cluster, x: cluster.x - bounds.minX + paddingX, y: cluster.y - bounds.minY + paddingY }));
  const width = Math.max(900, bounds.maxX - bounds.minX + paddingX * 2);
  const height = Math.max(620, bounds.maxY - bounds.minY + paddingY * 2);
  const ambientStars = buildAmbientStars(width, height, files.length, directoryNames.length);
  const nodeByPath = new Map(normalizedNodes.map((node) => [node.filePath, node]));
  const edges = normalizedNodes.flatMap((node) => node.file.resolvedDependencies.flatMap((dependencyPath) => {
    const target = nodeByPath.get(dependencyPath);
    if (!target) return [];
    return [{
      from: node.file,
      to: target.file,
      path: buildGraphEdgePath(node, target),
    }];
  }));

  return { width, height, clusters: normalizedClusters, ambientStars, nodes: normalizedNodes, edges, fileByPath };
}

function buildGraphEdgePath(
  from: { x: number; y: number },
  to: { x: number; y: number },
): string {
  const startX = from.x;
  const startY = from.y;
  const endX = to.x;
  const endY = to.y;
  const bendSeed = hashString(`${startX}:${startY}:${endX}:${endY}`);
  const bend = (pseudoRandom(bendSeed) - 0.5) * 34;
  const midX = (startX + endX) / 2 + bend;
  const midY = (startY + endY) / 2 - bend;
  return `M ${startX} ${startY} Q ${midX} ${midY}, ${endX} ${endY}`;
}

function buildConstellationAnchors(count: number): Array<{ x: number; y: number }> {
  if (count <= 0) return [];
  if (count === 1) return [{ x: 0, y: 0 }];
  if (count === 2) return [{ x: -210, y: 0 }, { x: 210, y: 0 }];

  const anchors: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
  let placed = 1;
  let ring = 1;

  while (placed < count) {
    const ringCount = Math.min(count - placed, 6 + (ring - 1) * 6);
    const radiusX = 300 * ring;
    const radiusY = 220 * ring;
    const angleOffset = ring % 2 === 0 ? Math.PI / ringCount : Math.PI / (ringCount * 2);
    for (let index = 0; index < ringCount; index += 1) {
      const angle = angleOffset + (Math.PI * 2 * index) / ringCount;
      anchors.push({ x: Math.cos(angle) * radiusX, y: Math.sin(angle) * radiusY });
      placed += 1;
      if (placed >= count) break;
    }
    ring += 1;
  }

  return anchors;
}

function buildClusterLobes(
  baseRadiusX: number,
  baseRadiusY: number,
  seed: number,
  size: number,
): Array<{ offsetX: number; offsetY: number; radiusX: number; radiusY: number; opacity: number }> {
  const lobes = [
    { offsetX: 0, offsetY: 0, radiusX: baseRadiusX, radiusY: baseRadiusY, opacity: 0.18 },
    { offsetX: baseRadiusX * 0.18, offsetY: -baseRadiusY * 0.14, radiusX: baseRadiusX * 0.7, radiusY: baseRadiusY * 0.72, opacity: 0.14 },
  ];
  const extraLobes = size > 28 ? 4 : size > 10 ? 3 : 2;

  for (let index = 0; index < extraLobes; index += 1) {
    const angle = ((seed + index * 89) % 360) * (Math.PI / 180);
    const distance = 18 + pseudoRandom(seed + index * 17) * 28;
    lobes.push({
      offsetX: Math.cos(angle) * distance,
      offsetY: Math.sin(angle) * distance,
      radiusX: baseRadiusX * (0.42 + pseudoRandom(seed + index * 23) * 0.18),
      radiusY: baseRadiusY * (0.42 + pseudoRandom(seed + index * 31) * 0.16),
      opacity: 0.08 + pseudoRandom(seed + index * 43) * 0.07,
    });
  }

  return lobes;
}

function buildOrganicNodePosition(
  filePath: string,
  index: number,
  total: number,
  radiusX: number,
  radiusY: number,
  clusterSeed: number,
): { x: number; y: number } {
  const seed = hashString(filePath) + clusterSeed;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const ringScale = total <= 1 ? 0 : Math.sqrt((index + 0.65) / total);
  const angle = index * goldenAngle + pseudoRandom(seed) * 0.72;
  const jitterX = (pseudoRandom(seed + 13) - 0.5) * 18;
  const jitterY = (pseudoRandom(seed + 29) - 0.5) * 16;
  return {
    x: Math.cos(angle) * radiusX * ringScale + jitterX,
    y: Math.sin(angle) * radiusY * ringScale + jitterY,
  };
}

function buildAmbientStars(width: number, height: number, fileCount: number, clusterCount: number): Array<{ x: number; y: number; r: number; opacity: number }> {
  const count = Math.min(90, Math.max(28, Math.floor(Math.sqrt(fileCount) * 2.4) + clusterCount * 4));
  return Array.from({ length: count }, (_, index) => {
    const seed = fileCount * 31 + clusterCount * 17 + index * 97;
    return {
      x: 34 + pseudoRandom(seed) * Math.max(20, width - 68),
      y: 30 + pseudoRandom(seed + 11) * Math.max(20, height - 60),
      r: 0.55 + pseudoRandom(seed + 23) * 1.15,
      opacity: 0.09 + pseudoRandom(seed + 41) * 0.14,
    };
  });
}

function getConstellationBounds(
  nodes: Array<{ x: number; y: number; r: number }>,
  clusters: Array<{ x: number; y: number; lobes: Array<{ offsetX: number; offsetY: number; radiusX: number; radiusY: number }> }>,
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (nodes.length === 0 && clusters.length === 0) return { minX: -360, minY: -280, maxX: 360, maxY: 280 };

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const cluster of clusters) {
    for (const lobe of cluster.lobes) {
      minX = Math.min(minX, cluster.x + lobe.offsetX - lobe.radiusX);
      minY = Math.min(minY, cluster.y + lobe.offsetY - lobe.radiusY);
      maxX = Math.max(maxX, cluster.x + lobe.offsetX + lobe.radiusX);
      maxY = Math.max(maxY, cluster.y + lobe.offsetY + lobe.radiusY);
    }
  }
  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.r - 24);
    minY = Math.min(minY, node.y - node.r - 24);
    maxX = Math.max(maxX, node.x + node.r + 120);
    maxY = Math.max(maxY, node.y + node.r + 24);
  }

  return { minX, minY, maxX, maxY };
}

function hashString(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function clusterNebulaFill(key: string, opacity: number): string {
  const palette = [
    `rgba(86, 137, 255, ${opacity})`,
    `rgba(132, 95, 228, ${opacity})`,
    `rgba(57, 203, 193, ${opacity})`,
    `rgba(245, 154, 91, ${opacity * 0.86})`,
  ];
  return palette[hashString(key) % palette.length] ?? palette[0];
}

function nodeStarFill(language: string): string {
  const palette = ['#bcd2ff', '#d7c6ff', '#bdf4e8', '#ffd5a9', '#f5f0d1'];
  return palette[hashString(language) % palette.length] ?? palette[0];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function matchesQuickFilter(file: FileInventoryItem, filter: QuickFilter): boolean {
  if (filter === 'large') return file.loc >= 800;
  if (filter === 'fanIn') return file.fanIn >= 8;
  if (filter === 'fanOut') return file.fanOut >= 8;
  return true;
}

function basename(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  return normalized.split('/').filter(Boolean).at(-1) ?? filePath;
}

function dirname(filePath: string): string {
  const normalized = filePath.replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '.';
}

function shortFileLabel(filePath: string): string {
  const parts = filePath.split(/[\\/]/).filter(Boolean);
  return parts.length <= 2 ? filePath : parts.slice(-2).join('/');
}

function truncateLabel(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;
}

function HeaderCell({
  label,
  sortKey,
  sortBy,
  sortDirection,
  onSort,
  featured = false,
}: {
  label: string;
  sortKey: SortKey;
  sortBy: SortKey;
  sortDirection: SortDirection;
  onSort: (sortKey: SortKey) => void;
  featured?: boolean;
}) {
  const active = sortBy === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      style={{
        border: 'none',
        background: 'transparent',
        color: active || featured ? ARCHLENS_THEME.textPrimary : ARCHLENS_THEME.textTertiary,
        font: 'inherit',
        fontWeight: active || featured ? 800 : 700,
        textAlign: sortKey === 'path' || sortKey === 'language' ? 'left' : 'right',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      {label}{active ? (sortDirection === 'asc' ? ' ^' : ' v') : ''}
    </button>
  );
}

function RankCell({ rank, highlight }: { rank: number; highlight: boolean }) {
  return (
    <span
      style={{
        justifySelf: 'end',
        width: 24,
        height: 22,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 999,
        background: highlight ? '#e3f4f8' : 'transparent',
        color: highlight ? ARCHLENS_THEME.textPrimary : ARCHLENS_THEME.textTertiary,
        fontSize: 11,
        fontWeight: 800,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {rank}
    </span>
  );
}

function NumberCell({ value, featured = false }: { value: number; featured?: boolean }) {
  return (
    <span
      style={{
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums',
        color: featured ? ARCHLENS_THEME.textPrimary : 'inherit',
        fontWeight: featured ? 850 : 500,
      }}
    >
      {value.toLocaleString()}
    </span>
  );
}

function FileNameCell({ filePath }: { filePath: string }) {
  return (
    <span style={{ minWidth: 0, display: 'grid', gap: 2 }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 800 }}>
        {basename(filePath)}
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: ARCHLENS_THEME.textTertiary, fontSize: 11 }}>
        {dirname(filePath)}
      </span>
    </span>
  );
}

function LanguageBadge({ language }: { language: string }) {
  return (
    <span
      style={{
        justifySelf: 'start',
        border: `1px solid ${ARCHLENS_THEME.borderSubtle}`,
        background: '#f7f6f2',
        color: ARCHLENS_THEME.textSecondary,
        padding: '2px 6px',
        fontSize: 10,
        fontWeight: 700,
      }}
    >
      {language}
    </span>
  );
}

function InventoryFileDrawer({
  file,
  onClose,
  onOpenFile,
}: {
  file: FileInventoryItem;
  onClose: () => void;
  onOpenFile: (filePath: string) => void;
}) {
  return (
    <aside
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        bottom: 12,
        width: 380,
        maxWidth: 'calc(100% - 24px)',
        overflow: 'auto',
        padding: 14,
        background: '#fcfbf8',
        border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
        boxShadow: '0 18px 42px rgba(0,0,0,0.16)',
        zIndex: 2,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, color: ARCHLENS_THEME.textTertiary, fontWeight: 700, marginBottom: 6 }}>FILE DETAILS</div>
          <div style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.3, overflowWrap: 'anywhere' }}>{basename(file.filePath)}</div>
          <div style={{ marginTop: 4, fontSize: 11, color: ARCHLENS_THEME.textTertiary, overflowWrap: 'anywhere' }}>{dirname(file.filePath)}</div>
        </div>
        <button
          onClick={onClose}
          title="Close details"
          style={{
            width: 28,
            height: 26,
            border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
            background: '#fff',
            color: ARCHLENS_THEME.textSecondary,
            fontWeight: 800,
            cursor: 'pointer',
          }}
        >
          x
        </button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
        <MiniMetric label="Lines" value={file.loc} />
        <MiniMetric label="Imports" value={file.importCount} />
        <MiniMetric label="Fan In" value={file.fanIn} />
        <MiniMetric label="Fan Out" value={file.fanOut} />
      </div>
      <button onClick={() => onOpenFile(file.filePath)} style={secondaryButtonStyle}>
        Open File
      </button>
      <div style={{ height: 14 }} />
      <DetailGroup title="Symbols" values={[...file.classes, ...file.functions, ...file.interfaces]} empty="No symbols detected" />
      <div style={{ height: 12 }} />
      <DetailGroup title="Imports" values={file.imports.map((entry) => entry.source)} empty="No imports" />
      <div style={{ height: 12 }} />
      <DetailGroup title="Resolved Dependencies" values={file.resolvedDependencies} empty="No internal dependencies" />
      <div style={{ height: 12 }} />
      <DetailGroup title="Dependents" values={file.dependents} empty="No dependents" />
    </aside>
  );
}

function DetailGroup({ title, values, empty }: { title: string; values: string[]; empty: string }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: ARCHLENS_THEME.textTertiary, marginBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {values.length > 0 ? values.slice(0, 24).map((value) => (
          <span
            key={value}
            style={{
              maxWidth: '100%',
              border: `1px solid ${ARCHLENS_THEME.borderDefault}`,
              background: ARCHLENS_THEME.cardBg,
              padding: '4px 7px',
              borderRadius: 2,
              fontSize: 11,
              color: ARCHLENS_THEME.textSecondary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {value}
          </span>
        )) : (
          <span style={{ fontSize: 12, color: ARCHLENS_THEME.textTertiary }}>{empty}</span>
        )}
        {values.length > 24 && (
          <span style={{ fontSize: 11, color: ARCHLENS_THEME.textTertiary }}>+{values.length - 24} more</span>
        )}
      </div>
    </div>
  );
}

function compareFiles(left: FileInventoryItem, right: FileInventoryItem, key: SortKey, direction: SortDirection): number {
  const factor = direction === 'asc' ? 1 : -1;
  let result = 0;
  switch (key) {
    case 'path':
      result = left.filePath.localeCompare(right.filePath);
      break;
    case 'language':
      result = left.language.localeCompare(right.language) || left.filePath.localeCompare(right.filePath);
      break;
    case 'loc':
      result = left.loc - right.loc;
      break;
    case 'imports':
      result = left.importCount - right.importCount;
      break;
    case 'exports':
      result = left.exportCount - right.exportCount;
      break;
    case 'fanIn':
      result = left.fanIn - right.fanIn;
      break;
    case 'fanOut':
      result = left.fanOut - right.fanOut;
      break;
  }

  return result === 0 ? left.filePath.localeCompare(right.filePath) : result * factor;
}
