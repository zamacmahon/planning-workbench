import React from 'react';

import { SAP_ORDER_URL } from './data/misc';
import { workItems } from './data/workItems';
import { resourceDefinitions } from './data/resources';
import { assets } from './data/assets';
import { resourceCapacity } from './data/resourceCapacity';

import {
  sampleStoppages,
  sampleAllocation,
  sampleSchedule,
  sampleExpanded,
  sampleExpandedResources,
  sampleOrders,
} from './data/sampleState';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SNAP = 15 * MINUTE;
const DEFAULT_TIMELINE_START = Date.parse('2026-06-29T06:00:00+08:00');
const DEFAULT_TIMELINE_END = Date.parse('2026-07-03T18:00:00+08:00');

const TIMELINE_CONFIG = {
  edgeThresholdViewportFraction: 0.25,

  zoomLevels: [
    {
      pixelsPerHour: 3,
      label: 'Month',
      tickHours: 24,
      bufferIntervals: 7,
    },
    {
      pixelsPerHour: 6,
      label: 'Fortnight',
      tickHours: 12,
      bufferIntervals: 2,
    },
    {
      pixelsPerHour: 10,
      label: 'Week',
      tickHours: 12,
      bufferIntervals: 2,
      default: true,
    },
    {
      pixelsPerHour: 18,
      label: 'Shift',
      tickHours: 6,
      bufferIntervals: 1,
    },
    {
      pixelsPerHour: 36,
      label: 'Detailed',
      tickHours: 3,
      bufferIntervals: 1,
    },
  ],
};

const DEFAULT_TIMELINE_ZOOM =
  TIMELINE_CONFIG.zoomLevels.find(
    (level) => level.default
  ) ??
  TIMELINE_CONFIG.zoomLevels[0];

function getZoomLevel(
  pixelsPerHour
) {
  return (
    TIMELINE_CONFIG.zoomLevels
      .slice()
      .reverse()
      .find(
        (level) =>
          pixelsPerHour >=
          level.pixelsPerHour
      ) ??
    TIMELINE_CONFIG.zoomLevels[0]
  );
}

const PRIORITIES = {
  1: { label: 'Very High', colour: '#dc2626', symbol: '⬟' },
  2: { label: 'High', colour: '#f97316', symbol: '◆' },
  3: { label: 'Medium', colour: '#eab308', symbol: '■' },
  4: { label: 'Low', colour: '#16a34a', symbol: '●' },
};

const AVAILABILITIES = {
  1: { label: 'All Available', colour: '#16a34a', symbol: '⬢' },
  2: { label: 'Possibly Available', colour: '#eab308', symbol: '⬡' },
  3: { label: 'Not Available', colour: '#dc2626', symbol: '✕' },
}

const clamp = (value, lower, upper) => Math.max(lower, Math.min(upper, value));
const snapDateTime = (value) => Math.round(value / SNAP) * SNAP;
const snapDuration = (value) => Math.round(value / SNAP) * SNAP;

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

const capacityDateFormatter =
  new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

