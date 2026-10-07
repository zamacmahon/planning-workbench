import React from 'react';

import { workItems } from './data/workItems';
import { resourceDefinitions } from './data/resources';
// STOPPAGE_ID = 'stop-1'
import { STOPPAGE_ID } from './data/constants';
import { assets } from './data/assets';

import {
  sampleAllocation,
  sampleOffsets,
  sampleExpanded,
  sampleExpandedResources,
  sampleOrders,
} from './data/sampleState';

const MINUTE = 60_000;
const SNAP = 15 * MINUTE;
const START = Date.parse('2026-06-29T06:00:00+08:00');
const END = Date.parse('2026-07-03T18:00:00+08:00');
const SPAN = END - START;
const GANTT_WIDTH = 1080;
const SAP_ORDER_URL =
  'https://my301631.s4hana.ondemand.com/ui#MaintenanceOrder-change?MaintenanceOrder=';

const PRIORITIES = {
  1: { label: 'Very High', colour: '#dc2626' },
  2: { label: 'High', colour: '#f97316' },
  3: { label: 'Medium', colour: '#eab308' },
  4: { label: 'Low', colour: '#16a34a' },
};

const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const snapDateTime = (value) => Math.round(value / SNAP) * SNAP;
const snapDuration = (value) => Math.round(value / SNAP) * SNAP;
const leftAt = (value) => `${((value - START) / SPAN) * 100}%`;
const widthFor = (value) => `${(value / SPAN) * 100}%`;

const shortFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Perth',
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const fullFormatter = new Intl.DateTimeFormat('en-AU', {
  timeZone: 'Australia/Perth',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const formatDateTime = (value) =>
  value == null ? '' : shortFormatter.format(new Date(value)).replace(',', '');
const formatFullDateTime = (value) =>
  value == null ? '' : fullFormatter.format(new Date(value)).replace(',', '');
const formatDuration = (minutes) => {
  if (minutes == null) return '';
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}hrs`;
  return `${remainder}m`;
};
const formatPriority = (priority) =>
  priority == null
    ? ''
    : `${priority} ${PRIORITIES[priority]?.label ?? ''}`.trim();

const ticks = Array.from({ length: 10 }, (_, index) => {
  const value = START + index * 12 * 60 * MINUTE;
  return { value, label: formatDateTime(value) };
});

function parseResourceDemand(value) {
  if (!value) return [];
  return value
    .split(/[;,]+/)
    .map((part) => part.trim().match(/^(\d+)\s*x?\s*([A-Za-z0-9_-]+)$/i))
    .filter(Boolean)
    .map((match) => ({
      count: Number(match[1]),
      code: match[2].toUpperCase(),
    }));
}

function calculateResourceSeries(items) {
  const allocatedTimed = items.filter(
    (item) =>
      item.allocatedStoppageId === STOPPAGE_ID &&
      item.startMs != null &&
      item.durationMinutes != null
  );

  const markers = [
    ...new Set(
      allocatedTimed.flatMap((item) => [
        item.startMs,
        item.startMs + item.durationMinutes * MINUTE,
      ])
    ),
  ].sort((a, b) => a - b);

  return resourceDefinitions.map((resource) => ({
    ...resource,
    intervals: markers
      .slice(0, -1)
      .map((startMs, index) => {
        const endMs = markers[index + 1];
        const contributors = allocatedTimed.flatMap((item) => {
          const itemEndMs = item.startMs + item.durationMinutes * MINUTE;
          if (item.startMs >= endMs || itemEndMs <= startMs) return [];
          const demand = parseResourceDemand(item.resourceDemand).find(
            (entry) => entry.code === resource.code
          );
          return demand ? [{ id: item.id, count: demand.count }] : [];
        });
        return {
          startMs,
          endMs,
          count: contributors.reduce(
            (sum, contributor) => sum + contributor.count,
            0
          ),
          contributors,
        };
      })
      .filter((interval) => interval.count > 0),
  }));
}

function applyState(allocation, offsets) {
  return workItems.map((source) => {
    const allocatedStoppageId = Object.prototype.hasOwnProperty.call(
      allocation,
      source.id
    )
      ? allocation[source.id]
      : source.allocatedStoppageId;

    if (source.startMs == null) return { ...source, allocatedStoppageId };

    const durationMs = (source.durationMinutes ?? 0) * MINUTE;
    return {
      ...source,
      allocatedStoppageId,
      startMs: clamp(
        snapDateTime(source.startMs + (offsets[source.id] ?? 0)),
        START,
        END - durationMs
      ),
    };
  });
}

function ordered(items, order) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)
  );
}

function deriveRows(items, expanded, orders) {
  const rows = [];

  for (const assetDefinition of assets) {
    const assetRowId = `asset-${assetDefinition.id}`;

    const assetItems = items.filter(
      (item) => item.asset === assetDefinition.id
    );

    const assetForecastMarkers = [
      ...new Set(
        assetItems
          .filter(
            (item) =>
              item.forecastMs != null &&
              item.forecastMs >= START &&
              item.forecastMs <= END
          )
          .map((item) => item.forecastMs)
      ),
    ].sort((a, b) => a - b);

    const allocated = ordered(
      assetItems.filter((item) => item.allocatedStoppageId === STOPPAGE_ID),
      orders.allocated
    );

    const unallocated = ordered(
      assetItems.filter(
        (item) =>
          item.visibleInUnallocatedFor === STOPPAGE_ID &&
          item.allocatedStoppageId == null
      ),
      orders.unallocated
    );

    const topLevelReasons = ordered(
      assetItems.filter(
        (item) => item.isStoppageReason && item.allocatedStoppageId == null
      ),
      orders.topLevel
    );

    const hasStoppage = allocated.length > 0 || unallocated.length > 0;

    const hasChildren = hasStoppage || topLevelReasons.length > 0;

    rows.push({
      id: assetRowId,
      rowKey: assetRowId,
      type: 'asset',
      level: 0,
      hasChildren,
      description: assetDefinition.description,
      asset: assetDefinition.id,
      priority: null,
      forecastMarkers: assetForecastMarkers,
    });

    if (!expanded[assetRowId]) {
      continue;
    }

    if (hasStoppage) {
      const timed = allocated.filter(
        (item) => item.startMs != null && item.durationMinutes != null
      );

      const startMs = timed.length
        ? Math.min(...timed.map((item) => item.startMs))
        : null;

      const finishMs = timed.length
        ? Math.max(
            ...timed.map((item) => item.startMs + item.durationMinutes * MINUTE)
          )
        : null;

      const peakResourceDemand = calculateResourceSeries(allocated)
        .map((resource) => ({
          code: resource.code,
          peak: Math.max(
            0,
            ...resource.intervals.map((interval) => interval.count)
          ),
        }))
        .filter((resource) => resource.peak > 0)
        .map((resource) => `${resource.peak}x ${resource.code}`)
        .join(', ');

      const allocatedPriorities = allocated
        .map((item) => item.priority)
        .filter((priority) => priority != null);

      const stoppageId = `${assetDefinition.id}-${STOPPAGE_ID}`;

      const unallocatedId = `${stoppageId}-unallocated`;

      rows.push({
        id: stoppageId,
        rowKey: stoppageId,
        type: 'stoppage',
        level: 1,
        hasChildren: true,
        description: `${assetDefinition.id}: 250HR SERVICE AND SEAT`,
        asset: assetDefinition.id,
        priority: allocatedPriorities.length
          ? Math.min(...allocatedPriorities)
          : null,
        startMs,
        durationMinutes:
          startMs == null || finishMs == null
            ? null
            : Math.round((finishMs - startMs) / MINUTE),
        resourceDemand: peakResourceDemand,
        forecastMarkers: [
          ...new Set(
            allocated
              .filter(
                (item) =>
                  item.isStoppageReason &&
                  item.forecastMs != null &&
                  item.forecastMs >= START &&
                  item.forecastMs <= END
              )
              .map((item) => item.forecastMs)
          ),
        ].sort((a, b) => a - b),
        barClass: 'bg-cyan-800 text-white',
      });

      if (expanded[stoppageId]) {
        rows.push(
          ...allocated.map((item) => ({
            ...item,
            rowKey: `allocated-${item.id}`,
            type: 'allocated',
            level: 2,
          }))
        );

        rows.push({
          id: unallocatedId,
          rowKey: unallocatedId,
          type: 'unallocatedHeader',
          level: 2,
          hasChildren: unallocated.length > 0,
          description: 'Unallocated Work',
          asset: assetDefinition.id,
          priority: null,
        });

        if (unallocated.length > 0 && expanded[unallocatedId]) {
          rows.push(
            ...unallocated.map((item) => ({
              ...item,
              rowKey: `unallocated-${item.id}`,
              type: 'unallocated',
              level: 3,
            }))
          );
        }
      }
    }

    rows.push(
      ...topLevelReasons.map((item) => ({
        ...item,
        rowKey: `top-${item.id}`,
        type: 'topReason',
        level: 1,
      }))
    );
  }

  return rows;
}

function useTimelineScroll() {
  const itemsRef = React.useRef(null);
  const resourcesRef = React.useRef(null);
  const lockRef = React.useRef(false);
  const [scrollLeft, setScrollLeft] = React.useState(0);

  const sync = (source, target) => {
    if (!source.current) return;
    const next = source.current.scrollLeft;
    setScrollLeft(next);
    if (lockRef.current || !target.current) return;
    lockRef.current = true;
    target.current.scrollLeft = next;
    requestAnimationFrame(() => {
      lockRef.current = false;
    });
  };

  return {
    itemsRef,
    resourcesRef,
    scrollLeft,
    onItemsScroll: () => sync(itemsRef, resourcesRef),
    onResourcesScroll: () => sync(resourcesRef, itemsRef),
  };
}

function Accordion({ title, children }) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="border-b border-slate-300">
      <button
        className="h-8 w-full px-2 text-left text-xs font-semibold"
        onClick={() => setOpen(!open)}
      >
        {open ? '▼' : '▶'} {title}
      </button>
      {open && <div className="px-2 pb-3 text-xs">{children}</div>}
    </section>
  );
}

function Config({ overlays, setOverlays }) {
  const toggle = (key) =>
    setOverlays((current) => ({
      ...current,
      [key]: !current[key],
    }));

  return (
    <aside className="h-full overflow-auto border-r border-slate-300 bg-white">
      <Accordion title="Overlays">
        <label className="mb-2 flex gap-2">
          <input
            type="checkbox"
            checked={overlays.forecasts}
            onChange={() => toggle('forecasts')}
          />
          Show Forecasts
        </label>
        <label className="mb-2 flex gap-2">
          <input
            type="checkbox"
            checked={overlays.resources}
            onChange={() => toggle('resources')}
          />
          Show Resources
        </label>
        <label className="mb-2 flex gap-2">
          <input
            type="checkbox"
            checked={overlays.priorities}
            onChange={() => toggle('priorities')}
          />
          Show Priorities
        </label>
        <label className="flex gap-2">
          <input
            type="checkbox"
            checked={overlays.descriptions}
            onChange={() => toggle('descriptions')}
          />
          Show Work Order Descriptions
        </label>
      </Accordion>

      <Accordion title="Filters">
        <div className="grid grid-cols-[42px_1fr] gap-y-2">
          <span>Site</span>
          <input className="border px-1" defaultValue="M776 Tropicana" />
          <span>Fleet</span>
          <input className="border px-1" defaultValue="TK_HL Truck Haul" />
          <span>Asset</span>
          <input className="border px-1" defaultValue="TD6310" />
        </div>
      </Accordion>
    </aside>
  );
}

function TimelineGrid() {
  return (
    <div
      className="pointer-events-none absolute inset-0 grid"
      style={{ width: GANTT_WIDTH, gridTemplateColumns: 'repeat(10, 108px)' }}
    >
      {ticks.map((tick) => (
        <div key={tick.value} className="border-r border-slate-200" />
      ))}
    </div>
  );
}

function TimelineHeader({ scrollLeft }) {
  return (
    <div className="h-8 overflow-hidden bg-white">
      <div
        className="grid h-8"
        style={{
          width: GANTT_WIDTH,
          transform: `translateX(-${scrollLeft}px)`,
          gridTemplateColumns: 'repeat(10, 108px)',
        }}
      >
        {ticks.map((tick) => (
          <div
            key={tick.value}
            className="border-r border-slate-200 px-1 py-2 text-[10px]"
          >
            {tick.label}
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkOrderLink({ item, children, className = '' }) {
  if (!item.workOrderId) return children;
  const url = `${SAP_ORDER_URL}${encodeURIComponent(item.workOrderId)}`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={url}
      className={`text-sky-700 underline underline-offset-2 hover:text-sky-900 ${className}`}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {children}
    </a>
  );
}

function ForecastCross() {
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2">
      <span className="absolute left-1 top-0 h-2.5 w-0.5 rotate-45 bg-slate-900" />
      <span className="absolute left-1 top-0 h-2.5 w-0.5 -rotate-45 bg-slate-900" />
    </span>
  );
}

function TableRow({
  row,
  template,
  expanded,
  toggle,
  allocate,
  remove,
  moveRow,
  canMove,
}) {
  const height = row.type === 'unallocatedHeader' ? 'h-8' : 'h-16';
  const finishMs =
    row.startMs != null && row.durationMinutes != null
      ? row.startMs + row.durationMinutes * MINUTE
      : null;
  const reorderable = ['allocated', 'unallocated', 'topReason'].includes(
    row.type
  );

  return (
    <div
      className={`grid ${height} border-b border-slate-200 text-xs`}
      style={{ gridTemplateColumns: template }}
    >
      <div
        className="flex min-w-0 items-start border-r px-2 py-2"
        style={{ paddingLeft: `${8 + row.level * 18}px` }}
      >
        {row.hasChildren ? (
          <button className="mr-1 shrink-0" onClick={() => toggle(row.id)}>
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="mr-4" />
        )}

        <span className="min-w-0 flex-1 truncate">
          {row.workOrderId ? (
            <>
              <WorkOrderLink item={row}>{row.workOrderId}</WorkOrderLink>{' '}
              {row.operationId}
              {': '}
              {row.description}
            </>
          ) : (
            row.description
          )}
        </span>

        {reorderable && (
          <span className="ml-2 inline-flex gap-0.5">
            <button
              className="h-5 w-5 border disabled:text-slate-300"
              disabled={!canMove(row, -1)}
              onClick={() => moveRow(row, -1)}
            >
              ↑
            </button>
            <button
              className="h-5 w-5 border disabled:text-slate-300"
              disabled={!canMove(row, 1)}
              onClick={() => moveRow(row, 1)}
            >
              ↓
            </button>
          </span>
        )}
      </div>

      <div className="overflow-hidden border-r px-2 py-2 text-[11px] whitespace-nowrap">
        {row.type === 'allocated' && (
          <button className="text-sky-700" onClick={() => remove(row.id)}>
            [-] Remove from Stoppage
          </button>
        )}
        {(row.type === 'unallocated' || row.type === 'topReason') && (
          <button className="text-sky-700" onClick={() => allocate(row.id)}>
            {row.workOrderId ? '[+] Add to Stoppage' : '[+] Create Work Order'}
          </button>
        )}
        {row.type === 'stoppage' && (
          <span className="text-sky-700">[-] Delete Stoppage</span>
        )}
      </div>

      <div className="border-r px-2 py-2 font-semibold">{row.asset}</div>
      <div className="border-r px-2 py-2 whitespace-nowrap">
        {formatPriority(row.priority)}
      </div>
      <div className="border-r px-2 py-2 whitespace-nowrap">
        {formatDateTime(row.startMs)}
      </div>
      <div className="border-r px-2 py-2 whitespace-nowrap">
        {formatDateTime(finishMs)}
      </div>
      <div className="border-r px-2 py-2 whitespace-nowrap">
        {formatDateTime(row.forecastMs)}
      </div>
      <div className="border-r px-2 py-2 whitespace-nowrap">
        {row.resourceDemand ?? ''}
      </div>
    </div>
  );
}

function BarAnnotation({ row, durationMs, overlays }) {
  if (row.startMs == null || durationMs == null) return null;

  const priority = PRIORITIES[row.priority];
  const showLabel = overlays.descriptions && Boolean(row.workOrderId);
  const showPriority = overlays.priorities && Boolean(priority);

  if (!showLabel && !showPriority) return null;

  return (
    <div
      className="absolute top-8 z-30 flex -translate-x-1/2 items-start justify-center gap-1"
      style={{
        left: `calc(${leftAt(row.startMs)} + (${widthFor(durationMs)} / 2))`,
      }}
    >
      {showLabel && (
        <div className="border-2 border-cyan-500 bg-white px-1 text-center text-[10px]">
          <WorkOrderLink item={row} className="block whitespace-nowrap">
            MO {row.workOrderId}
          </WorkOrderLink>
          <span className="whitespace-nowrap">{row.description}</span>
        </div>
      )}

      {showPriority && (
        <span
          className="mt-1 h-4 w-4 shrink-0 rounded-full border-2 border-white shadow ring-1 ring-slate-700"
          style={{ backgroundColor: priority.colour }}
          title={`Priority ${row.priority} ${priority.label}`}
          aria-label={`Priority ${row.priority} ${priority.label}`}
        />
      )}
    </div>
  );
}

function GanttRow({ row, overlays, startDrag, moveToForecast }) {
  const height = row.type === 'unallocatedHeader' ? 'h-8' : 'h-16';

  const durationMs =
    row.durationMinutes == null ? null : row.durationMinutes * MINUTE;

  const markers =
    row.type === 'asset' || row.type === 'stoppage'
      ? row.forecastMarkers ?? []
      : row.forecastMs == null
      ? []
      : [row.forecastMs];

  return (
    <div
      className={`relative ${height} border-b border-slate-200 bg-white`}
      style={{ width: GANTT_WIDTH }}
    >
      <TimelineGrid />

      {overlays.resources && row.resourceDemand && row.startMs != null && (
        <div
          className="absolute top-3 z-20 text-[10px] text-red-700"
          style={{
            left: `calc(${leftAt(row.startMs)} - 54px)`,
          }}
        >
          {row.resourceDemand}
        </div>
      )}

      {row.startMs != null && durationMs != null && (
        <div
          className={`absolute top-2 z-20 flex h-6 cursor-ew-resize select-none items-center justify-center rounded text-[10px] font-semibold ${
            row.barClass ?? ''
          }`}
          style={{
            left: leftAt(row.startMs),
            width: widthFor(durationMs),
            touchAction: 'none',
          }}
          onPointerDown={(event) => startDrag(event, row)}
        >
          {formatDuration(row.durationMinutes)}
        </div>
      )}

      {overlays.forecasts &&
        markers.map((forecastMs, index) => {
          const showVarianceLine = row.type !== 'asset' && row.startMs != null;

          const lineStart = showVarianceLine
            ? Math.min(row.startMs, forecastMs)
            : null;

          const lineWidth = showVarianceLine
            ? Math.abs(row.startMs - forecastMs)
            : 0;

          const tooltip =
            row.type === 'asset'
              ? `Forecasted ${formatFullDateTime(forecastMs)}`
              : `Forecasted ${formatFullDateTime(
                  forecastMs
                )}\nClick to move start date to align to forecast.`;

          return (
            <React.Fragment key={`${forecastMs}-${index}`}>
              {lineStart != null && lineWidth > 0 && (
                <div
                  className="absolute top-5 z-10 border-t border-dotted border-green-700"
                  style={{
                    left: leftAt(lineStart),
                    width: widthFor(lineWidth),
                  }}
                />
              )}

              <button
                className="absolute top-5 z-40 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-900 bg-sky-100"
                style={{
                  left: leftAt(forecastMs),
                }}
                title={tooltip}
                onClick={() => {
                  if (row.type !== 'asset') {
                    moveToForecast(row, forecastMs);
                  }
                }}
              >
                <ForecastCross />
              </button>
            </React.Fragment>
          );
        })}

      <BarAnnotation row={row} durationMs={durationMs} overlays={overlays} />
    </div>
  );
}

function ItemsPanel({
  rows,
  overlays,
  timeline,
  expanded,
  toggle,
  allocate,
  remove,
  startDrag,
  moveToForecast,
  widths,
  setWidths,
  orders,
  setOrders,
}) {
  const template = widths.map((width) => `${width}px`).join(' ');
  const contentWidth = widths.reduce((sum, width) => sum + width, 0);
  const [tableScrollLeft, setTableScrollLeft] = React.useState(0);
  const headings = [
    'Description',
    'Action',
    'Asset',
    'Priority',
    'Start',
    'End',
    'Forecast',
    'Resources',
  ];

  const resize = (event, index) => {
    event.preventDefault();
    const originX = event.clientX;
    const originWidth = widths[index];

    const move = (moveEvent) => {
      setWidths((current) =>
        current.map((width, currentIndex) =>
          currentIndex === index
            ? Math.max(60, originWidth + moveEvent.clientX - originX)
            : width
        )
      );
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const sectionKey = (row) => {
    if (row.type === 'allocated') return 'allocated';
    if (row.type === 'topReason') return 'topLevel';
    return 'unallocated';
  };

  const idsFor = (row) =>
    rows
      .filter(
        (candidate) =>
          candidate.type === row.type &&
          sectionKey(candidate) === sectionKey(row)
      )
      .map((candidate) => candidate.id);

  const canMove = (row, direction) => {
    const ids = idsFor(row);
    const index = ids.indexOf(row.id);
    return (
      index >= 0 && index + direction >= 0 && index + direction < ids.length
    );
  };

  const moveRow = (row, direction) => {
    setOrders((current) => {
      const key = sectionKey(row);
      const visibleIds = idsFor(row);
      const existing = current[key] ?? [];
      const ids = [
        ...existing.filter((id) => visibleIds.includes(id)),
        ...visibleIds.filter((id) => !existing.includes(id)),
      ];
      const from = ids.indexOf(row.id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= ids.length) return current;
      [ids[from], ids[to]] = [ids[to], ids[from]];
      return { ...current, [key]: ids };
    });
  };

  return (
    <section className="grid min-h-0 flex-1 grid-rows-[2rem_1fr] border-b border-slate-300">
      <div className="grid grid-cols-[630px_minmax(0,1fr)] border-b border-slate-300">
        <div className="overflow-hidden border-r">
          <div
            className="grid h-8 text-xs font-semibold"
            style={{
              width: contentWidth,
              transform: `translateX(-${tableScrollLeft}px)`,
              gridTemplateColumns: template,
            }}
          >
            {headings.map((heading, index) => (
              <div
                key={heading}
                className="relative overflow-hidden border-r px-2 py-2 whitespace-nowrap"
              >
                {heading}
                <div
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                  onPointerDown={(event) => resize(event, index)}
                />
              </div>
            ))}
          </div>
        </div>

        <TimelineHeader scrollLeft={timeline.scrollLeft} />
      </div>

      <div className="min-h-0 overflow-y-auto overflow-x-hidden">
        <div className="grid grid-cols-[630px_minmax(0,1fr)]">
          <div
            className="overflow-x-auto border-r"
            onScroll={(event) =>
              setTableScrollLeft(event.currentTarget.scrollLeft)
            }
          >
            <div style={{ width: contentWidth }}>
              {rows.map((row) => (
                <TableRow
                  key={`table-${row.rowKey}`}
                  row={row}
                  template={template}
                  expanded={expanded[row.id]}
                  toggle={toggle}
                  allocate={allocate}
                  remove={remove}
                  moveRow={moveRow}
                  canMove={canMove}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden">
            <div
              ref={timeline.itemsRef}
              onScroll={timeline.onItemsScroll}
              className="overflow-x-auto overflow-y-hidden"
            >
              <div style={{ width: GANTT_WIDTH }}>
                {rows.map((row) => (
                  <GanttRow
                    key={`gantt-${row.rowKey}`}
                    row={row}
                    overlays={overlays}
                    startDrag={startDrag}
                    moveToForecast={moveToForecast}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ResourceDescription({ resource, expanded, toggle }) {
  const peak = Math.max(
    0,
    ...resource.intervals.map((interval) => interval.count)
  );

  return (
    <div
      className={`${
        expanded ? 'h-24' : 'h-8'
      } border-b border-slate-200 px-2 py-2 text-xs font-semibold`}
    >
      <button onClick={() => toggle(resource.code)}>
        {expanded ? '▼' : '▶'} {resource.label}
        <span className="ml-2 font-normal text-slate-500">
          peak {peak} / capacity {resource.capacity}
        </span>
      </button>
    </div>
  );
}

function ResourceGraph({ resource, expanded }) {
  const maxLevel = Math.max(
    resource.capacity,
    ...resource.intervals.map((interval) => interval.count),
    1
  );

  return (
    <div
      className={`relative ${
        expanded ? 'h-24' : 'h-8'
      } border-b border-slate-200 bg-white`}
      style={{ width: GANTT_WIDTH }}
    >
      <TimelineGrid />

      {expanded &&
        resource.intervals.map((interval) => {
          const overCapacity = interval.count > resource.capacity;
          const tooltip = `${formatFullDateTime(
            interval.startMs
          )} to ${formatFullDateTime(interval.endMs)}\n${resource.code}: ${
            interval.count
          } in use\nOrders: ${interval.contributors
            .map((item) => item.id)
            .join(', ')}`;

          return (
            <div
              key={`${interval.startMs}-${interval.endMs}`}
              className="absolute bottom-1"
              style={{
                left: leftAt(interval.startMs),
                right: `${100 - ((interval.endMs - START) / SPAN) * 100}%`,
                height: `${(interval.count / maxLevel) * 80}px`,
                backgroundColor: overCapacity ? '#dc2626' : resource.colour,
              }}
              title={tooltip}
            >
              <span className="absolute left-1 top-0 text-[9px] text-white">
                {interval.count}
              </span>
            </div>
          );
        })}
    </div>
  );
}

function ResourcesPanel({
  resourceSeries,
  timeline,
  expandedResources,
  setExpandedResources,
}) {
  const [open, setOpen] = React.useState(true);

  const toggle = (code) => {
    setExpandedResources((current) => ({
      ...current,
      [code]: !current[code],
    }));
  };

  return (
    <section
      className={`grid ${open ? 'h-56' : 'h-8'} shrink-0 grid-rows-[2rem_1fr]`}
    >
      <div className="grid grid-cols-[630px_minmax(0,1fr)] border-b border-slate-300">
        <button
          className="border-r px-2 text-left text-xs font-semibold"
          onClick={() => setOpen(!open)}
        >
          {open ? '▼' : '▶'} Resources
        </button>
        <div />
      </div>

      {open && (
        <div className="min-h-0 overflow-y-auto overflow-x-hidden">
          <div className="grid grid-cols-[630px_minmax(0,1fr)]">
            <div className="border-r">
              {resourceSeries.map((resource) => (
                <ResourceDescription
                  key={resource.code}
                  resource={resource}
                  expanded={expandedResources[resource.code]}
                  toggle={toggle}
                />
              ))}
            </div>

            <div className="min-w-0 overflow-hidden">
              <div
                ref={timeline.resourcesRef}
                onScroll={timeline.onResourcesScroll}
                className="overflow-x-auto overflow-y-hidden"
              >
                <div style={{ width: GANTT_WIDTH }}>
                  {resourceSeries.map((resource) => (
                    <ResourceGraph
                      key={resource.code}
                      resource={resource}
                      expanded={expandedResources[resource.code]}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

export default function PlanningGridFixedAnnotationsV10() {
  const [overlays, setOverlays] = React.useState({
    forecasts: true,
    resources: true,
    priorities: true,
    descriptions: true,
  });
  const [allocation, setAllocation] = React.useState(sampleAllocation);
  const [offsets, setOffsets] = React.useState(sampleOffsets);
  const [expanded, setExpanded] = React.useState(sampleExpanded);
  const [expandedResources, setExpandedResources] = React.useState(
    sampleExpandedResources
  );
  const [widths, setWidths] = React.useState([
    260, 170, 70, 105, 125, 125, 125, 100,
  ]);
  const [orders, setOrders] = React.useState(sampleOrders);

  const timeline = useTimelineScroll();
  const items = applyState(allocation, offsets);
  const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
  const rows = deriveRows(items, expanded, orders);
  const resourceSeries = calculateResourceSeries(items);

  const setManyStarts = (updates) => {
    setOffsets((current) => {
      const next = { ...current };

      for (const update of updates) {
        const source = workItems.find((item) => item.id === update.id);
        const item = itemById[update.id];
        if (
          !source ||
          !item ||
          source.startMs == null ||
          item.durationMinutes == null
        ) {
          continue;
        }

        const durationMs = item.durationMinutes * MINUTE;
        next[update.id] =
          clamp(snapDateTime(update.startMs), START, END - durationMs) -
          source.startMs;
      }

      return next;
    });
  };

  const moveToForecast = (row, forecastMs) => {
    const target = snapDateTime(forecastMs);

    if (row.type !== 'stoppage') {
      setManyStarts([{ id: row.id, startMs: target }]);
      return;
    }

    if (row.startMs == null) return;

    const delta = target - row.startMs;
    setManyStarts(
      items
        .filter(
          (item) =>
            item.allocatedStoppageId === row.id &&
            item.startMs != null &&
            item.durationMinutes != null
        )
        .map((item) => ({
          id: item.id,
          startMs: item.startMs + delta,
        }))
    );
  };

  const startDrag = (event, row) => {
    if (row.startMs == null || row.durationMinutes == null) return;

    event.preventDefault();
    event.stopPropagation();

    const originX = event.clientX;
    const members =
      row.type === 'stoppage'
        ? items.filter(
            (item) =>
              item.allocatedStoppageId === row.id &&
              item.startMs != null &&
              item.durationMinutes != null
          )
        : [itemById[row.id]].filter(Boolean);

    const origins = Object.fromEntries(
      members.map((item) => [item.id, item.startMs])
    );

    const move = (moveEvent) => {
      const delta = snapDuration(
        ((moveEvent.clientX - originX) / GANTT_WIDTH) * SPAN
      );

      setManyStarts(
        members.map((item) => ({
          id: item.id,
          startMs: origins[item.id] + delta,
        }))
      );
    };

    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };

    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  return (
    <div className="flex h-screen flex-col bg-white text-slate-950">
      <header className="border-b border-slate-300 px-4 py-2">
        <h1 className="text-xl font-bold">Planning grid / stoppage mockup</h1>
        <p className="text-xs text-slate-700">
          The work-order label and priority marker share one centred annotation
          container beneath each scheduled bar.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)]">
        <Config overlays={overlays} setOverlays={setOverlays} />

        <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
          <ItemsPanel
            rows={rows}
            overlays={overlays}
            timeline={timeline}
            expanded={expanded}
            toggle={(id) => {
              setExpanded((current) => ({
                ...current,
                [id]: !current[id],
              }));
            }}
            allocate={(id) => {
              setAllocation((current) => ({
                ...current,
                [id]: STOPPAGE_ID,
              }));
            }}
            remove={(id) => {
              setAllocation((current) => ({
                ...current,
                [id]: null,
              }));
            }}
            startDrag={startDrag}
            moveToForecast={moveToForecast}
            widths={widths}
            setWidths={setWidths}
            orders={orders}
            setOrders={setOrders}
          />

          <ResourcesPanel
            resourceSeries={resourceSeries}
            timeline={timeline}
            expandedResources={expandedResources}
            setExpandedResources={setExpandedResources}
          />
        </main>
      </div>
    </div>
  );
}