const capacityTimeFormatter =
  new Intl.DateTimeFormat('en-AU', {
    timeZone: 'Australia/Perth',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

const formatDateInput = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Perth',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));

  const year = parts.find(
    (part) => part.type === 'year'
  )?.value;

  const month = parts.find(
    (part) => part.type === 'month'
  )?.value;

  const day = parts.find(
    (part) => part.type === 'day'
  )?.value;

  return `${year}-${month}-${day}`;
};

const formatDateTimeInput = (value) => {
  const parts = new Intl.DateTimeFormat(
    'en-CA',
    {
      timeZone: 'Australia/Perth',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }
  ).formatToParts(new Date(value));

  const getPart = (type) =>
    parts.find(
      (part) => part.type === type
    )?.value ?? '';

  return `${getPart('year')}-${getPart(
    'month'
  )}-${getPart('day')}T${getPart(
    'hour'
  )}:${getPart('minute')}`;
};

const parseDateTimeInput = (value) =>
  Date.parse(`${value}:00+08:00`);

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

function calculateResourceSeries(
  items,
  capacityIntervals = [],
  rangeStartMs = DEFAULT_TIMELINE_START,
  rangeEndMs = DEFAULT_TIMELINE_END
) {
  const allocatedTimed = items.filter(
    (item) =>
      item.allocatedStoppageId != null &&
      item.startMs != null &&
      item.durationMinutes != null
  );

  return resourceDefinitions.map((resource) => {
    const resourceCapacityIntervals =
      capacityIntervals.filter(
        (interval) =>
          interval.resourceCode === resource.code &&
          interval.endMs > rangeStartMs &&
          interval.startMs < rangeEndMs
      );

    const demandBoundaries =
      allocatedTimed.flatMap((item) => [
        clamp(
          item.startMs,
          rangeStartMs,
          rangeEndMs
        ),
        clamp(
          item.startMs +
          item.durationMinutes * MINUTE,
          rangeStartMs,
          rangeEndMs
        ),
      ]);

    const capacityBoundaries =
      resourceCapacityIntervals.flatMap(
        (interval) => [
          clamp(
            interval.startMs,
            rangeStartMs,
            rangeEndMs
          ),
          clamp(
            interval.endMs,
            rangeStartMs,
            rangeEndMs
          ),
        ]
      );

    const markers = [
      ...new Set([
        rangeStartMs,
        rangeEndMs,
        ...demandBoundaries,
        ...capacityBoundaries,
      ]),
    ]
      .filter(
        (value) =>
          value >= rangeStartMs &&
          value <= rangeEndMs
      )
      .sort((a, b) => a - b);

    const intervals = markers
      .slice(0, -1)
      .map((startMs, index) => {
        const endMs = markers[index + 1];

        const contributors =
          allocatedTimed.flatMap((item) => {
            const itemEndMs =
              item.startMs +
              item.durationMinutes * MINUTE;

            if (
              item.startMs >= endMs ||
              itemEndMs <= startMs
            ) {
              return [];
            }

            const demand =
              parseResourceDemand(
                item.resourceDemand
              ).find(
                (entry) =>
                  entry.code === resource.code
              );

            return demand
              ? [
                {
                  id: item.id,
                  count: demand.count,
                },
              ]
              : [];
          });

        const capacityInterval =
          resourceCapacityIntervals.find(
            (interval) =>
              interval.startMs <= startMs &&
              interval.endMs >= endMs
          );

        const hasCapacityData =
          capacityInterval != null &&
          capacityInterval.capacity != null;

        return {
          startMs,
          endMs,
          count: contributors.reduce(
            (sum, contributor) =>
              sum + contributor.count,
            0
          ),
          capacity:
            capacityInterval?.capacity ?? 0,
          hasCapacityData,
          contributors,
        };
      })
      .filter(
        (interval) =>
          interval.endMs > interval.startMs
      );

    return {
      ...resource,
      intervals,
    };
  });
}

function applyState(allocation, schedule) {
  return workItems.map((source) => {
    const scheduleEntry = schedule[source.id];

    return {
      ...source,
      startMs: scheduleEntry?.startMs ?? source.startMs,
      allocatedStoppageId: allocation[source.id] ?? null,
    };
  });
}

function ordered(items, order) {
  const rank = new Map(order.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (rank.get(a.id) ?? 9999) - (rank.get(b.id) ?? 9999)
  );
}

function deriveRows(
  items,
  stoppages,
  expanded,
  orders,
  rangeStartMs,
  rangeEndMs
) {
  const rows = [];

  for (const assetDefinition of assets) {
    const assetRowId = `asset-${assetDefinition.id}`;

    const assetItems = items.filter(
      (item) => item.asset === assetDefinition.id
    );

    const assetStoppages = Object.values(stoppages).filter(
      (stoppage) =>
        stoppage.asset === assetDefinition.id
    );

    const assetStoppageSummaries = assetStoppages
      .map((stoppage) => {
        const allocated = assetItems.filter(
          (item) =>
            item.allocatedStoppageId === stoppage.id
        );

        if (allocated.length === 0) {
          return null;
        }

        const timed = allocated.filter(
          (item) =>
            item.startMs != null &&
            item.durationMinutes != null
        );

        if (timed.length === 0) {
          return null;
        }

        const startMs = Math.min(
          ...timed.map((item) => item.startMs)
        );

        const finishMs = Math.max(
          ...timed.map(
            (item) =>
              item.startMs +
              item.durationMinutes * MINUTE
          )
        );

        const priorities = allocated
          .map((item) => item.priority)
          .filter((priority) => priority != null);

        const availabilities = allocated
          .map((item) => item.availability)
          .filter(
            (availability) =>
              availability != null
          );

        const resourceDemand =
          calculateResourceSeries(allocated)
            .map((resource) => ({
              code: resource.code,
              peak: Math.max(
                0,
                ...resource.intervals.map(
                  (interval) => interval.count
                )
              ),
            }))
            .filter(
              (resource) => resource.peak > 0
            )
            .map(
              (resource) =>
                `${resource.peak}x ${resource.code}`
            )
            .join(', ');

        return {
          id: stoppage.id,
          asset: assetDefinition.id,
          description: stoppage.description,
          startMs,
          durationMinutes: Math.round(
            (finishMs - startMs) / MINUTE
          ),
          priority:
            priorities.length > 0
              ? Math.min(...priorities)
              : null,
          availability:
            availabilities.length > 0
              ? Math.max(...availabilities)
              : null,
          resourceDemand,
        };
      })
      .filter(Boolean);

    const unallocatedAssetItems =
      assetItems.filter(
        (item) =>
          item.allocatedStoppageId == null
      );

    const topLevelOrderKey =
      `topLevel:${assetDefinition.id}`;

    const topLevelReasons = ordered(
      unallocatedAssetItems.filter(
        (item) => item.isStoppageReason
      ),
      orders[topLevelOrderKey] ?? []
    );

    const assetForecastMarkers = assetItems
      .filter(
        (item) =>
          item.isStoppageReason &&
          item.forecastMs != null &&
          item.forecastMs >= rangeStartMs &&
          item.forecastMs <= rangeEndMs
      )
      .map((item) => ({
        id: item.id,
        forecastMs: item.forecastMs,
        workOrderId: item.workOrderId,
        description: item.description,
        isStoppageReason: true,
      }))
      .sort(
        (a, b) =>
          a.forecastMs - b.forecastMs
      );

    rows.push({
      id: assetRowId,
      rowKey: assetRowId,
      type: 'asset',
      level: 0,
      hasChildren:
        assetStoppages.length > 0 ||
        topLevelReasons.length > 0,
      description: assetDefinition.description,
      asset: assetDefinition.id,
      priority: null,
      forecastMarkers: assetForecastMarkers,
      stoppageSummaries:
        assetStoppageSummaries,
    });

    if (!expanded[assetRowId]) {
      continue;
    }

    for (const stoppage of assetStoppages) {
      const allocatedOrderKey =
        `allocated:${stoppage.id}`;

      const unallocatedOrderKey =
        `unallocated:${stoppage.id}`;

      const allocated = ordered(
        assetItems.filter(
          (item) =>
            item.allocatedStoppageId ===
            stoppage.id
        ),
        orders[allocatedOrderKey] ?? []
      );

      const unallocated = ordered(
        unallocatedAssetItems,
        orders[unallocatedOrderKey] ?? []
      );

      const timed = allocated.filter(
        (item) =>
          item.startMs != null &&
          item.durationMinutes != null
      );

      const startMs = timed.length
        ? Math.min(
          ...timed.map((item) => item.startMs)
        )
        : null;

      const finishMs = timed.length
        ? Math.max(
          ...timed.map(
            (item) =>
              item.startMs +
              item.durationMinutes * MINUTE
          )
        )
        : null;

      const peakResourceDemand =
        calculateResourceSeries(allocated)
          .map((resource) => ({
            code: resource.code,
            peak: Math.max(
              0,
              ...resource.intervals.map(
                (interval) => interval.count
              )
            ),
          }))
          .filter(
            (resource) => resource.peak > 0
          )
          .map(
            (resource) =>
              `${resource.peak}x ${resource.code}`
          )
          .join(', ');

      const allocatedPriorities = allocated
        .map((item) => item.priority)
        .filter((priority) => priority != null);

      const allocatedAvailabilities =
        allocated
          .map((item) => item.availability)
          .filter(
            (availability) =>
              availability != null
          );

      const stoppageAvailability =
        allocatedAvailabilities.length > 0
          ? Math.max(
            ...allocatedAvailabilities
          )
          : null;

      const stoppageForecastMarkers =
        allocated
          .filter(
            (item) =>
              item.isStoppageReason &&
              item.forecastMs != null &&
              item.forecastMs >= rangeStartMs &&
              item.forecastMs <= rangeEndMs
          )
          .map((item) => ({
            id: item.id,
            forecastMs: item.forecastMs,
            workOrderId: item.workOrderId,
            description: item.description,
            isStoppageReason: true,
          }))
          .sort(
            (a, b) =>
              a.forecastMs - b.forecastMs
          );

      const unallocatedId =
        `${stoppage.id}-unallocated`;

      rows.push({
        id: stoppage.id,
        rowKey: stoppage.id,
        type: 'stoppage',
        level: 1,
        hasChildren:
          allocated.length > 0 ||
          unallocated.length > 0,
        description: stoppage.description,
        asset: assetDefinition.id,
        priority:
          allocatedPriorities.length > 0
            ? Math.min(
              ...allocatedPriorities
            )
            : null,
        availability:
          stoppageAvailability,
        startMs,
        durationMinutes:
          startMs == null ||
            finishMs == null
            ? null
            : Math.round(
              (finishMs - startMs) /
              MINUTE
            ),
        resourceDemand:
          peakResourceDemand,
        forecastMarkers:
          stoppageForecastMarkers,
        barClass:
          'bg-cyan-800 text-white',
      });

      if (!expanded[stoppage.id]) {
        continue;
      }

      rows.push(
        ...allocated.map((item) => ({
          ...item,
          rowKey:
            `${stoppage.id}-allocated-${item.id}`,
          type: 'allocated',
          level: 2,
          stoppageId: stoppage.id,
          orderKey: allocatedOrderKey,
        }))
      );

      rows.push({
        id: unallocatedId,
        rowKey: unallocatedId,
        type: 'unallocatedHeader',
        level: 2,
        hasChildren:
          unallocated.length > 0,
        description: 'Unallocated Work',
        asset: assetDefinition.id,
        priority: null,
        stoppageId: stoppage.id,
      });

      if (
        unallocated.length > 0 &&
        expanded[unallocatedId]
      ) {
        rows.push(
          ...unallocated.map((item) => ({
            ...item,
            rowKey:
              `${stoppage.id}-unallocated-${item.id}`,
            type: 'unallocated',
            level: 3,
            stoppageId: stoppage.id,
            orderKey: unallocatedOrderKey,
          }))
        );
      }
    }

    rows.push(
      ...topLevelReasons.map((item) => ({
        ...item,
        rowKey: `top-${item.id}`,
        type: 'topReason',
        level: 1,
        orderKey: topLevelOrderKey,
      }))
    );
  }

  return rows;
}

function useTimelineScroll({
  timelineRange,
  setTimelineRange,
}) {
  const itemsRef = React.useRef(null);
  const resourcesRef = React.useRef(null);
  const lockRef = React.useRef(false);
  const extendingRef = React.useRef(false);
  const pendingPrependPixelsRef =
    React.useRef(0);

  const [scrollLeft, setScrollLeft] =
    React.useState(0);

  const previousStartRef = React.useRef(
    timelineRange.startMs
  );

  const zoomLevel =
    getZoomLevel(
      timelineRange.pixelsPerHour
    );

  const BUFFER_DURATION_MS =
    zoomLevel.bufferIntervals *
    zoomLevel.tickHours *
    HOUR;

  React.useLayoutEffect(() => {
    const startChanged =
      previousStartRef.current !==
      timelineRange.startMs;

    previousStartRef.current =
      timelineRange.startMs;

    if (
      !startChanged ||
      pendingPrependPixelsRef.current === 0
    ) {
      extendingRef.current = false;
      return;
    }

    const addedPixels =
      pendingPrependPixelsRef.current;

    pendingPrependPixelsRef.current = 0;

    if (itemsRef.current) {
      itemsRef.current.scrollLeft +=
        addedPixels;

      setScrollLeft(
        itemsRef.current.scrollLeft
      );
    }

    if (resourcesRef.current) {
      resourcesRef.current.scrollLeft +=
        addedPixels;
    }

    extendingRef.current = false;
  }, [
    timelineRange.startMs,
    timelineRange.endMs,
  ]);

  const extendIfRequired = (source) => {
    if (
      extendingRef.current ||
      !source.current
    ) {
      return;
    }

    const element = source.current;

    const edgeThreshold =
      element.clientWidth *
      TIMELINE_CONFIG.edgeThresholdViewportFraction;

    const nearStart =
      element.scrollLeft <
      edgeThreshold;

    const nearEnd =
      element.scrollWidth -
      element.clientWidth -
      element.scrollLeft <
      edgeThreshold;

    if (nearStart) {
      extendingRef.current = true;

      const addedPixels =
        (BUFFER_DURATION_MS / HOUR) *
        timelineRange.pixelsPerHour;

      pendingPrependPixelsRef.current =
        addedPixels;

      setTimelineRange((current) => ({
        ...current,
        startMs:
          current.startMs -
          BUFFER_DURATION_MS,
      }));

      return;
    }

    if (nearEnd) {
      extendingRef.current = true;

      setTimelineRange((current) => ({
        ...current,
        endMs:
          current.endMs +
          BUFFER_DURATION_MS,
      }));

      requestAnimationFrame(() => {
        extendingRef.current = false;
      });
    }
  };

  const sync = (source, target) => {
    if (!source.current) {
      return;
    }

    const next =
      source.current.scrollLeft;

    setScrollLeft(next);

    if (
      !lockRef.current &&
      target.current
    ) {
      lockRef.current = true;
      target.current.scrollLeft = next;

      requestAnimationFrame(() => {
        lockRef.current = false;
      });
    }

    extendIfRequired(source);
  };

  return {
    itemsRef,
    resourcesRef,
    scrollLeft,

    onItemsScroll: () =>
      sync(itemsRef, resourcesRef),

    onResourcesScroll: () =>
      sync(resourcesRef, itemsRef),
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
        <label className="mb-2 flex gap-2">
          <input
            type="checkbox"
            checked={overlays.availability}
            onChange={() => toggle('availability')}
          />
          Show Material Availability
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

const TimelineGeometryContext =
  React.createContext(null);

function useTimelineGeometry() {
  const geometry = React.useContext(
    TimelineGeometryContext
  );

  if (!geometry) {
    throw new Error(
      'Timeline geometry is unavailable.'
    );
  }

  return geometry;
}

function TimelineGrid() {
  const {
    ticks,
    width,
    leftAt,
  } = useTimelineGeometry();

  return (
    <div
      className="pointer-events-none absolute inset-0"
      style={{ width }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.value}
          className="absolute inset-y-0 border-l border-slate-200"
          style={{
            left: leftAt(tick.value),
          }}
        />
      ))}
    </div>
  );
}

function TimelineHeader({ scrollLeft }) {
  const {
    ticks,
    width,
    leftAt,
  } = useTimelineGeometry();

  return (
    <div className="h-8 overflow-hidden bg-white">
      <div
        className="relative h-8"
        style={{
          width,
          transform: `translateX(-${scrollLeft}px)`,
        }}
      >
        {ticks.map((tick, index) => {
          const isFirst = index === 0;
          const isLast =
            index === ticks.length - 1;

          return (
            <div
              key={tick.value}
              className="absolute top-0 flex h-8 items-center whitespace-nowrap text-[10px]"
              style={{
                left: leftAt(tick.value),
                transform: isFirst
                  ? 'translateX(4px)'
                  : isLast
                    ? 'translateX(calc(-100% - 4px))'
                    : 'translateX(-50%)',
              }}
            >
              {tick.label}
            </div>
          );
        })}
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
  deleteStoppage,
  moveRow,
  canMove,
}) {
  const height =
    row.type === 'unallocatedHeader' ? 'h-8' : 'h-16';

  const finishMs =
    row.startMs != null && row.durationMinutes != null
      ? row.startMs + row.durationMinutes * MINUTE
      : null;

  const reorderable = [
    'allocated',
    'unallocated',
    'topReason',
  ].includes(row.type);

  return (
    <div
      className={`grid ${height} border-b border-slate-200 text-xs`}
      style={{ gridTemplateColumns: template }}
    >
      <div
        className="flex min-w-0 items-start border-r px-2 py-2"
        style={{
          paddingLeft: `${8 + row.level * 18}px`,
        }}
      >
        {row.hasChildren ? (
          <button
            className="mr-1 shrink-0"
            onClick={() => toggle(row.id)}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="mr-4" />
        )}

        <span className="min-w-0 flex-1 truncate">
          {row.workOrderId ? (
            <>
              <WorkOrderLink item={row}>
                {row.workOrderId}
              </WorkOrderLink>{' '}
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

      <div className="overflow-hidden whitespace-nowrap border-r px-2 py-2 text-[11px]">
        {row.type === 'allocated' && (
          <button
            className="text-sky-700"
            onClick={() => remove(row)}
          >
            [-] Remove from Stoppage
          </button>
        )}

        {row.type === 'unallocated' && (
          <button
            className="text-sky-700"
            onClick={() => allocate(row)}
          >
            [+] Add to Stoppage
          </button>
        )}

        {row.type === 'topReason' && (
          <button
            className="text-sky-700"
            onClick={() => allocate(row)}
          >
            [+] Create Stoppage
          </button>
        )}

        {row.type === 'stoppage' && (
          <button
            className="text-sky-700"
            onClick={() => deleteStoppage(row)}
          >
            [-] Delete Stoppage
          </button>
        )}
      </div>

      <div className="border-r px-2 py-2 font-semibold">
        {row.asset}
      </div>

      <div className="whitespace-nowrap border-r px-2 py-2">
        {formatPriority(row.priority)}
      </div>

      <div className="whitespace-nowrap border-r px-2 py-2">
        {formatDateTime(row.startMs)}
      </div>

      <div className="whitespace-nowrap border-r px-2 py-2">
        {formatDateTime(finishMs)}
      </div>

      <div className="whitespace-nowrap border-r px-2 py-2">
        {formatDateTime(row.forecastMs)}
      </div>

      <div className="whitespace-nowrap border-r px-2 py-2">
        {row.resourceDemand ?? ''}
      </div>
    </div>
  );
}

function BarAnnotation({
  row,
  durationMs,
  overlays,
}) {
  const {
    leftAt,
    widthFor,
  } = useTimelineGeometry();

  if (
    row.startMs == null ||
    durationMs == null
  ) {
    return null;
  }

  const priority = PRIORITIES[row.priority];
  const availability =
    AVAILABILITIES[row.availability];

  const showLabel =
    overlays.descriptions &&
    Boolean(row.workOrderId);

  const showPriority =
    overlays.priorities &&
    Boolean(priority);

  const showAvailability =
    overlays.availability &&
    Boolean(availability);

  if (
    !showLabel &&
    !showPriority &&
    !showAvailability
  ) {
    return null;
  }

  return (
    <div
      className="absolute top-8 z-30 flex -translate-x-1/2 items-start justify-center gap-1"
      style={{
        left: `calc(${leftAt(row.startMs)
          } + (${widthFor(
            durationMs
          )
          } / 2))`,
      }}
    >

      {showAvailability && (
        <span
          className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
          style={{
            color: availability.colour,
          }}
          title={`Material availability ${row.availability}: ${availability.label}`}
          aria-label={`Material availability ${row.availability}: ${availability.label}`}
        >
          {availability.symbol}
        </span>
      )}

      {
        showLabel && (
          <div className="border-2 border-cyan-500 bg-white px-1 text-center text-[10px]">
            <WorkOrderLink
              item={row}
              className="block whitespace-nowrap"
            >
              MO {row.workOrderId}
            </WorkOrderLink>

            <span className="whitespace-nowrap">
              {row.description}
            </span>
          </div>
        )
      }

      {
        showPriority && (
          <span
            className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
            style={{
              color: priority.colour,
            }}
            title={`Priority ${row.priority}: ${priority.label}`}
            aria-label={`Priority ${row.priority}: ${priority.label}`}
          >
            {priority.symbol}
          </span>
        )
      }
    </div >
  );
}

function formatWorkTooltip({
  workOrderId,
  description,
  startMs,
  finishMs,
  forecastMs,
}) {
  const lines = [];

  if (workOrderId) {
    lines.push(`Work order: ${workOrderId}`);
  }

  if (description) {
    lines.push(description);
  }

  if (startMs != null) {
    lines.push(
      `Start: ${formatFullDateTime(startMs)}`
    );
  }

  if (finishMs != null) {
    lines.push(
      `Finish: ${formatFullDateTime(finishMs)}`
    );
  }

  if (forecastMs != null) {
    lines.push(
      `Forecast: ${formatFullDateTime(
        forecastMs
      )}`
    );
  }

  return lines.join('\n');
}

function GanttRow({
  row,
  overlays,
  startDrag,
  moveToForecast,
}) {
  const {
    width,
    leftAt,
    widthFor,
  } = useTimelineGeometry();

  const height =
    row.type === 'unallocatedHeader'
      ? 'h-8'
      : 'h-16';

  const durationMs =
    row.durationMinutes == null
      ? null
      : row.durationMinutes * MINUTE;

  const markers =
    row.type === 'asset' ||
      row.type === 'stoppage'
      ? row.forecastMarkers ?? []
      : row.forecastMs == null
        ? []
        : [
          {
            id: row.id,
            forecastMs: row.forecastMs,
            workOrderId:
              row.workOrderId ?? null,
            description:
              row.description ?? null,
            isStoppageReason:
              row.isStoppageReason ?? false,
          },
        ];

  const stoppageSummaries =
    row.type === 'asset'
      ? row.stoppageSummaries ?? []
      : [];

  return (
    <div
      className={`relative ${height} border-b border-slate-200 bg-white`}
      style={{ width }}
    >
      <TimelineGrid />

      {row.type === 'asset' &&
        stoppageSummaries.map((summary) => {
          const summaryDurationMs =
            summary.durationMinutes *
            MINUTE;

          const priority =
            PRIORITIES[summary.priority];

          const availability =
            AVAILABILITIES[
            summary.availability
            ];

          return (
            <React.Fragment key={summary.id}>
              {overlays.resources &&
                summary.resourceDemand && (
                  <div
                    className="absolute top-3 z-30 whitespace-nowrap text-[10px] text-red-700"
                    style={{
                      left: `calc(${leftAt(
                        summary.startMs
                      )} - 54px)`,
                    }}
                  >
                    {summary.resourceDemand}
                  </div>
                )}

              <div
                className="absolute top-2 z-20 flex h-6 cursor-ew-resize select-none items-center justify-center rounded bg-cyan-800 px-1 text-[10px] font-semibold text-white"
                style={{
                  left: leftAt(
                    summary.startMs
                  ),
                  width: widthFor(
                    summaryDurationMs
                  ),
                  touchAction: 'none',
                }}
                title={formatWorkTooltip({
                  workOrderId: null,
                  description: summary.description,
                  startMs: summary.startMs,
                  finishMs:
                    summary.startMs +
                    summaryDurationMs,
                  forecastMs: null,
                })}
                onPointerDown={(event) =>
                  startDrag(event, {
                    ...summary,
                    type: 'stoppage',
                  })
                }
              >
                {formatDuration(
                  summary.durationMinutes
                )}
              </div>

              {(overlays.availability ||
                overlays.priorities) && (
                  <div
                    className="absolute top-9 z-30 flex -translate-x-1/2 items-center justify-center gap-1"
                    style={{
                      left: `calc(${leftAt(
                        summary.startMs
                      )} + (${widthFor(
                        summaryDurationMs
                      )} / 2))`,
                    }}
                  >
                    {overlays.availability &&
                      availability && (
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
                          style={{
                            color:
                              availability.colour,
                          }}
                          title={`Material availability ${summary.availability}: ${availability.label}`}
                        >
                          {
                            availability.symbol
                          }
                        </span>
                      )}

                    {overlays.priorities &&
                      priority && (
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none"
                          style={{
                            color:
                              priority.colour,
                          }}
                          title={`Priority ${summary.priority}: ${priority.label}`}
                        >
                          {priority.symbol}
                        </span>
                      )}
                  </div>
                )}
            </React.Fragment>
          );
        })}

      {overlays.resources &&
        row.type !== 'asset' &&
        row.resourceDemand &&
        row.startMs != null && (
          <div
            className="absolute top-3 z-20 text-[10px] text-red-700"
            style={{
              left: `calc(${leftAt(
                row.startMs
              )} - 54px)`,
            }}
          >
            {row.resourceDemand}
          </div>
        )}

      {row.type !== 'asset' &&
        row.startMs != null &&
        durationMs != null && (
          <div
            className={`absolute top-2 z-20 flex h-6 cursor-ew-resize select-none items-center justify-center rounded text-[10px] font-semibold ${row.barClass ?? ''
              }`}
            style={{
              left: leftAt(row.startMs),
              width: widthFor(durationMs),
              touchAction: 'none',
            }}
            title={formatWorkTooltip({
              workOrderId:
                row.type === 'stoppage'
                  ? null
                  : row.workOrderId ?? null,
              description: row.description,
              startMs: row.startMs,
              finishMs:
                row.startMs + durationMs,
              forecastMs:
                row.type === 'stoppage'
                  ? null
                  : row.forecastMs ?? null,
            })}
            onPointerDown={(event) =>
              startDrag(event, row)
            }
          >
            {formatDuration(
              row.durationMinutes
            )}
          </div>
        )}

      {overlays.forecasts &&
        markers.map((marker, index) => {
          const forecastMs =
            marker.forecastMs;

          const showVarianceLine =
            row.type !== 'asset' &&
            row.startMs != null;

          const lineStart =
            showVarianceLine
              ? Math.min(
                row.startMs,
                forecastMs
              )
              : null;

          const lineWidth =
            showVarianceLine
              ? Math.abs(
                row.startMs -
                forecastMs
              )
              : 0;

          const forecastType =
            marker.isStoppageReason
              ? 'Stoppage reason forecast'
              : 'Work forecast';

          const tooltip = [
            `${forecastType}: ${formatFullDateTime(
              forecastMs
            )}`,
            marker.workOrderId
              ? `Work order: ${marker.workOrderId}`
              : null,
            marker.description ?? null,
            row.type !== 'asset'
              ? 'Click to move start date to align to forecast.'
              : null,
          ]
            .filter(Boolean)
            .join('\n');

          const forecastClass =
            marker.isStoppageReason
              ? 'border-green-700 bg-green-100'
              : 'border-slate-500 bg-slate-100';

          return (
            <React.Fragment
              key={`${marker.id}-${forecastMs}-${index}`}
            >
              {lineStart != null &&
                lineWidth > 0 && (
                  <div
                    className="absolute top-5 z-10 border-t border-dotted border-green-700"
                    style={{
                      left: leftAt(
                        lineStart
                      ),
                      width: widthFor(
                        lineWidth
                      ),
                    }}
                  />
                )}

              <button
                className={`absolute top-5 z-40 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${forecastClass}`}
                style={{
                  left: leftAt(forecastMs),
                }}
                title={tooltip}
                onClick={() => {
                  if (
                    row.type !== 'asset'
                  ) {
                    moveToForecast(
                      row,
                      forecastMs
                    );
                  }
                }}
              >
                <ForecastCross />
              </button>
            </React.Fragment>
          );
        })}

      {row.type !== 'asset' && (
        <BarAnnotation
          row={row}
          durationMs={durationMs}
          overlays={overlays}
        />
      )}
    </div>
  );
}

function TimelineControls({
  timelineRange,
  setTimelineRange,
  timeline,
}) {
  const setStart = (value) => {
    const startMs =
      parseDateTimeInput(value);

    if (
      !Number.isFinite(startMs) ||
      startMs >= timelineRange.endMs
    ) {
      return;
    }

    setTimelineRange((current) => ({
      ...current,
      startMs,
    }));
  };

  const setEnd = (value) => {
    const endMs =
      parseDateTimeInput(value);

    if (
      !Number.isFinite(endMs) ||
      endMs <= timelineRange.startMs
    ) {
      return;
    }

    setTimelineRange((current) => ({
      ...current,
      endMs,
    }));
  };

  const changeZoom = (value) => {
    const pixelsPerHour = Number(value);

    const scroller =
      timeline.itemsRef.current;

    if (!scroller) {
      setTimelineRange((current) => ({
        ...current,
        pixelsPerHour,
      }));

      return;
    }

    const centreTime =
      timelineRange.startMs +
      ((scroller.scrollLeft +
        scroller.clientWidth / 2) /
        timelineRange.pixelsPerHour) *
        HOUR;

    setTimelineRange((current) => ({
      ...current,
      pixelsPerHour,
    }));

    requestAnimationFrame(() => {
      const nextScroller =
        timeline.itemsRef.current;

      if (!nextScroller) {
        return;
      }

      const centrePixel =
        ((centreTime -
          timelineRange.startMs) /
          HOUR) *
        pixelsPerHour;

      const nextScrollLeft =
        centrePixel -
        nextScroller.clientWidth / 2;

      nextScroller.scrollLeft =
        nextScrollLeft;

      if (timeline.resourcesRef.current) {
        timeline.resourcesRef.current.scrollLeft =
          nextScrollLeft;
      }
    });
  };

  const zoomLevel =
    getZoomLevel(
      timelineRange.pixelsPerHour
    );

  return (
    <div className="flex min-h-16 flex-wrap items-end gap-3 border-b border-slate-300 bg-slate-50 px-3 py-2">
      <label className="grid gap-1 text-[11px]">
        <span>Timeline start</span>

        <input
          type="datetime-local"
          className="h-8 w-48 border border-slate-300 bg-white px-2 text-xs"
          value={formatDateTimeInput(
            timelineRange.startMs
          )}
          onChange={(event) =>
            setStart(event.target.value)
          }
        />
      </label>

      <label className="grid gap-1 text-[11px]">
        <span>Timeline end</span>

        <input
          type="datetime-local"
          className="h-8 w-48 border border-slate-300 bg-white px-2 text-xs"
          value={formatDateTimeInput(
            timelineRange.endMs
          )}
          onChange={(event) =>
            setEnd(event.target.value)
          }
        />
      </label>

      <label className="grid gap-1 text-[11px]">
  <span>
    Scale
    <span className="ml-1 text-slate-400">
      ({zoomLevel.tickHours}h)
    </span>
  </span>

  <select
    className="h-8 w-32 border border-slate-300 bg-white px-2 text-xs"
    value={
      timelineRange.pixelsPerHour
    }
    onChange={(event) =>
      changeZoom(event.target.value)
    }
  >
    {TIMELINE_CONFIG.zoomLevels.map(
      (level) => (
        <option
          key={level.pixelsPerHour}
          value={level.pixelsPerHour}
        >
          {level.label}
        </option>
      )
    )}
  </select>
</label>
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
  deleteStoppage,
  startDrag,
  moveToForecast,
  widths,
  setWidths,
  orders,
  setOrders,
}) {
  const { width } =
    useTimelineGeometry();
  const template = widths.map((width) => `${width}px`).join(' ');
  const contentWidth = widths.reduce(
    (sum, width) => sum + width,
    0
  );

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
            ? Math.max(
              60,
              originWidth + moveEvent.clientX - originX
            )
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

  const idsFor = (row) => {
    if (!row.orderKey) {
      return [];
    }

    return rows
      .filter(
        (candidate) =>
          candidate.orderKey === row.orderKey
      )
      .map((candidate) => candidate.id);
  };

  const canMove = (row, direction) => {
    const ids = idsFor(row);
    const index = ids.indexOf(row.id);
    const targetIndex = index + direction;

    return (
      index >= 0 &&
      targetIndex >= 0 &&
      targetIndex < ids.length
    );
  };

  const moveRow = (row, direction) => {
    if (!row.orderKey) {
      return;
    }

    setOrders((current) => {
      const visibleIds = idsFor(row);
      const existing = current[row.orderKey] ?? [];

      const ids = [
        ...existing.filter((id) =>
          visibleIds.includes(id)
        ),
        ...visibleIds.filter(
          (id) => !existing.includes(id)
        ),
      ];

      const from = ids.indexOf(row.id);
      const to = from + direction;

      if (
        from < 0 ||
        to < 0 ||
        to >= ids.length
      ) {
        return current;
      }

      const nextIds = [...ids];

      [nextIds[from], nextIds[to]] = [
        nextIds[to],
        nextIds[from],
      ];

      return {
        ...current,
        [row.orderKey]: nextIds,
      };
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
                className="relative overflow-hidden whitespace-nowrap border-r px-2 py-2"
              >
                {heading}

                <div
                  className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                  onPointerDown={(event) =>
                    resize(event, index)
                  }
                />
              </div>
            ))}
          </div>
        </div>

        <TimelineHeader
          scrollLeft={timeline.scrollLeft}
        />
      </div>

      <div className="min-h-0 overflow-x-hidden overflow-y-auto">
        <div className="grid grid-cols-[630px_minmax(0,1fr)]">
          <div
            className="overflow-x-auto border-r"
            onScroll={(event) =>
              setTableScrollLeft(
                event.currentTarget.scrollLeft
              )
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
                  deleteStoppage={deleteStoppage}
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
              <div style={{ width }}>
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

function ResourceDescription({
  resource,
  expanded,
  toggle,
}) {
  const peakDemand = Math.max(
    0,
    ...resource.intervals.map(
      (interval) => interval.count
    )
  );

  const peakCapacity = Math.max(
    0,
    ...resource.intervals.map(
      (interval) => interval.capacity
    )
  );

  const hasMissingCapacity =
    resource.intervals.some(
      (interval) =>
        !interval.hasCapacityData
    );

  return (
    <div
      className={`${expanded ? 'h-24' : 'h-8'
        } border-b border-slate-200 px-2 py-2 text-xs font-semibold`}
    >
      <button
        onClick={() => toggle(resource.code)}
      >
        {expanded ? '▼' : '▶'}{' '}
        {resource.label}

        <span className="ml-2 font-normal text-slate-500">
          peak demand {peakDemand} / peak capacity{' '}
          {peakCapacity}
        </span>

        {hasMissingCapacity && (
          <span
            className="ml-2 font-normal text-amber-700"
            title="Capacity data is missing for part of the planning period. Missing capacity is treated as zero."
          >
            ⚠ Missing capacity
          </span>
        )}
      </button>
    </div>
  );
}

function ResourceGraph({
  resource,
  expanded,
}) {
  const {
    width,
    leftAt,
    widthFor,
  } = useTimelineGeometry();

  const maxLevel = Math.max(
    1,
    ...resource.intervals.flatMap(
      (interval) => [
        interval.count,
        interval.capacity,
      ]
    )
  );

  return (
    <div
      className={`relative ${expanded ? 'h-24' : 'h-8'
        } border-b border-slate-200 bg-white`}
      style={{ width }}
    >
      <TimelineGrid />

      {expanded &&
        resource.intervals.map((interval) => {
          const overCapacity =
            interval.count >
            interval.capacity;

          const overCapacityAmount =
            Math.max(
              0,
              interval.count -
              interval.capacity
            );

          const missingCapacity =
            !interval.hasCapacityData;

          const tooltip = [
            `${formatFullDateTime(
              interval.startMs
            )} to ${formatFullDateTime(
              interval.endMs
            )}`,
            `${resource.code} demand: ${interval.count}`,
            `${resource.code} capacity: ${interval.capacity}`,
            overCapacity
              ? `Over capacity: ${overCapacityAmount}`
              : 'Within capacity',
            missingCapacity
              ? 'Warning: no capacity data entered. Effective capacity is 0.'
              : null,
            interval.contributors.length > 0
              ? `Orders: ${interval.contributors
                .map(
                  (contributor) =>
                    contributor.id
                )
                .join(', ')}`
              : 'Orders: none',
          ]
            .filter(Boolean)
            .join('\n');

          const intervalWidth =
            interval.endMs -
            interval.startMs;

          const demandHeight =
            interval.count === 0
              ? 0
              : Math.max(
                3,
                (interval.count /
                  maxLevel) *
                76
              );

          const capacityHeight =
            interval.capacity === 0
              ? 0
              : Math.max(
                2,
                (interval.capacity /
                  maxLevel) *
                76
              );

          return (
            <React.Fragment
              key={`${interval.startMs}-${interval.endMs}`}
            >
              {missingCapacity && (
                <div
                  className="absolute bottom-1 top-1 z-10 border border-amber-300 bg-amber-50/70"
                  style={{
                    left: leftAt(
                      interval.startMs
                    ),
                    width: widthFor(
                      intervalWidth
                    ),
                  }}
                  title={tooltip}
                />
              )}

              {capacityHeight > 0 && (
                <div
                  className="pointer-events-none absolute bottom-1 z-20 border-t-2 border-dashed border-slate-700"
                  style={{
                    left: leftAt(
                      interval.startMs
                    ),
                    width: widthFor(
                      intervalWidth
                    ),
                    height: `${capacityHeight}px`,
                  }}
                />
              )}

              {demandHeight > 0 && (
                <div
                  className="absolute bottom-1 z-30"
                  style={{
                    left: leftAt(
                      interval.startMs
                    ),
                    width: widthFor(
                      intervalWidth
                    ),
                    height: `${demandHeight}px`,
                    backgroundColor:
                      overCapacity
                        ? '#dc2626'
                        : resource.colour,
                  }}
                  title={tooltip}
                >
                  <span className="absolute left-1 top-0 text-[9px] text-white">
                    {interval.count}
                  </span>
                </div>
              )}

              {demandHeight === 0 && (
                <div
                  className="absolute bottom-1 z-30 h-2"
                  style={{
                    left: leftAt(
                      interval.startMs
                    ),
                    width: widthFor(
                      intervalWidth
                    ),
                  }}
                  title={tooltip}
                />
              )}
            </React.Fragment>
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
  const { width } =
    useTimelineGeometry();

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
                <div style={{ width }}>
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

function ResourceCapacityScreen({
  capacityIntervals,
  setCapacityIntervals,
}) {
  const [startDate, setStartDate] =
    React.useState(() => formatDateInput(DEFAULT_TIMELINE_START));

  const [endDate, setEndDate] =
    React.useState(() => formatDateInput(DEFAULT_TIMELINE_END));

  const [shiftPreset, setShiftPreset] =
    React.useState('06:00/18:00');

  const [dayStart, setDayStart] =
    React.useState('06:00');

  const [dayEnd, setDayEnd] =
    React.useState('18:00');

  const [nightStart, setNightStart] =
    React.useState('18:00');

  const [nightEnd, setNightEnd] =
    React.useState('06:00');

  const [selectedCapacityRows, setSelectedCapacityRows] =
    React.useState<string[]>([]);

  const [generationError, setGenerationError] =
    React.useState('');

  const applyPreset = (value) => {
    setShiftPreset(value);

    if (value === '06:00/18:00') {
      setDayStart('06:00');
      setDayEnd('18:00');
      setNightStart('18:00');
      setNightEnd('06:00');
      return;
    }

    if (value === '05:30/17:30') {
      setDayStart('05:30');
      setDayEnd('17:30');
      setNightStart('17:30');
      setNightEnd('05:30');
    }
  };

  const nightEndsNextDay =
    nightEnd <= nightStart;

  const [capacities, setCapacities] = React.useState(() =>
    Object.fromEntries(
      resourceDefinitions.map((resource) => [
        resource.code,
        {
          day: '',
          night: '',
        },
      ])
    )
  );

  const setCapacity = (
    resourceCode,
    shift,
    value
  ) => {
    setCapacities((current) => ({
      ...current,
      [resourceCode]: {
        ...current[resourceCode],
        [shift]: value,
      },
    }));
  };

  const generateCapacity = () => {
    setGenerationError('');

    if (!startDate || !endDate) {
      setGenerationError(
        'Enter a start date and end date.'
      );
      return;
    }

    const [startYear, startMonth, startDay] =
      startDate.split('-').map(Number);

    const [endYear, endMonth, endDay] =
      endDate.split('-').map(Number);

    const firstDate = new Date(
      startYear,
      startMonth - 1,
      startDay
    );

    const lastDate = new Date(
      endYear,
      endMonth - 1,
      endDay
    );

    if (lastDate < firstDate) {
      setGenerationError(
        'The end date must be on or after the start date.'
      );
      return;
    }

    const makeDateTime = (
      date,
      time,
      dayOffset = 0
    ) => {
      const [hours, minutes] =
        time.split(':').map(Number);

      return new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate() + dayOffset,
        hours,
        minutes,
        0,
        0
      ).getTime();
    };

    const generated = [];

    for (
      let date = new Date(firstDate);
      date <= lastDate;
      date.setDate(date.getDate() + 1)
    ) {
      const shifts = [
        {
          id: 'day',
          start: dayStart,
          end: dayEnd,
        },
        {
          id: 'night',
          start: nightStart,
          end: nightEnd,
        },
      ];

      for (const shift of shifts) {
        const endDayOffset =
          shift.end <= shift.start ? 1 : 0;

        const intervalStartMs =
          makeDateTime(date, shift.start);

        const intervalEndMs =
          makeDateTime(
            date,
            shift.end,
            endDayOffset
          );

        for (const resource of resourceDefinitions) {
          const input =
            capacities[resource.code]?.[
            shift.id
            ] ?? '';

          const capacity =
            input === ''
              ? null
              : Number(input);

          generated.push({
            id: `${resource.code}-${intervalStartMs}-${shift.id}`,
            resourceCode: resource.code,
            startMs: intervalStartMs,
            endMs: intervalEndMs,
            capacity,
          });
        }
      }
    }

    const overlap = generated
      .map((generatedInterval) => {
        const existingInterval =
          capacityIntervals.find(
            (candidate) => {
              if (
                candidate.resourceCode !==
                generatedInterval.resourceCode
              ) {
                return false;
              }

              const identical =
                candidate.startMs ===
                generatedInterval.startMs &&
                candidate.endMs ===
                generatedInterval.endMs;

              if (identical) {
                return false;
              }

              return (
                generatedInterval.startMs <
                candidate.endMs &&
                generatedInterval.endMs >
                candidate.startMs
              );
            }
          );

        return existingInterval
          ? {
            generatedInterval,
            existingInterval,
          }
          : null;
      })
      .find(Boolean);

    if (overlap) {
      setGenerationError(
        [
          `Capacity overlap detected for ${overlap.generatedInterval.resourceCode}.`,
          '',
          `Existing: ${formatFullDateTime(
            overlap.existingInterval.startMs
          )} → ${formatFullDateTime(
            overlap.existingInterval.endMs
          )}`,
          '',
          `New: ${formatFullDateTime(
            overlap.generatedInterval.startMs
          )} → ${formatFullDateTime(
            overlap.generatedInterval.endMs
          )}`,
          '',
          'Delete or edit the existing capacity before generating this pattern.',
        ].join('\n')
      );

      return;
    }

    setCapacityIntervals((current) => {
      const next = new Map(
        current.map((interval) => [
          interval.id,
          interval,
        ])
      );

      for (const interval of generated) {
        next.set(interval.id, interval);
      }

      return [...next.values()].sort(
        (a, b) =>
          a.startMs - b.startMs ||
          a.resourceCode.localeCompare(
            b.resourceCode
          )
      );
    });
  };

  const capacityTableRows = React.useMemo(() => {
    const grouped = new Map();

    for (const interval of capacityIntervals) {
      const key =
        `${interval.startMs}-${interval.endMs}`;

      const existing = grouped.get(key) ?? {
        id: key,
        startMs: interval.startMs,
        endMs: interval.endMs,
        shift: '',
        capacities: {},
      };

      existing.capacities[interval.resourceCode] =
        interval.capacity;

      grouped.set(key, existing);
    }

    return [...grouped.values()]
      .map((row) => ({
        ...row,
        shift:
          capacityTimeFormatter.format(
            new Date(row.startMs)
          ) === dayStart
            ? 'DS'
            : 'NS',
      }))
      .sort(
        (a, b) => a.startMs - b.startMs
      );
  }, [
    capacityIntervals,
    dayStart,
  ]);

  const updateGeneratedCapacity = (
    startMs,
    endMs,
    resourceCode,
    value
  ) => {
    setCapacityIntervals((current) =>
      current.map((interval) => {
        const matches =
          interval.startMs === startMs &&
          interval.endMs === endMs &&
          interval.resourceCode === resourceCode;

        if (!matches) {
          return interval;
        }

        return {
          ...interval,
          capacity:
            value === ''
              ? null
              : Number(value),
        };
      })
    );
  };

  const allCapacityRowsSelected =
    capacityTableRows.length > 0 &&
    capacityTableRows.every((row) =>
      selectedCapacityRows.includes(row.id)
    );

  const someCapacityRowsSelected =
    capacityTableRows.some((row) =>
      selectedCapacityRows.includes(row.id)
    );

  const toggleCapacityRow = (rowId) => {
    setSelectedCapacityRows((current) =>
      current.includes(rowId)
        ? current.filter((id) => id !== rowId)
        : [...current, rowId]
    );
  };

  const toggleAllCapacityRows = () => {
    if (allCapacityRowsSelected) {
      setSelectedCapacityRows([]);
      return;
    }

    setSelectedCapacityRows(
      capacityTableRows.map((row) => row.id)
    );
  };

  const deleteSelectedCapacities = () => {
    const selectedIntervals = new Set(
      capacityTableRows
        .filter((row) =>
          selectedCapacityRows.includes(row.id)
        )
        .map(
          (row) =>
            `${row.startMs}-${row.endMs}`
        )
    );

    setCapacityIntervals((current) =>
      current.filter(
        (interval) =>
          !selectedIntervals.has(
            `${interval.startMs}-${interval.endMs}`
          )
      )
    );

    setSelectedCapacityRows([]);
  };

  return (
    <main className="min-h-0 flex-1 overflow-auto p-4">
      <h2 className="text-lg font-semibold">
        Resource Capacity
      </h2>

      <p className="mt-1 text-xs text-slate-600">
        Define a repeating capacity pattern and expand it
        into explicit resource capacity intervals.
      </p>

      <section className="mt-4 max-w-3xl border border-slate-300 bg-white">
        <div className="border-b border-slate-300 px-3 py-2 text-sm font-semibold">
          Capacity Pattern
        </div>

        <div className="grid gap-4 p-3">
          <div>
            <div className="mb-2 text-xs font-semibold">
              Period
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs">
                <span>Start date</span>
                <input
                  type="date"
                  className="border border-slate-300 px-2 py-1"
                  value={startDate}
                  onChange={(event) =>
                    setStartDate(event.target.value)
                  }
                />
              </label>

              <label className="grid gap-1 text-xs">
                <span>End date</span>
                <input
                  type="date"
                  className="border border-slate-300 px-2 py-1"
                  value={endDate}
                  onChange={(event) =>
                    setEndDate(event.target.value)
                  }
                />
              </label>
            </div>
          </div>

          <div>
            <div className="mb-2 text-xs font-semibold">
              Shift pattern
            </div>

            <label className="grid max-w-52 gap-1 text-xs">
              <span>Preset</span>
              <select
                className="border border-slate-300 px-2 py-1"
                value={shiftPreset}
                onChange={(event) =>
                  applyPreset(event.target.value)
                }
              >
                <option value="06:00/18:00">
                  06:00 / 18:00
                </option>

                <option value="05:30/17:30">
                  05:30 / 17:30
                </option>

                <option value="custom">
                  Custom
                </option>
              </select>
            </label>
          </div>

          <div className="grid max-w-xl grid-cols-[100px_1fr_1fr_80px] items-end gap-2 text-xs">
            <div />

            <div className="font-semibold">
              Start
            </div>

            <div className="font-semibold">
              End
            </div>

            <div />

            <div className="font-semibold">
              Day shift
            </div>

            <input
              type="time"
              className="border border-slate-300 px-2 py-1"
              value={dayStart}
              onChange={(event) => {
                setShiftPreset('custom');
                setDayStart(event.target.value);
              }}
            />

            <input
              type="time"
              className="border border-slate-300 px-2 py-1"
              value={dayEnd}
              onChange={(event) => {
                setShiftPreset('custom');
                setDayEnd(event.target.value);
              }}
            />

            <div />

            <div className="font-semibold">
              Night shift
            </div>

            <input
              type="time"
              className="border border-slate-300 px-2 py-1"
              value={nightStart}
              onChange={(event) => {
                setShiftPreset('custom');
                setNightStart(event.target.value);
              }}
            />

            <input
              type="time"
              className="border border-slate-300 px-2 py-1"
              value={nightEnd}
              onChange={(event) => {
                setShiftPreset('custom');
                setNightEnd(event.target.value);
              }}
            />

            <div className="text-slate-600">
              {nightEndsNextDay ? '+1 day' : ''}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-2 text-xs font-semibold">
            Resource capacity
          </div>

          <div className="max-w-xl border border-slate-300">
            <div className="grid grid-cols-[1fr_100px_100px] bg-slate-100 text-xs font-semibold">
              <div className="border-r border-slate-300 px-2 py-2">
                Resource
              </div>

              <div className="border-r border-slate-300 px-2 py-2 text-center">
                Day shift
              </div>

              <div className="px-2 py-2 text-center">
                Night shift
              </div>
            </div>

            {resourceDefinitions.map((resource) => (
              <div
                key={resource.code}
                className="grid grid-cols-[1fr_100px_100px] border-t border-slate-300 text-xs"
              >
                <div className="border-r border-slate-300 px-2 py-2">
                  <div className="font-semibold">
                    {resource.code}
                  </div>

                  <div className="text-[10px] text-slate-500">
                    {resource.label}
                  </div>
                </div>

                <div className="border-r border-slate-300 p-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full border border-slate-300 px-2 py-1 text-right"
                    placeholder="Blank"
                    value={
                      capacities[resource.code]?.day ?? ''
                    }
                    onChange={(event) =>
                      setCapacity(
                        resource.code,
                        'day',
                        event.target.value
                      )
                    }
                  />
                </div>

                <div className="p-1">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    className="w-full border border-slate-300 px-2 py-1 text-right"
                    placeholder="Blank"
                    value={
                      capacities[resource.code]?.night ?? ''
                    }
                    onChange={(event) =>
                      setCapacity(
                        resource.code,
                        'night',
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-2 text-[11px] text-slate-500">
            Blank means no capacity data entered and will be
            treated as zero with a warning. Enter 0 to explicitly
            record zero capacity.
          </div>
        </div>



        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            className="bg-slate-900 px-3 py-2 text-xs font-semibold text-white"
            onClick={generateCapacity}
          >
            Generate Capacity
          </button>

          {generationError && (
            <div className="mt-3 whitespace-pre-line border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-800">
              {generationError}
            </div>
          )}

          {capacityIntervals.length > 0 && (
            <span className="text-xs text-slate-600">
              {capacityIntervals.length} capacity intervals generated
            </span>
          )}
        </div>

        {capacityTableRows.length > 0 && (
          <section className="mt-4 border border-slate-300 bg-white">
            <div className="border-b border-slate-300 px-3 py-2">
              <div className="text-sm font-semibold">
                Generated Capacity
              </div>

              <div className="mt-0.5 text-[11px] text-slate-500">
                Explicit intervals generated from the capacity pattern.
              </div>

              <div className="mt-2 flex items-center gap-3">
                <button
                  type="button"
                  className="border border-red-700 px-2 py-1 text-xs text-red-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:text-slate-400"
                  disabled={
                    selectedCapacityRows.length === 0
                  }
                  onClick={deleteSelectedCapacities}
                >
                  Delete selected
                </button>

                {selectedCapacityRows.length > 0 && (
                  <span className="text-xs text-slate-600">
                    {selectedCapacityRows.length}{' '}
                    {selectedCapacityRows.length === 1
                      ? 'shift selected'
                      : 'shifts selected'}
                  </span>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="w-10 border-b border-r border-slate-300 px-2 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={allCapacityRowsSelected}
                        ref={(element) => {
                          if (element) {
                            element.indeterminate =
                              someCapacityRowsSelected &&
                              !allCapacityRowsSelected;
                          }
                        }}
                        onChange={toggleAllCapacityRows}
                        aria-label={
                          allCapacityRowsSelected
                            ? 'Deselect all displayed capacity rows'
                            : 'Select all displayed capacity rows'
                        }
                      />
                    </th>
                    <th className="border-b border-r border-slate-300 px-2 py-2 text-left">
                      Date
                    </th>

                    <th className="border-b border-r border-slate-300 px-2 py-2 text-left">
                      Shift
                    </th>

                    <th className="border-b border-r border-slate-300 px-2 py-2 text-left">
                      From
                    </th>

                    <th className="border-b border-r border-slate-300 px-2 py-2 text-left">
                      To
                    </th>

                    {resourceDefinitions.map((resource) => (
                      <th
                        key={resource.code}
                        className="border-b border-r border-slate-300 px-2 py-2 text-center"
                        title={resource.label}
                      >
                        {resource.code}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {capacityTableRows.map((tableRow) => (
                    <tr key={tableRow.id}>
                      <td className="border-b border-r border-slate-300 px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedCapacityRows.includes(
                            tableRow.id
                          )}
                          onChange={() =>
                            toggleCapacityRow(tableRow.id)
                          }
                          aria-label={`Select ${tableRow.shift} capacity for ${capacityDateFormatter.format(
                            new Date(tableRow.startMs)
                          )}`}
                        />
                      </td>
                      <td className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-2">
                        {capacityDateFormatter.format(
                          new Date(tableRow.startMs)
                        )}
                      </td>

                      <td className="border-b border-r border-slate-300 px-2 py-2 font-semibold">
                        {tableRow.shift}
                      </td>

                      <td className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-2">
                        {capacityTimeFormatter.format(
                          new Date(tableRow.startMs)
                        )}
                      </td>

                      <td className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-2">
                        {capacityDateFormatter.format(
                          new Date(tableRow.endMs)
                        )}{' '}
                        {capacityTimeFormatter.format(
                          new Date(tableRow.endMs)
                        )}
                      </td>

                      {resourceDefinitions.map((resource) => {
                        const capacity =
                          tableRow.capacities[resource.code];

                        const missing = capacity == null;

                        return (
                          <td
                            key={resource.code}
                            className={`border-b border-r border-slate-300 p-1 ${missing ? 'bg-amber-50' : ''
                              }`}
                            title={
                              missing
                                ? 'No capacity data entered. Effective capacity is 0.'
                                : `Capacity: ${capacity}`
                            }
                          >
                            <div className="flex items-center justify-center gap-1">
                              {missing && (
                                <span
                                  className="text-amber-700"
                                  title="No capacity data entered. Effective capacity is 0."
                                >
                                  ⚠
                                </span>
                              )}

                              <input
                                type="number"
                                min="0"
                                step="1"
                                className={`w-16 border px-2 py-1 text-right ${missing
                                  ? 'border-amber-400 bg-amber-50'
                                  : 'border-slate-300 bg-white'
                                  }`}
                                value={capacity ?? ''}
                                placeholder="Blank"
                                onChange={(event) =>
                                  updateGeneratedCapacity(
                                    tableRow.startMs,
                                    tableRow.endMs,
                                    resource.code,
                                    event.target.value
                                  )
                                }
                              />
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

      </section>
    </main>
  );
}

export default function PlanningGrid() {
  const [screen, setScreen] = React.useState<
    'planning' | 'resourceCapacity'
  >('planning');
  const [timelineRange, setTimelineRange] =
  React.useState({
    startMs: DEFAULT_TIMELINE_START,
    endMs: DEFAULT_TIMELINE_END,
    pixelsPerHour:
      DEFAULT_TIMELINE_ZOOM.pixelsPerHour,
  });
  const timelineGeometry = React.useMemo(() => {
    const spanMs =
      timelineRange.endMs -
      timelineRange.startMs;

    const width =
      (spanMs / HOUR) *
      timelineRange.pixelsPerHour;

    const leftAt = (value) =>
      `${((value - timelineRange.startMs) /
        HOUR) *
      timelineRange.pixelsPerHour
      }px`;

    const widthFor = (durationMs) =>
      `${(durationMs / HOUR) *
      timelineRange.pixelsPerHour
      }px`;

    const zoomLevel =
      TIMELINE_CONFIG.zoomLevels
        .slice()
        .reverse()
        .find(
          (level) =>
            timelineRange.pixelsPerHour >=
            level.pixelsPerHour
        ) ??
      TIMELINE_CONFIG.zoomLevels[0];

    const tickHours =
      zoomLevel.tickHours;

    const tickMs = tickHours * HOUR;

    const firstTickMs =
      timelineRange.startMs;

      const ticks = [];

      for (
        let value = firstTickMs;
        value <= timelineRange.endMs;
        value += tickMs
      ) {
        ticks.push({
          value,
          label: formatDateTime(value),
        });
      }

    return {
      startMs: timelineRange.startMs,
      endMs: timelineRange.endMs,
      spanMs,
      width,
      pixelsPerHour:
        timelineRange.pixelsPerHour,
      tickHours,
      tickMs,
      ticks,
      leftAt,
      widthFor,
    };
  }, [timelineRange]);
  const [overlays, setOverlays] = React.useState({
    forecasts: true,
    resources: true,
    priorities: true,
    availability: true,
    descriptions: true,
  });
  const [stoppages, setStoppages] = React.useState(sampleStoppages);
  const [allocation, setAllocation] = React.useState(sampleAllocation);
  const [schedule, setSchedule] = React.useState(sampleSchedule);
  const [expanded, setExpanded] = React.useState(sampleExpanded);
  const [expandedResources, setExpandedResources] = React.useState(
    sampleExpandedResources
  );
  const [widths, setWidths] = React.useState([
    260, 170, 70, 105, 125, 125, 125, 100,
  ]);
  const [orders, setOrders] = React.useState(sampleOrders);
  const [
    capacityIntervals,
    setCapacityIntervals,
  ] = React.useState(resourceCapacity);

  const timeline = useTimelineScroll({
    timelineRange,
    setTimelineRange,
  });
  const items = applyState(allocation, schedule);
  const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
  const rows = deriveRows(
    items,
    stoppages,
    expanded,
    orders,
    timelineGeometry.startMs,
    timelineGeometry.endMs
  );
  const resourceSeries =
    calculateResourceSeries(
      items,
      capacityIntervals,
      timelineGeometry.startMs,
      timelineGeometry.endMs
    );

  const setManyStarts = (updates) => {
    setSchedule((current) => {
      const next = { ...current };

      for (const update of updates) {
        const item = itemById[update.id];

        if (
          !item ||
          item.durationMinutes == null
        ) {
          continue;
        }

        next[update.id] = {
          startMs: snapDateTime(
            update.startMs
          ),
        };
      }

      return next;
    });
  };

  const moveToForecast = (row, forecastMs) => {
    const target = snapDateTime(forecastMs);

    if (row.type !== 'stoppage') {
      setManyStarts([
        {
          id: row.id,
          startMs: target,
        },
      ]);

      return;
    }

    if (row.startMs == null) {
      return;
    }

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
    if (
      row.startMs == null ||
      row.durationMinutes == null
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const originX = event.clientX;

    const members =
      row.type === 'stoppage'
        ? items.filter(
          (item) =>
            item.allocatedStoppageId ===
            row.id &&
            item.startMs != null &&
            item.durationMinutes != null
        )
        : [itemById[row.id]].filter(Boolean);

    const origins = Object.fromEntries(
      members.map((item) => [
        item.id,
        item.startMs,
      ])
    );

    const move = (moveEvent) => {
      const pixelDelta =
        moveEvent.clientX - originX;

      const timeDelta =
        (pixelDelta /
          timelineGeometry.pixelsPerHour) *
        HOUR;

      const snappedDelta =
        snapDuration(timeDelta);

      setManyStarts(
        members.map((item) => ({
          id: item.id,
          startMs:
            origins[item.id] +
            snappedDelta,
        }))
      );
    };

    const up = () => {
      window.removeEventListener(
        'pointermove',
        move
      );

      window.removeEventListener(
        'pointerup',
        up
      );

      window.removeEventListener(
        'pointercancel',
        up
      );
    };

    window.addEventListener(
      'pointermove',
      move
    );

    window.addEventListener(
      'pointerup',
      up
    );

    window.addEventListener(
      'pointercancel',
      up
    );
  };

  const toggleExpanded = (id) => {
    setExpanded((current) => ({
      ...current,
      [id]: !current[id],
    }));
  };

  const allocateWork = (row) => {
    if (row.type === 'topReason') {
      const stoppageId = `stop-${crypto.randomUUID()}`;

      setStoppages((current) => ({
        ...current,
        [stoppageId]: {
          id: stoppageId,
          asset: row.asset,
          description: `${row.asset}: ${row.description}`,
        },
      }));

      setAllocation((current) => ({
        ...current,
        [row.id]: stoppageId,
      }));

      setExpanded((current) => ({
        ...current,
        [`asset-${row.asset}`]: true,
        [stoppageId]: true,
        [`${stoppageId}-unallocated`]: true,
      }));

      return;
    }

    if (
      row.type === 'unallocated' &&
      row.stoppageId
    ) {
      setAllocation((current) => ({
        ...current,
        [row.id]: row.stoppageId,
      }));
    }
  };

  const removeWork = (row) => {
    if (
      row.type !== 'allocated' ||
      !row.stoppageId
    ) {
      return;
    }

    setAllocation((current) => ({
      ...current,
      [row.id]: null,
    }));
  };

  const deleteStoppage = (row) => {
    if (row.type !== 'stoppage') {
      return;
    }

    setAllocation((current) => {
      const next = { ...current };

      for (const item of items) {
        if (item.allocatedStoppageId === row.id) {
          next[item.id] = null;
        }
      }

      return next;
    });

    setStoppages((current) => {
      const next = { ...current };

      delete next[row.id];

      return next;
    });

    setExpanded((current) => {
      const next = { ...current };

      delete next[row.id];
      delete next[`${row.id}-unallocated`];

      return next;
    });

    setOrders((current) => {
      const next = { ...current };

      delete next[`allocated:${row.id}`];
      delete next[`unallocated:${row.id}`];

      return next;
    });
  };

  return (
    <div className="flex h-screen flex-col bg-white text-slate-950">
      <header className="border-b border-slate-300 px-4 py-2">
        <h1 className="text-xl font-bold">Planning grid / stoppage mockup</h1>
        <p className="text-xs text-slate-700">
          The work-order label and priority marker share one centred annotation
          container beneath each scheduled bar.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            className={`border px-2 py-1 text-xs ${screen === 'planning'
              ? 'bg-slate-900 text-white'
              : 'bg-white'
              }`}
            onClick={() => setScreen('planning')}
          >
            Planning Grid
          </button>

          <button
            className={`border px-2 py-1 text-xs ${screen === 'resourceCapacity'
              ? 'bg-slate-900 text-white'
              : 'bg-white'
              }`}
            onClick={() => setScreen('resourceCapacity')}
          >
            Resource Capacity
          </button>
        </div>
      </header>

      {screen === 'planning' ? (
        <TimelineGeometryContext.Provider
          value={timelineGeometry}
        >
          <div className="grid min-h-0 flex-1 grid-cols-[180px_minmax(0,1fr)]">
            <Config
              overlays={overlays}
              setOverlays={setOverlays}
            />

            <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              <TimelineControls
                timelineRange={timelineRange}
                setTimelineRange={setTimelineRange}
                timeline={timeline}
              />
              <ItemsPanel
                rows={rows}
                overlays={overlays}
                timeline={timeline}
                expanded={expanded}
                toggle={toggleExpanded}
                allocate={allocateWork}
                remove={removeWork}
                deleteStoppage={deleteStoppage}
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
        </TimelineGeometryContext.Provider>
      ) : (
        <ResourceCapacityScreen
          capacityIntervals={capacityIntervals}
          setCapacityIntervals={setCapacityIntervals}
        />
      )}
    </div>
  );
}
