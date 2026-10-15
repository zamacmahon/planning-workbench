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

import type {
  ResourceInteraction,
} from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const SNAP = 15 * MINUTE;
const DEFAULT_TIMELINE_START = Date.parse('2026-06-29T06:00:00+08:00');
const DEFAULT_TIMELINE_END = Date.parse('2026-07-03T18:00:00+08:00');

const DEFAULT_COLUMNS = [
  {
    key: 'description',
    label: 'Description',
    width: 260,
    render: DescriptionCell,
  },
  {
    key: 'action',
    label: 'Action',
    width: 170,
    render: ActionCell,
  },
  {
    key: 'asset',
    label: 'Asset',
    width: 70,
    render: AssetCell,
  },
  {
    key: 'priority',
    label: 'Priority',
    shortLabel: 'Pri',
    width: 105,
    render: PriorityCell,
  },
  {
    key: 'availability',
    label: 'Material Availability',
    shortLabel: 'Mat',
    width: 150,
    render: AvailabilityCell,
  },
  {
    key: 'forecast',
    label: 'Forecast',
    width: 125,
    render: ForecastCell,
  },
  {
    key: 'start',
    label: 'Start',
    width: 125,
    render: StartCell,
  },
  {
    key: 'end',
    label: 'End',
    width: 125,
    render: EndCell,
  },
  {
    key: 'duration',
    label: 'Duration',
    width: 90,
    render: DurationCell,
  },
  {
    key: 'resources',
    label: 'Resources',
    width: 100,
    render: ResourcesCell,
  },
];

const COMPACT_WIDTH = 75;
const COMPACT_LABEL_WIDTH = 60;

const DEFAULT_TABLE_PANE_WIDTH = 630;

const DEFAULT_RESOURCES_PANEL_HEIGHT = 224;
const COLLAPSED_RESOURCES_PANEL_HEIGHT = 32;
const MIN_ITEMS_PANEL_HEIGHT = 160;
const MIN_RESOURCES_PANEL_HEIGHT = 96;

const resourceDefinitionByCode =
  Object.fromEntries(
    resourceDefinitions.map(
      (resource) => [
        resource.resourceCode,
        resource,
      ]
    )
  );

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

function getResourceDemands(item) {
  return item.resourceRequirements ?? [];
}

function getRowResourceDemands(row) {
  return (
    row.resourceDemands ??
    row.resourceRequirements ??
    []
  );
}

function formatResourceQuantity(
  quantity
) {
  return Number.isInteger(quantity)
    ? String(quantity)
    : quantity
      .toFixed(2)
      .replace(/\.?0+$/, '');
}

function formatResourceDemands(
  resourceDemands = []
) {
  return resourceDemands
    .map(
      (demand) =>
        `${formatResourceQuantity(
          demand.quantity
        )}x ${demand.resourceCode}`
    )
    .join(', ');
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
          interval.resourceCode ===
          resource.resourceCode &&
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
        const endMs =
          markers[index + 1];

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
              getResourceDemands(item).find(
                (entry) =>
                  entry.resourceCode ===
                  resource.resourceCode
              );

            return demand
              ? [
                {
                  id: item.id,
                  quantity:
                    demand.quantity,
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
          quantity:
            contributors.reduce(
              (sum, contributor) =>
                sum +
                contributor.quantity,
              0
            ),
          capacity:
            capacityInterval?.capacity ??
            0,
          hasCapacityData,
          contributors,
        };
      })
      .filter(
        (interval) =>
          interval.endMs >
          interval.startMs
      );

    return {
      ...resource,
      intervals,
    };
  });
}

function calculatePeakResourceDemands(
  items
) {
  const timedItems = items.filter(
    (item) =>
      item.startMs != null &&
      item.durationMinutes != null
  );

  if (timedItems.length === 0) {
    return [];
  }

  const rangeStartMs = Math.min(
    ...timedItems.map(
      (item) => item.startMs
    )
  );

  const rangeEndMs = Math.max(
    ...timedItems.map(
      (item) =>
        item.startMs +
        item.durationMinutes * MINUTE
    )
  );

  return calculateResourceSeries(
    timedItems,
    [],
    rangeStartMs,
    rangeEndMs
  )
    .map((resource) => ({
      resourceCode:
        resource.resourceCode,
      quantity: Math.max(
        0,
        ...resource.intervals.map(
          (interval) =>
            interval.quantity
        )
      ),
    }))
    .filter(
      (demand) =>
        demand.quantity > 0
    );
}

function calculateResourcePreviewIntervals(
  items
) {
  const timedItems = items.filter(
    (item) =>
      item.startMs != null &&
      item.durationMinutes != null &&
      item.durationMinutes > 0
  );

  if (timedItems.length === 0) {
    return [];
  }

  const boundaries = [
    ...new Set(
      timedItems.flatMap((item) => [
        item.startMs,
        item.startMs +
        item.durationMinutes * MINUTE,
      ])
    ),
  ].sort((a, b) => a - b);

  const intervals = [];

  for (
    let index = 0;
    index < boundaries.length - 1;
    index += 1
  ) {
    const startMs = boundaries[index];
    const endMs = boundaries[index + 1];

    if (endMs <= startMs) {
      continue;
    }

    const activeItems =
      timedItems.filter((item) => {
        const itemEndMs =
          item.startMs +
          item.durationMinutes * MINUTE;

        return (
          item.startMs < endMs &&
          itemEndMs > startMs
        );
      });

    const demandsByResource =
      new Map();

    for (const item of activeItems) {
      for (
        const demand of
        getResourceDemands(item)
      ) {
        if (
          !demand.resourceCode ||
          !Number.isFinite(
            demand.quantity
          ) ||
          demand.quantity <= 0
        ) {
          continue;
        }

        const existing =
          demandsByResource.get(
            demand.resourceCode
          ) ?? {
            resourceCode:
              demand.resourceCode,
            quantity: 0,
            contributorIds: [],
          };

        existing.quantity +=
          demand.quantity;

        existing.contributorIds.push(
          item.id
        );

        demandsByResource.set(
          demand.resourceCode,
          existing
        );
      }
    }

    for (
      const demand of
      demandsByResource.values()
    ) {
      intervals.push({
        resourceCode:
          demand.resourceCode,
        startMs,
        endMs,
        quantity:
          demand.quantity,
        contributorIds:
          demand.contributorIds,
      });
    }
  }

  return intervals;
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

        const resourceDemands =
          calculatePeakResourceDemands(
            allocated
          );

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
          resourceDemands,
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
        allocatedStoppageId:
          item.allocatedStoppageId,
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
      hasChildren: // change to true if want the collapsible region to always appear
        assetStoppages.length > 0 ||
        topLevelReasons.length > 0 ||
        unallocatedAssetItems.length > 0,
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

      const resourceDemands =
        calculatePeakResourceDemands(
          allocated
        );

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
            allocatedStoppageId:
              item.allocatedStoppageId,
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
        resourceDemands,
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
          true,
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

    const assetUnallocatedId =
      `${assetDefinition.id}-unallocated`;

    rows.push({
      id: assetUnallocatedId,
      rowKey: assetUnallocatedId,
      type: 'assetUnallocatedHeader',
      level: 1,
      hasChildren:
        true,
      description: 'Unallocated Work',
      asset: assetDefinition.id,
      priority: null,
    });

    if (
      expanded[assetUnallocatedId]
    ) {
      rows.push(
        ...unallocatedAssetItems.map(
          (item) => ({
            ...item,
            rowKey: `asset-unallocated-${item.id}`,
            type: 'assetUnallocated',
            level: 2,
          })
        )
      );
    }
  }

  return rows;
}

function useTimelineScroll({
  timelineRange,
  setTimelineRange,
}) {
  const headerRef = React.useRef(null);
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

  const setAllScrollLeft = (
    nextScrollLeft,
    sourceRef = null
  ) => {
    const refs = [
      headerRef,
      itemsRef,
      resourcesRef,
    ];

    for (const ref of refs) {
      if (
        ref !== sourceRef &&
        ref.current &&
        ref.current.scrollLeft !== nextScrollLeft
      ) {
        ref.current.scrollLeft =
          nextScrollLeft;
      }
    }
  };

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

    const currentScrollLeft =
      headerRef.current?.scrollLeft ??
      itemsRef.current?.scrollLeft ??
      resourcesRef.current?.scrollLeft ??
      0;

    const nextScrollLeft =
      currentScrollLeft + addedPixels;

    setAllScrollLeft(nextScrollLeft);
    setScrollLeft(nextScrollLeft);

    extendingRef.current = false;
  }, [
    timelineRange.startMs,
    timelineRange.endMs,
  ]);

  const extendIfRequired = (sourceRef) => {
    if (
      extendingRef.current ||
      !sourceRef.current
    ) {
      return;
    }

    const element = sourceRef.current;

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

  const sync = (sourceRef) => {
    if (
      lockRef.current ||
      !sourceRef.current
    ) {
      return;
    }

    const nextScrollLeft =
      sourceRef.current.scrollLeft;

    lockRef.current = true;

    setScrollLeft(nextScrollLeft);
    setAllScrollLeft(
      nextScrollLeft,
      sourceRef
    );

    requestAnimationFrame(() => {
      lockRef.current = false;
    });

    extendIfRequired(sourceRef);
  };

  return {
    headerRef,
    itemsRef,
    resourcesRef,
    scrollLeft,

    onHeaderScroll: () =>
      sync(headerRef),

    onItemsScroll: () =>
      sync(itemsRef),

    onResourcesScroll: () =>
      sync(resourcesRef),
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

function EditableStoppageDescription({
  row,
  editing,
  startEditing,
  finishEditing,
  renameStoppage,
}) {
  const [draft, setDraft] = React.useState(
    row.description
  );

  React.useEffect(() => {
    if (editing) {
      setDraft(row.description);
    }
  }, [
    editing,
    row.description,
  ]);

  const save = () => {
    const description = draft.trim();

    if (description) {
      renameStoppage(
        row.id,
        description
      );
    }

    finishEditing();
  };

  const cancel = () => {
    setDraft(row.description);
    finishEditing();
  };

  if (!editing) {
    return (
      <div
        className="min-w-0 flex-1 cursor-text truncate"
        title="Double-click to rename"
        onDoubleClick={startEditing}
      >
        {row.description}
      </div>
    );
  }

  return (
    <input
      autoFocus
      className="min-w-0 flex-1 border border-sky-500 bg-white px-1 py-0.5 text-xs outline-none"
      value={draft}
      onChange={(event) =>
        setDraft(event.target.value)
      }
      onBlur={save}
      onClick={(event) =>
        event.stopPropagation()
      }
      onDoubleClick={(event) =>
        event.stopPropagation()
      }
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
          return;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          cancel();
        }
      }}
    />
  );
}

function EditableDateTimeCell({
  value,
  onSave,
}) {
  const [draft, setDraft] = React.useState(
    value == null
      ? ''
      : formatDateTimeInput(value)
  );

  React.useEffect(() => {
    setDraft(
      value == null
        ? ''
        : formatDateTimeInput(value)
    );
  }, [value]);

  if (value == null) {
    return null;
  }

  return (
    <input
      type="datetime-local"
      step="60"
      className="w-full border-0 bg-transparent px-0 text-xs outline-none"
      value={draft}
      onChange={(event) =>
        setDraft(event.target.value)
      }
      onBlur={() => {
        const next =
          parseDateTimeInput(draft);

        if (Number.isFinite(next)) {
          onSave(
            snapDateTime(next)
          );
        }
      }}
    />
  );
}

function AssetCell({ row }) {
  return (
    <div className="flex items-center border-r px-2 font-semibold">
      {row.asset}
    </div>
  );
}

function DurationCell({ row }) {
  return (
    <div className="flex items-center whitespace-nowrap border-r px-2">
      {formatDuration(
        row.durationMinutes
      )}
    </div>
  );
}

function AvailabilityCell({
  row,
  column,
}) {
  const availability =
    row.availability == null
      ? null
      : AVAILABILITIES[
      row.availability
      ];

  const showLabel =
    column.width >= COMPACT_WIDTH;
  const compact = !showLabel;

  return (
    <div className={`flex items-center whitespace-nowrap border-r px-2 ${compact
      ? 'justify-center'
      : 'gap-1'
      }`}>
      {availability && (
        <>
          <span
            className="inline-flex h-5 w-5 shrink-0 cursor-default items-center justify-center text-base leading-none"
            style={{
              color:
                availability.colour,
            }}
            title={`Material availability ${row.availability}: ${availability.label}`}
            aria-label={`Material availability ${row.availability}: ${availability.label}`}
          >
            {availability.symbol}
          </span>

          {showLabel && (
            <span className="min-w-0 truncate">
              {availability.label}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function PriorityCell({
  row,
  column,
}) {
  const priority =
    row.priority == null
      ? null
      : PRIORITIES[row.priority];

  const showLabel =
    column.width >= COMPACT_WIDTH;
  const compact = !showLabel;

  return (
    <div className={`flex min-w-0 items-center gap-1 overflow-hidden whitespace-nowrap border-r px-2 ${compact
      ? 'justify-center'
      : 'gap-1'
      }`}>
      {priority && (
        <>
          <span
            className="inline-flex h-5 w-5 shrink-0 cursor-default items-center justify-center text-base leading-none"
            style={{
              color: priority.colour,
            }}
            title={`Priority ${row.priority}: ${priority.label}`}
            aria-label={`Priority ${row.priority}: ${priority.label}`}
          >
            {priority.symbol}
          </span>

          {showLabel && (
            <span className="min-w-0 truncate">
              {priority.label}
            </span>
          )}
        </>
      )}
    </div>
  );
}

function ForecastCell({ row }) {
  return (
    <div className="flex items-center whitespace-nowrap border-r px-2">
      {formatDateTime(row.forecastMs)}
    </div>
  );
}

function ResourcesCell({ row }) {
  const resourceDemands =
    getRowResourceDemands(row);

  return (
    <div className="flex items-center whitespace-nowrap border-r px-2">
      {formatResourceDemands(
        resourceDemands
      )}
    </div>
  );
}

function StartCell({
  row,
  setRowStart,
}) {
  const canEdit =
    row.startMs != null &&
    row.durationMinutes != null &&
    (
      row.type === 'stoppage' ||
      row.type === 'allocated' ||
      row.type === 'unallocated' ||
      row.type === 'assetUnallocated' ||
      row.type === 'topReason'
    );

  return (
    <div className="flex items-center whitespace-nowrap border-r px-2">
      {canEdit ? (
        <EditableDateTimeCell
          value={row.startMs}
          onSave={(startMs) =>
            setRowStart(
              row,
              startMs
            )
          }
        />
      ) : (
        formatDateTime(
          row.startMs
        )
      )}
    </div>
  );
}

function EndCell({
  row,
  finishMs,
  setRowEnd,
}) {
  const canEdit =
    finishMs != null &&
    row.durationMinutes != null &&
    (
      row.type === 'stoppage' ||
      row.type === 'allocated' ||
      row.type === 'unallocated' ||
      row.type === 'assetUnallocated' ||
      row.type === 'topReason'
    );

  return (
    <div className="flex items-center whitespace-nowrap border-r px-2">
      {canEdit ? (
        <EditableDateTimeCell
          value={finishMs}
          onSave={(endMs) =>
            setRowEnd(
              row,
              endMs
            )
          }
        />
      ) : (
        formatDateTime(
          finishMs
        )
      )}
    </div>
  );
}

function DescriptionCell({
  row,
  expanded,
  toggle,
  moveRow,
  canMove,
  editingStoppageId,
  setEditingStoppageId,
  renameStoppage,
}) {
  const reorderable = [
    'allocated',
    'unallocated',
    'topReason',
  ].includes(row.type);

  const isGroupingHeader =
    row.type === 'unallocatedHeader' ||
    row.type === 'assetUnallocatedHeader';

  return (
    <div
      className={`
        flex min-w-0 items-center border-r px-2
        ${isGroupingHeader
          ? 'text-slate-700 font-semibold'
          : ''
        }
      `}
      style={{
        paddingLeft: `${8 + row.level * 18}px`,
      }}
    >
      {row.hasChildren ? (
        <button
          className="mr-1 shrink-0"
          onClick={() =>
            toggle(row.id)
          }
        >
          {expanded ? '▼' : '▶'}
        </button>
      ) : (
        <span className="mr-4" />
      )}

      {row.type === 'stoppage' ? (
        <EditableStoppageDescription
          row={row}
          editing={
            editingStoppageId === row.id
          }
          startEditing={() =>
            setEditingStoppageId(row.id)
          }
          finishEditing={() =>
            setEditingStoppageId(null)
          }
          renameStoppage={
            renameStoppage
          }
        />
      ) : (
        <div className="min-w-0 flex-1 truncate">
          {row.type === 'unallocatedHeader' ||
            row.type ===
            'assetUnallocatedHeader' ? (
            <>
              <span className="mr-1 text-slate-400">
                📂
              </span>

              <span className="font-medium text-slate-500">
                Unallocated Work
              </span>
            </>
          ) : row.workOrderId ? (
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
        </div>
      )}

      {reorderable && (
        <span className="ml-2 inline-flex gap-0.5">
          <button
            className="h-5 w-5 border disabled:text-slate-300"
            disabled={
              !canMove(row, -1)
            }
            onClick={() =>
              moveRow(row, -1)
            }
          >
            ↑
          </button>

          <button
            className="h-5 w-5 border disabled:text-slate-300"
            disabled={
              !canMove(row, 1)
            }
            onClick={() =>
              moveRow(row, 1)
            }
          >
            ↓
          </button>
        </span>
      )}
    </div>
  );
}

function ActionCell({
  row,
  allocate,
  remove,
  deleteStoppage,
}) {
  return (
    <div className="flex items-center overflow-hidden whitespace-nowrap border-r px-2 text-[11px]">
      {row.type === 'asset' && (
        <button
          className="text-sky-700"
          onClick={() =>
            allocate(row)
          }
        >
          [+] Create Stoppage
        </button>
      )}

      {row.type ===
        'assetUnallocated' && (
          <button
            className="text-sky-700"
            onClick={() =>
              allocate(row)
            }
          >
            [+] Create Stoppage
          </button>
        )}

      {row.type === 'allocated' && (
        <button
          className="text-sky-700"
          onClick={() =>
            remove(row)
          }
        >
          [-] Remove from Stoppage
        </button>
      )}

      {row.type === 'unallocated' && (
        <button
          className="text-sky-700"
          onClick={() =>
            allocate(row)
          }
        >
          [+] Add to Stoppage
        </button>
      )}

      {row.type === 'topReason' && (
        <button
          className="text-sky-700"
          onClick={() =>
            allocate(row)
          }
        >
          [+] Create Stoppage
        </button>
      )}

      {row.type === 'stoppage' && (
        <button
          className="text-sky-700"
          onClick={() =>
            deleteStoppage(row)
          }
        >
          [-] Delete Stoppage
        </button>
      )}
    </div>
  );
}

function TableRow({
  row,
  columns,
  template,
  expanded,
  toggle,
  allocate,
  remove,
  deleteStoppage,
  moveRow,
  canMove,
  editingStoppageId,
  setEditingStoppageId,
  renameStoppage,
  setRowStart,
  setRowEnd,
}) {
  const height = getHeight(row);

  const finishMs =
    row.startMs != null &&
      row.durationMinutes != null
      ? row.startMs +
      row.durationMinutes * MINUTE
      : null;

  const isGroupingHeader =
    row.type === 'unallocatedHeader' ||
    row.type === 'assetUnallocatedHeader';

  const cellProps = {
    row,
    finishMs,
    expanded,
    toggle,
    allocate,
    remove,
    deleteStoppage,
    moveRow,
    canMove,
    editingStoppageId,
    setEditingStoppageId,
    renameStoppage,
    setRowStart,
    setRowEnd,
  };

  return (
    <div
      className={`grid ${height} border-b border-slate-200 text-xs ${isGroupingHeader
        ? 'bg-slate-100'
        : ''
        }`}
      style={{
        gridTemplateColumns: template,
      }}
    >
      {columns.map((column) => {
        const Cell = column.render;

        return (
          <Cell
            key={column.key}
            column={column}
            {...cellProps}
          />
        );
      })}
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
    (
      row.type === 'stoppage' ||
      Boolean(row.workOrderId)
    );

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
      className="absolute top-1/2 z-30 flex -translate-y-1/2 items-center gap-1"
      style={{
        left: `calc(${leftAt(
          row.startMs
        )} + ${widthFor(
          durationMs
        )} + 4px)`,
      }}
    >
      {showAvailability && (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none cursor-default"
          style={{
            color: availability.colour,
          }}
          title={`Material availability ${row.availability}: ${availability.label}`}
          aria-label={`Material availability ${row.availability}: ${availability.label}`}
        >
          {availability.symbol}
        </span>
      )}

      {showLabel && (
        <div
          className="max-w-64 overflow-hidden text-ellipsis whitespace-nowrap px-1 text-[10px]"
          title={
            row.type === 'stoppage'
              ? `${row.asset} • ${row.description}`
              : `${row.workOrderId} ${row.operationId} • ${row.description}`
          }
        >
          {row.type === 'stoppage' ? (
            <>
              <span className="font-semibold">
                {row.asset}
              </span>
              {' • '}
              {row.description}
            </>
          ) : (
            <>
              <WorkOrderLink item={row}>
                {row.workOrderId}
              </WorkOrderLink>
              {' '}
              {row.operationId}
              {' • '}
              {row.description}
            </>
          )}
        </div>
      )}

      {showPriority && (
        <span
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none cursor-default"
          style={{
            color: priority.colour,
          }}
          title={`Priority ${row.priority}: ${priority.label}`}
          aria-label={`Priority ${row.priority}: ${priority.label}`}
        >
          {priority.symbol}
        </span>
      )}
    </div>
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

function getHeight(row) {
  return [
    'unallocatedHeader',
    'assetUnallocatedHeader',
  ].includes(row.type)
    ? 'h-6'
    : 'h-8';
}

function getBarClass(row) {
  if (row.type === 'stoppage') {
    return 'bg-cyan-800 text-white';
  }

  if (row.isStoppageReason) {
    return 'bg-green-600 text-white';
  }

  const workOrderId = row.workOrderId ?? '';

  switch (workOrderId) {
    case '4123456':
    case '4991234':
      return 'bg-green-100 border border-green-600 text-slate-950';

    case '4776524':
      return 'bg-rose-100 border border-rose-600 text-slate-950';

    case '4776628':
      return 'bg-orange-100 border border-orange-600 text-slate-950';

    case '4776629':
      return 'bg-red-100 border border-red-600 text-slate-950';

    case '5267001':
      return 'bg-blue-100 border border-blue-600 text-slate-950';

    case '5267014':
      return 'bg-purple-100 border border-purple-600 text-slate-950';

    case '5388100':
      return 'bg-red-100 border border-red-600 text-slate-950';

    default:
      return 'bg-slate-100 border border-slate-500 text-slate-950';
  }
}

function GanttRow({
  row,
  overlays,
  startDrag,
  moveToForecast,
  startResourceHover,
  finishResourceHover,
}) {
  const {
    width,
    leftAt,
    widthFor,
  } = useTimelineGeometry();

  const height = getHeight(row);

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
            allocatedStoppageId:
              row.allocatedStoppageId ?? null,
          }
        ];

  const stoppageSummaries =
    row.type === 'asset'
      ? row.stoppageSummaries ?? []
      : [];

  const formattedResourceDemands =
    formatResourceDemands(
      getRowResourceDemands(row)
    );

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

          const formattedResourceDemands =
            formatResourceDemands(
              summary.resourceDemands
            );

          return (
            <React.Fragment key={summary.id}>
              {overlays.resources &&
                formattedResourceDemands && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-30 whitespace-nowrap text-[10px] text-red-700 text-right"
                    style={{
                      left: 0,
                      right: `calc(
                        100% -
                        ${leftAt(summary.startMs)}
                        + 8px
                      )`,
                    }}
                  >
                    {formattedResourceDemands}
                  </div>
                )}

              <div
                className="absolute top-1/2 -translate-y-1/2 z-20 flex h-6 cursor-ew-resize select-none items-center justify-center rounded bg-cyan-800 px-1 text-[10px] font-semibold text-white"
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
                onPointerEnter={() =>
                  startResourceHover({
                    ...summary,
                    type: 'stoppage',
                  })
                }
                onPointerLeave={() =>
                  finishResourceHover({
                    ...summary,
                    type: 'stoppage',
                  })
                }
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
                overlays.descriptions ||
                overlays.priorities) && (
                  <div
                    className="absolute top-1/2 -translate-y-1/2 z-30 flex items-center gap-1"
                    style={{
                      left: `calc(${leftAt(
                        summary.startMs
                      )} + ${widthFor(
                        summaryDurationMs
                      )} + 4px)`,
                    }}
                  >
                    {overlays.availability &&
                      availability && (
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none cursor-default"
                          style={{
                            color: availability.colour,
                          }}
                          title={`Material availability ${summary.availability}: ${availability.label}`}
                        >
                          {availability.symbol}
                        </span>
                      )}

                    {overlays.descriptions && (
                      <span
                        className="max-w-64 overflow-hidden text-ellipsis whitespace-nowrap px-1 text-[10px]"
                        title={summary.description}
                      >
                        <>
                          <span className="font-semibold">
                            {summary.asset}
                          </span>
                          {' • '}
                          {summary.description}
                        </>
                      </span>
                    )}

                    {overlays.priorities &&
                      priority && (
                        <span
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center text-base leading-none cursor-default"
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
        formattedResourceDemands &&
        row.startMs != null && (
          <div
            className="absolute top-1/2 z-20 whitespace-nowrap text-right text-[10px] text-red-700 -translate-y-1/2"
            style={{
              left: 0,
              right: `calc(
          100% -
          ${leftAt(row.startMs)}
          + 8px
        )`,
            }}
          >
            {formattedResourceDemands}
          </div>
        )}

      {row.type !== 'asset' &&
        row.startMs != null &&
        durationMs != null && (
          <div
            className={`absolute top-1/2 z-20 flex h-6 -translate-y-1/2 cursor-ew-resize select-none items-center justify-center rounded text-[10px] font-semibold ${getBarClass(row)}`}
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
            onPointerEnter={() =>
              startResourceHover(row)
            }
            onPointerLeave={() =>
              finishResourceHover(row)
            }
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

          const associatedStoppage =
            row.type === 'asset' &&
              marker.allocatedStoppageId
              ? stoppageSummaries.find(
                (summary) =>
                  summary.id ===
                  marker.allocatedStoppageId
              )
              : null;

          const referenceStartMs =
            row.type === 'asset'
              ? associatedStoppage?.startMs ?? null
              : row.startMs ?? null;

          const showVarianceLine =
            referenceStartMs != null;

          const lineStart =
            showVarianceLine
              ? Math.min(
                referenceStartMs,
                forecastMs
              )
              : null;

          const lineWidth =
            showVarianceLine
              ? Math.abs(
                referenceStartMs -
                forecastMs
              )
              : 0;

          const allocatedStoppageReason =
            marker.isStoppageReason &&
            marker.allocatedStoppageId != null;

          const forecastType =
            marker.isStoppageReason
              ? allocatedStoppageReason
                ? 'Allocated stoppage reason forecast'
                : 'Stoppage reason forecast'
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
            allocatedStoppageReason
              ? 'border-blue-700 bg-blue-100'
              : marker.isStoppageReason
                ? 'border-green-700 bg-green-100'
                : 'border-slate-500 bg-slate-100';

          const varianceLineClass =
            allocatedStoppageReason
              ? 'border-blue-700'
              : marker.isStoppageReason
                ? 'border-green-700'
                : 'border-slate-500';

          return (
            <React.Fragment
              key={`${marker.id}-${forecastMs}-${index}`}
            >
              {lineStart != null &&
                lineWidth > 0 && (
                  <div
                    className={`absolute top-1/2 z-10 border-t border-dotted ${varianceLineClass}`}
                    style={{
                      left: leftAt(lineStart),
                      width: widthFor(lineWidth),
                      transform: 'translateY(-50%)',
                    }}
                  />
                )}

              <button
                className={`absolute top-1/2 z-40 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border ${forecastClass}`}
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

function PaneResizeHandle({
  tablePaneWidth,
  setTablePaneWidth,
}) {
  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const container =
      event.currentTarget.parentElement;

    if (!container) {
      return;
    }

    const originX =
      event.clientX;

    const originWidth =
      tablePaneWidth;

    const minimumTableWidth = 200;
    const minimumTimelineWidth = 200;

    const move = (moveEvent) => {
      const maximumTableWidth =
        Math.max(
          minimumTableWidth,
          container.clientWidth -
          minimumTimelineWidth
        );

      setTablePaneWidth(
        clamp(
          originWidth +
          moveEvent.clientX -
          originX,
          minimumTableWidth,
          maximumTableWidth
        )
      );
    };

    const finish = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      window.removeEventListener(
        'pointermove',
        move
      );
      window.removeEventListener(
        'pointerup',
        finish
      );
      window.removeEventListener(
        'pointercancel',
        finish
      );
    };

    document.body.style.cursor =
      'col-resize';
    document.body.style.userSelect =
      'none';

    window.addEventListener(
      'pointermove',
      move
    );
    window.addEventListener(
      'pointerup',
      finish
    );
    window.addEventListener(
      'pointercancel',
      finish
    );
  };

  return (
    <div
      role="separator"
      aria-label="Resize table and Gantt panes"
      aria-orientation="vertical"
      aria-valuemin={200}
      aria-valuenow={Math.round(
        tablePaneWidth
      )}
      className="group absolute bottom-0 top-0 z-50 w-2 -translate-x-1/2 cursor-col-resize touch-none"
      style={{
        left: tablePaneWidth,
      }}
      onPointerDown={startResize}
    >
      <div className="mx-auto h-full w-px bg-slate-300 group-hover:w-0.5 group-hover:bg-blue-500" />
    </div>
  );
}

function PanelResizeHandle({
  resourcesPanelHeight,
  setResourcesPanelHeight,
}) {
  const startResize = (event) => {
    event.preventDefault();
    event.stopPropagation();

    const container =
      event.currentTarget.parentElement;

    if (!container) {
      return;
    }

    const originY =
      event.clientY;

    const originHeight =
      resourcesPanelHeight;

    const move = (moveEvent) => {
      const maximumResourcesHeight =
        Math.max(
          MIN_RESOURCES_PANEL_HEIGHT,
          container.clientHeight -
          MIN_ITEMS_PANEL_HEIGHT
        );

      const nextHeight =
        originHeight -
        (
          moveEvent.clientY -
          originY
        );

      setResourcesPanelHeight(
        clamp(
          nextHeight,
          MIN_RESOURCES_PANEL_HEIGHT,
          maximumResourcesHeight
        )
      );
    };

    const finish = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      window.removeEventListener(
        'pointermove',
        move
      );

      window.removeEventListener(
        'pointerup',
        finish
      );

      window.removeEventListener(
        'pointercancel',
        finish
      );
    };

    document.body.style.cursor =
      'row-resize';

    document.body.style.userSelect =
      'none';

    window.addEventListener(
      'pointermove',
      move
    );

    window.addEventListener(
      'pointerup',
      finish
    );

    window.addEventListener(
      'pointercancel',
      finish
    );
  };

  return (
    <div
      role="separator"
      aria-label="Resize items and resources panels"
      aria-orientation="horizontal"
      aria-valuemin={MIN_RESOURCES_PANEL_HEIGHT}
      aria-valuenow={Math.round(resourcesPanelHeight)}
      className="group absolute left-0 right-0 z-[60] h-3 translate-y-1/2 cursor-row-resize touch-none"
      style={{
        bottom: resourcesPanelHeight,
      }}
      onPointerDown={startResize}
    >
      <div className="relative h-full w-full">
        <div
          className="
            absolute left-0 right-0 top-1/2 hidden
            h-0.5 -translate-y-1/2
            bg-blue-500
            group-hover:block
          "
        />
      </div>
    </div>
  );
}

function ItemsPanel({
  rows,
  overlays,
  timeline,
  startResourceHover,
  finishResourceHover,
  expanded,
  toggle,
  allocate,
  remove,
  deleteStoppage,
  startDrag,
  moveToForecast,
  columns,
  setColumns,
  orders,
  setOrders,
  editingStoppageId,
  setEditingStoppageId,
  renameStoppage,
  setRowStart,
  setRowEnd,
  tablePaneWidth,
}) {
  const { width } =
    useTimelineGeometry();

  const template = columns
    .map(
      (column) =>
        `${column.width}px`
    )
    .join(' ');

  const contentWidth = columns.reduce(
    (sum, column) =>
      sum + column.width,
    0
  );

  const [
    tableScrollLeft,
    setTableScrollLeft,
  ] = React.useState(0);

  const tableScrollbarRef =
    React.useRef(null);

  const tableBodyRef =
    React.useRef(null);

  const tableScrollLockRef =
    React.useRef(false);

  const [
    draggedColumnKey,
    setDraggedColumnKey,
  ] = React.useState(null);

  const syncTableScroll = (
    sourceRef,
    targetRef
  ) => {
    if (
      tableScrollLockRef.current ||
      !sourceRef.current
    ) {
      return;
    }

    const nextScrollLeft =
      sourceRef.current.scrollLeft;

    tableScrollLockRef.current = true;

    setTableScrollLeft(
      nextScrollLeft
    );

    if (
      targetRef.current &&
      targetRef.current.scrollLeft !==
      nextScrollLeft
    ) {
      targetRef.current.scrollLeft =
        nextScrollLeft;
    }

    requestAnimationFrame(() => {
      tableScrollLockRef.current = false;
    });
  };

  const startColumnDrag = (
    event,
    columnKey
  ) => {
    setDraggedColumnKey(columnKey);

    event.dataTransfer.effectAllowed =
      'move';

    event.dataTransfer.setData(
      'text/plain',
      columnKey
    );
  };

  const finishColumnDrag = () => {
    setDraggedColumnKey(null);
  };

  const dropColumn = (
    event,
    targetColumnKey
  ) => {
    event.preventDefault();

    const sourceColumnKey =
      draggedColumnKey ??
      event.dataTransfer.getData(
        'text/plain'
      );

    if (
      !sourceColumnKey ||
      sourceColumnKey === targetColumnKey
    ) {
      setDraggedColumnKey(null);
      return;
    }

    setColumns((current) => {
      const sourceIndex =
        current.findIndex(
          (column) =>
            column.key ===
            sourceColumnKey
        );

      const targetIndex =
        current.findIndex(
          (column) =>
            column.key ===
            targetColumnKey
        );

      if (
        sourceIndex < 0 ||
        targetIndex < 0
      ) {
        return current;
      }

      const next = [...current];

      const [movedColumn] =
        next.splice(sourceIndex, 1);

      next.splice(
        targetIndex,
        0,
        movedColumn
      );

      return next;
    });

    setDraggedColumnKey(null);
  };

  const resize = (event, index) => {
    event.preventDefault();

    const originX =
      event.clientX;

    const originWidth =
      columns[index].width;

    const move = (moveEvent) => {
      setColumns((current) =>
        current.map(
          (
            column,
            currentIndex
          ) =>
            currentIndex === index
              ? {
                ...column,
                width: Math.max(
                  40,
                  originWidth +
                  moveEvent.clientX -
                  originX
                ),
              }
              : column
        )
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

  const idsFor = (row) => {
    if (!row.orderKey) {
      return [];
    }

    return rows
      .filter(
        (candidate) =>
          candidate.orderKey ===
          row.orderKey
      )
      .map(
        (candidate) =>
          candidate.id
      );
  };

  const canMove = (
    row,
    direction
  ) => {
    const ids = idsFor(row);
    const index = ids.indexOf(row.id);
    const targetIndex =
      index + direction;

    return (
      index >= 0 &&
      targetIndex >= 0 &&
      targetIndex < ids.length
    );
  };

  const moveRow = (
    row,
    direction
  ) => {
    if (!row.orderKey) {
      return;
    }

    setOrders((current) => {
      const visibleIds =
        idsFor(row);

      const existing =
        current[row.orderKey] ?? [];

      const ids = [
        ...existing.filter((id) =>
          visibleIds.includes(id)
        ),
        ...visibleIds.filter(
          (id) =>
            !existing.includes(id)
        ),
      ];

      const from =
        ids.indexOf(row.id);

      const to =
        from + direction;

      if (
        from < 0 ||
        to < 0 ||
        to >= ids.length
      ) {
        return current;
      }

      const nextIds = [...ids];

      [
        nextIds[from],
        nextIds[to],
      ] = [
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
    <section className="grid min-h-0 flex-1 grid-rows-[2rem_1rem_minmax(0,1fr)] border-b border-slate-300">
      <div
        className="grid border-b border-slate-300"
        style={{
          gridTemplateColumns:
            `${tablePaneWidth}px minmax(0, 1fr)`,
        }}
      >
        <div className="overflow-hidden border-r">
          <div
            className="grid h-8 text-xs font-semibold"
            style={{
              width: contentWidth,
              transform:
                `translateX(-${tableScrollLeft}px)`,
              gridTemplateColumns:
                template,
            }}
          >
            {columns.map(
              (column, index) => {
                const compactLabel =
                  column.width <
                  COMPACT_LABEL_WIDTH;

                const headerText =
                  compactLabel
                    ? column.shortLabel ??
                    column.label
                    : column.label;

                const isDragging =
                  draggedColumnKey ===
                  column.key;

                return (
                  <div
                    key={column.key}
                    draggable
                    className={`relative overflow-hidden whitespace-nowrap border-r px-2 py-2 ${isDragging
                      ? 'bg-sky-100 opacity-60'
                      : 'cursor-grab'
                      }`}
                    onDragStart={(event) =>
                      startColumnDrag(
                        event,
                        column.key
                      )
                    }
                    onDragEnd={
                      finishColumnDrag
                    }
                    onDragOver={(event) => {
                      event.preventDefault();

                      event.dataTransfer.dropEffect =
                        'move';
                    }}
                    onDrop={(event) =>
                      dropColumn(
                        event,
                        column.key
                      )
                    }
                  >
                    <div
                      className="overflow-hidden text-ellipsis whitespace-nowrap"
                      title={column.label}
                    >
                      {headerText}
                    </div>

                    <div
                      draggable={false}
                      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500"
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();

                        resize(
                          event,
                          index
                        );
                      }}
                      onDragStart={(event) =>
                        event.preventDefault()
                      }
                    />
                  </div>
                );
              }
            )}
          </div>
        </div>

        <TimelineHeader
          scrollLeft={
            timeline.scrollLeft
          }
        />
      </div>

      <div
        className="grid"
        style={{
          gridTemplateColumns:
            `${tablePaneWidth}px minmax(0, 1fr)`,
        }}
      >
        <div
          ref={tableScrollbarRef}
          className="h-4 overflow-x-auto overflow-y-hidden border-r"
          onScroll={() =>
            syncTableScroll(
              tableScrollbarRef,
              tableBodyRef
            )
          }
          aria-label="Table horizontal scrollbar"
        >
          <div
            className="h-px"
            style={{
              width: contentWidth,
            }}
          />
        </div>

        <div
          ref={timeline.headerRef}
          onScroll={timeline.onHeaderScroll}
          className="h-4 overflow-x-auto overflow-y-hidden"
          aria-label="Timeline horizontal scrollbar"
        >
          <div
            className="h-px"
            style={{ width }}
          />
        </div>
      </div>

      <div className="min-h-0 overflow-x-hidden overflow-y-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns:
              `${tablePaneWidth}px minmax(0, 1fr)`,
          }}
        >
          <div
            ref={tableBodyRef}
            className="overflow-x-auto overflow-y-hidden border-r [scrollbar-width:none] [&::-webkit-scrollbar\]:hidden"
            onScroll={() =>
              syncTableScroll(
                tableBodyRef,
                tableScrollbarRef
              )
            }
          >
            <div
              style={{
                width: contentWidth,
              }}
            >
              {rows.map((row) => (
                <TableRow
                  key={`table-${row.rowKey}`}
                  row={row}
                  columns={columns}
                  template={template}
                  expanded={
                    expanded[row.id]
                  }
                  toggle={toggle}
                  allocate={allocate}
                  remove={remove}
                  deleteStoppage={
                    deleteStoppage
                  }
                  moveRow={moveRow}
                  canMove={canMove}
                  editingStoppageId={
                    editingStoppageId
                  }
                  setEditingStoppageId={
                    setEditingStoppageId
                  }
                  renameStoppage={
                    renameStoppage
                  }
                  setRowStart={setRowStart}
                  setRowEnd={setRowEnd}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden">
            <div
              ref={timeline.itemsRef}
              onScroll={
                timeline.onItemsScroll
              }
              className="overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div style={{ width }}>
                {rows.map((row) => (
                  <GanttRow
                    key={`gantt-${row.rowKey}`}
                    row={row}
                    overlays={
                      overlays
                    }
                    startDrag={
                      startDrag
                    }
                    moveToForecast={
                      moveToForecast
                    }
                    startResourceHover={
                      startResourceHover
                    }
                    finishResourceHover={
                      finishResourceHover
                    }
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
      (interval) =>
        interval.quantity
    )
  );

  const peakCapacity = Math.max(
    0,
    ...resource.intervals.map(
      (interval) =>
        interval.capacity
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
        onClick={() =>
          toggle(
            resource.resourceCode
          )
        }
      >
        {expanded ? '▼' : '▶'}{' '}
        {resource.label}

        <span className="ml-2 font-normal text-slate-500">
          peak demand{' '}
          {formatResourceQuantity(
            peakDemand
          )}{' '}
          / peak capacity{' '}
          {formatResourceQuantity(
            peakCapacity
          )}
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

function getResourceGraphScale(
  resource,
  resourcePreviewIntervals
) {
  const resourcePreviews =
    resourcePreviewIntervals.filter(
      (interval) =>
        interval.resourceCode ===
        resource.resourceCode
    );

  const projectedQuantities =
    resourcePreviews.flatMap(
      (preview) =>
        resource.intervals.flatMap(
          (interval) => {
            const startMs = Math.max(
              preview.startMs,
              interval.startMs
            );

            const endMs = Math.min(
              preview.endMs,
              interval.endMs
            );

            if (endMs <= startMs) {
              return [];
            }

            const selectedContributorIds =
              new Set(
                preview.contributorIds
              );

            const includedSelectedQuantity =
              interval.contributors
                .filter((contributor) =>
                  selectedContributorIds.has(
                    contributor.id
                  )
                )
                .reduce(
                  (sum, contributor) =>
                    sum +
                    contributor.quantity,
                  0
                );

            return [
              Math.max(
                0,
                interval.quantity -
                includedSelectedQuantity
              ) + preview.quantity,
            ];
          }
        )
    );

  const maxLevel = Math.max(
    1,
    ...resource.intervals.flatMap(
      (interval) => [
        interval.quantity,
        interval.capacity,
      ]
    ),
    ...projectedQuantities
  );

  const gridStep =
    maxLevel <= 5
      ? 1
      : maxLevel <= 10
        ? 2
        : maxLevel <= 20
          ? 5
          : maxLevel <= 50
            ? 10
            : 20;

  const gridLines = [];

  for (
    let value = 0;
    value <= maxLevel;
    value += gridStep
  ) {
    gridLines.push(value);
  }

  if (
    gridLines[
    gridLines.length - 1
    ] !== maxLevel
  ) {
    gridLines.push(maxLevel);
  }

  const plotBottom = 0;
  const plotHeight = 80;

  const plotHeightFor = (
    quantity
  ) =>
    Math.max(
      0,
      (quantity / maxLevel) *
      plotHeight
    );

  return {
    maxLevel,
    gridLines,
    plotBottom,
    plotHeight,
    plotHeightFor,
  };
}

function ResourceAxisRow({
  resource,
  resourcePreviewIntervals,
  expanded,
}) {
  if (!expanded) {
    return (
      <div className="h-8" />
    );
  }

  const {
    gridLines,
    plotBottom,
    plotHeightFor,
  } = getResourceGraphScale(
    resource,
    resourcePreviewIntervals
  );

  return (
    <div className="relative h-24">
      {gridLines.map((value) => {
        const lineBottom =
          plotBottom +
          plotHeightFor(value);

        const labelBottom = lineBottom;

        return (
          <React.Fragment
            key={`axis-${resource.resourceCode}-${value}`}
          >
            <div
              className="pointer-events-none absolute left-1 z-50 translate-y-[3px] bg-white/90 px-0.5 text-[9px] leading-none text-slate-500" style={{
                bottom:
                  `${labelBottom}px`,
              }}
            >
              {value === 0 ? '' : formatResourceQuantity(
                value
              )}
            </div>

            <div
              className="pointer-events-none absolute right-1 z-50 translate-y-[3px] bg-white/90 px-0.5 text-[9px] leading-none text-slate-500"
              style={{
                bottom:
                  `${labelBottom}px`,
              }}
            >
              {value === 0 ? '' : formatResourceQuantity(
                value
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ResourceGraph({
  resource,
  resourcePreviewIntervals,
  expanded,
}) {
  const {
    width,
    leftAt,
    widthFor,
  } = useTimelineGeometry();

  const resourcePreviews =
    resourcePreviewIntervals.filter(
      (interval) =>
        interval.resourceCode ===
        resource.resourceCode
    );

  const resourcePreviewSegments =
    resourcePreviews.flatMap(
      (preview) =>
        resource.intervals.flatMap(
          (interval) => {
            const startMs = Math.max(
              preview.startMs,
              interval.startMs
            );

            const endMs = Math.min(
              preview.endMs,
              interval.endMs
            );

            if (endMs <= startMs) {
              return [];
            }

            const selectedContributorIds =
              new Set(
                preview.contributorIds
              );

            const includedSelectedQuantity =
              interval.contributors
                .filter((contributor) =>
                  selectedContributorIds.has(
                    contributor.id
                  )
                )
                .reduce(
                  (sum, contributor) =>
                    sum +
                    contributor.quantity,
                  0
                );

            const selectedQuantity =
              preview.quantity;

            if (selectedQuantity <= 0) {
              return [];
            }

            const otherQuantity =
              Math.max(
                0,
                interval.quantity -
                includedSelectedQuantity
              );

            return [
              {
                startMs,
                endMs,
                selectedQuantity,
                otherQuantity,
                projectedQuantity:
                  otherQuantity +
                  selectedQuantity,
                contributorIds:
                  preview.contributorIds,
                alreadyIncluded:
                  includedSelectedQuantity >
                  0,
              },
            ];
          }
        )
    );

  const {
    maxLevel,
    gridLines,
    plotBottom,
    plotHeight,
    plotHeightFor,
  } = getResourceGraphScale(
    resource,
    resourcePreviewIntervals
  );

  const peakQuantity = Math.max(
    1,
    ...resource.intervals.flatMap(
      (interval) => [
        interval.quantity,
        interval.hasCapacityData
          ? interval.capacity
          : 0,
      ]
    )
  );

  const missingCapacityHeight =
    Math.max(
      3,
      plotHeightFor(
        peakQuantity
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
        resource.intervals.map(
          (interval) => {
            const overCapacity =
              interval.quantity >
              interval.capacity;

            const overCapacityAmount =
              Math.max(
                0,
                interval.quantity -
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
              `${resource.resourceCode
              } demand: ${formatResourceQuantity(
                interval.quantity
              )}`,
              `${resource.resourceCode
              } capacity: ${formatResourceQuantity(
                interval.capacity
              )}`,
              overCapacity
                ? `Over capacity: ${formatResourceQuantity(
                  overCapacityAmount
                )}`
                : 'Within capacity',
              missingCapacity
                ? 'Warning: no capacity data entered. Effective capacity is 0.'
                : null,
              interval.contributors
                .length > 0
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
              interval.quantity === 0
                ? 0
                : Math.max(
                  3,
                  plotHeightFor(
                    interval.quantity
                  )
                );

            const capacityHeight =
              interval.capacity === 0
                ? 0
                : Math.max(
                  2,
                  plotHeightFor(
                    interval.capacity
                  )
                );

            return (
              <React.Fragment
                key={`${interval.startMs}-${interval.endMs}`}
              >
                {missingCapacity && (
                  <div
                    className="absolute z-10 border-y border-amber-300 bg-amber-50/70"
                    style={{
                      left: leftAt(
                        interval.startMs
                      ),
                      width: widthFor(
                        intervalWidth
                      ),
                      bottom:
                        `${plotBottom}px`,
                      height:
                        `${missingCapacityHeight}px`,
                    }}
                    title={tooltip}
                  />
                )}

                {capacityHeight > 0 && (
                  <div
                    className="pointer-events-none absolute z-20 border-t-2 border-dashed border-slate-700" style={{
                      left: leftAt(
                        interval.startMs
                      ),
                      width: widthFor(
                        intervalWidth
                      ),
                      bottom:
                        `${plotBottom}px`,
                      height:
                        `${capacityHeight}px`,
                    }}
                  />
                )}

                {demandHeight > 0 && (
                  <div
                    className="absolute z-30" style={{
                      left: leftAt(
                        interval.startMs
                      ),
                      width: widthFor(
                        intervalWidth
                      ),
                      bottom:
                        `${plotBottom}px`,
                      height:
                        `${demandHeight}px`,
                      backgroundColor:
                        overCapacity
                          ? '#dc2626'
                          : resource.colour,
                    }}
                    title={tooltip}
                  >

                  </div>
                )}

                {demandHeight === 0 && (
                  <div
                    className="absolute z-30 h-2" style={{
                      left: leftAt(
                        interval.startMs
                      ),
                      width: widthFor(
                        intervalWidth
                      ),
                      bottom:
                        `${plotBottom}px`,
                    }}
                    title={tooltip}
                  />
                )}
              </React.Fragment>
            );
          }
        )}
      {expanded &&
        resourcePreviewSegments.map(
          (segment, index) => {
            const selectedHeight =
              Math.max(
                3,
                plotHeightFor(
                  segment.selectedQuantity
                )
              );

            const otherHeight =
              segment.otherQuantity === 0
                ? 0
                : Math.max(
                  3,
                  plotHeightFor(
                    segment.otherQuantity
                  )
                );

            const tooltip = [
              `${resource.resourceCode
              } selected: ${formatResourceQuantity(
                segment.selectedQuantity
              )}`,
              `${resource.resourceCode
              } other: ${formatResourceQuantity(
                segment.otherQuantity
              )}`,
              `Orders: ${segment.contributorIds.join(
                ', '
              )}`,
            ].join('\n');

            return (
              <div
                key={`preview-${segment.startMs}-${segment.endMs}-${index}`}
                className="pointer-events-none absolute z-40"
                style={{
                  left: leftAt(
                    segment.startMs
                  ),
                  width: widthFor(
                    segment.endMs -
                    segment.startMs
                  ),
                  bottom:
                    `${plotBottom + otherHeight}px`,
                  height:
                    `${selectedHeight}px`,
                  backgroundImage:
                    `repeating-linear-gradient(
                      0deg,
                      white 0,
                      white 1px,
                      ${resource.colour}80 1px,
                      ${resource.colour}80 3px
                    )`,
                }}
                title={tooltip}
              />
            );
          }
        )}

      {expanded &&
        gridLines.map((value) => {
          if (value === 0) {
            return null;
          }

          const lineBottom =
            plotBottom +
            plotHeightFor(value);

          return (
            <div
              key={`grid-${value}`}
              className="pointer-events-none absolute left-0 right-0 z-40 border-t border-slate-300"
              style={{
                bottom:
                  `${lineBottom}px`,
              }}
            />
          );
        })}
    </div>
  );
}

function ResourcesPanel({
  resourceSeries,
  resourcePreviewIntervals,
  timeline,
  expandedResources,
  setExpandedResources,
  tablePaneWidth,
  open,
  setOpen,
  panelHeight,
}) {
  React.useLayoutEffect(() => {
    if (
      open &&
      timeline.resourcesRef.current
    ) {
      timeline.resourcesRef.current.scrollLeft =
        timeline.scrollLeft;
    }
  }, [
    open,
    timeline.scrollLeft,
    timeline.resourcesRef,
  ]);

  const { width } =
    useTimelineGeometry();

  const toggle = (
    resourceCode
  ) => {
    setExpandedResources(
      (current) => ({
        ...current,
        [resourceCode]: !current[resourceCode],
      })
    );
  };

  return (
    <section
      className="grid shrink-0 grid-rows-[2rem_minmax(0,1fr)]"
      style={{
        height: open
          ? panelHeight
          : COLLAPSED_RESOURCES_PANEL_HEIGHT,
      }}
    >
      <div
        className="grid border-b border-slate-300"
        style={{
          gridTemplateColumns:
            `${tablePaneWidth}px minmax(0, 1fr)`,
        }}
      >
        <button
          className="border-r px-2 text-left text-xs font-semibold"
          onClick={() =>
            setOpen(
              (current) =>
                !current
            )
          }
        >
          {open ? '▼' : '▶'}{' '}
          Resources
        </button>

        <div />
      </div>

      {open && (
        <div className="min-h-0 overflow-x-hidden overflow-y-auto">
          <div
            className="grid"
            style={{
              gridTemplateColumns:
                `${tablePaneWidth}px minmax(0, 1fr)`,
            }}
          >
            <div className="border-r">
              {resourceSeries.map(
                (resource) => (
                  <ResourceDescription
                    key={
                      resource.resourceCode
                    }
                    resource={resource}
                    expanded={
                      expandedResources[
                      resource
                        .resourceCode
                      ]
                    }
                    toggle={toggle}
                  />
                )
              )}
            </div>

            <div className="relative min-w-0 overflow-hidden">
              <div
                ref={
                  timeline.resourcesRef
                }
                onScroll={
                  timeline
                    .onResourcesScroll
                }
                className="overflow-x-auto overflow-y-hidden"
              >
                <div style={{ width }}>
                  {resourceSeries.map(
                    (resource) => (
                      <ResourceGraph
                        key={
                          resource
                            .resourceCode
                        }
                        resource={
                          resource
                        }
                        resourcePreviewIntervals={
                          resourcePreviewIntervals
                        }
                        expanded={
                          expandedResources[
                          resource
                            .resourceCode
                          ]
                        }
                      />
                    )
                  )}
                </div>
              </div>

              <div className="pointer-events-none absolute inset-0 z-50 overflow-hidden">
                {resourceSeries.map(
                  (resource) => (
                    <ResourceAxisRow
                      key={`axis-${resource.resourceCode}`}
                      resource={resource}
                      resourcePreviewIntervals={
                        resourcePreviewIntervals
                      }
                      expanded={
                        expandedResources[
                        resource
                          .resourceCode
                        ]
                      }
                    />
                  )
                )}
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
        resource.resourceCode,
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
            capacities[resource.resourceCode]?.[
            shift.id
            ] ?? '';

          const capacity =
            input === ''
              ? null
              : Number(input);

          generated.push({
            id: `${resource.resourceCode}-${intervalStartMs}-${shift.id}`,
            resourceCode: resource.resourceCode,
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
                key={resource.resourceCode}
                className="grid grid-cols-[1fr_100px_100px] border-t border-slate-300 text-xs"
              >
                <div className="border-r border-slate-300 px-2 py-2">
                  <div className="font-semibold">
                    {resource.resourceCode}
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
                      capacities[resource.resourceCode]?.day ?? ''
                    }
                    onChange={(event) =>
                      setCapacity(
                        resource.resourceCode,
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
                      capacities[resource.resourceCode]?.night ?? ''
                    }
                    onChange={(event) =>
                      setCapacity(
                        resource.resourceCode,
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
                        key={resource.resourceCode}
                        className="border-b border-r border-slate-300 px-2 py-2 text-center"
                        title={resource.label}
                      >
                        {resource.resourceCode}
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
                          tableRow.capacities[resource.resourceCode];

                        const missing = capacity == null;

                        return (
                          <td
                            key={resource.resourceCode}
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
                                    resource.resourceCode,
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
      getZoomLevel(
        timelineRange.pixelsPerHour
      );

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

  const [editingStoppageId, setEditingStoppageId] =
    React.useState(null);
  const renameStoppage = (
    stoppageId,
    description
  ) => {
    const nextDescription =
      description.trim();

    if (!nextDescription) {
      return;
    }

    setStoppages((current) => {
      const stoppage =
        current[stoppageId];

      if (!stoppage) {
        return current;
      }

      return {
        ...current,
        [stoppageId]: {
          ...stoppage,
          description:
            nextDescription,
        },
      };
    });
  };
  const [columns, setColumns] =
    React.useState(() =>
      DEFAULT_COLUMNS.map((column) => ({
        ...column,
      }))
    );
  const [
    tablePaneWidth,
    setTablePaneWidth,
  ] = React.useState(
    DEFAULT_TABLE_PANE_WIDTH
  );
  const [
    resourcesOpen,
    setResourcesOpen,
  ] = React.useState(true);

  const [
    resourcesPanelHeight,
    setResourcesPanelHeight,
  ] = React.useState(
    DEFAULT_RESOURCES_PANEL_HEIGHT
  );
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
  const itemById = Object.fromEntries(
    items.map((item) => [
      item.id,
      item,
    ])
  );

  const [
    resourceInteraction,
    setResourceInteraction,
  ] = React.useState<
    ResourceInteraction | null
  >(null);

  const getInteractionWorkItemIds = (
    row
  ) => {
    if (row.type === 'stoppage') {
      return items
        .filter(
          (item) =>
            item.allocatedStoppageId ===
            row.id
        )
        .map((item) => item.id);
    }

    return itemById[row.id]
      ? [row.id]
      : [];
  };

  const startResourceHover = (
    row
  ) => {
    const workItemIds =
      getInteractionWorkItemIds(row);

    if (workItemIds.length === 0) {
      return;
    }

    setResourceInteraction(
      (current) => {
        if (current?.mode === 'drag') {
          return current;
        }

        return {
          mode: 'hover',
          sourceId: row.id,
          workItemIds,
        };
      }
    );
  };

  const finishResourceHover = (
    row
  ) => {
    setResourceInteraction(
      (current) => {
        if (
          current?.mode !== 'hover' ||
          current.sourceId !== row.id
        ) {
          return current;
        }

        return null;
      }
    );
  };

  const resourcePreviewIntervals =
    resourceInteraction
      ? calculateResourcePreviewIntervals(
        resourceInteraction.workItemIds
          .map(
            (workItemId) =>
              itemById[workItemId]
          )
          .filter(Boolean)
      )
      : [];

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

    const workItemIds =
      members.map((item) => item.id);

    if (workItemIds.length === 0) {
      return;
    }

    setResourceInteraction({
      mode: 'drag',
      sourceId: row.id,
      workItemIds,
    });

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

      setResourceInteraction(
        (current) =>
          current?.mode === 'drag' &&
            current.sourceId === row.id
            ? null
            : current
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
    if (row.type === 'asset') {
      const stoppageId =
        `stop-${crypto.randomUUID()}`;

      setStoppages((current) => ({
        ...current,
        [stoppageId]: {
          id: stoppageId,
          asset: row.asset,
          description: 'Stoppage',
        },
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
      row.type === 'assetUnallocated' ||
      row.type === 'topReason'
    ) {
      const stoppageId =
        `stop-${crypto.randomUUID()}`;

      setStoppages((current) => ({
        ...current,
        [stoppageId]: {
          id: stoppageId,
          asset: row.asset,
          description: row.description,
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

  const setRowStart = (
    row,
    startMs
  ) => {
    if (
      row.startMs == null ||
      row.durationMinutes == null
    ) {
      return;
    }

    if (row.type === 'stoppage') {
      const delta =
        startMs - row.startMs;

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
            startMs:
              item.startMs + delta,
          }))
      );

      return;
    }

    setManyStarts([
      {
        id: row.id,
        startMs,
      },
    ]);
  };

  const setRowEnd = (
    row,
    endMs
  ) => {
    if (
      row.startMs == null ||
      row.durationMinutes == null
    ) {
      return;
    }

    const startMs =
      endMs -
      row.durationMinutes * MINUTE;

    setRowStart(
      row,
      snapDateTime(startMs)
    );
  };

  return (
    <div className="flex h-screen flex-col bg-white text-slate-950">
      <header className="border-b border-slate-300 px-4 py-2">
        <h1 className="text-xl font-bold">Planning grid / stoppage mockup</h1>
        <p className="text-xs text-slate-700">
          Resource demand appears before each scheduled bar, with availability,
          description and priority shown after it.
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

              <div className="relative flex min-h-0 flex-1 flex-col">
                <PaneResizeHandle
                  tablePaneWidth={
                    tablePaneWidth
                  }
                  setTablePaneWidth={
                    setTablePaneWidth
                  }
                />

                {resourcesOpen && (
                  <PanelResizeHandle
                    resourcesPanelHeight={
                      resourcesPanelHeight
                    }
                    setResourcesPanelHeight={
                      setResourcesPanelHeight
                    }
                  />
                )}

                <ItemsPanel
                  rows={rows}
                  overlays={overlays}
                  timeline={timeline}
                  startResourceHover={
                    startResourceHover
                  }
                  finishResourceHover={
                    finishResourceHover
                  }
                  expanded={expanded}
                  toggle={toggleExpanded}
                  allocate={allocateWork}
                  remove={removeWork}
                  deleteStoppage={
                    deleteStoppage
                  }
                  startDrag={startDrag}
                  moveToForecast={
                    moveToForecast
                  }
                  columns={columns}
                  setColumns={setColumns}
                  orders={orders}
                  setOrders={setOrders}
                  editingStoppageId={
                    editingStoppageId
                  }
                  setEditingStoppageId={
                    setEditingStoppageId
                  }
                  renameStoppage={
                    renameStoppage
                  }
                  setRowStart={setRowStart}
                  setRowEnd={setRowEnd}
                  tablePaneWidth={
                    tablePaneWidth
                  }
                />

                <ResourcesPanel
                  resourceSeries={
                    resourceSeries
                  }
                  resourcePreviewIntervals={
                    resourcePreviewIntervals
                  }
                  timeline={timeline}
                  expandedResources={
                    expandedResources
                  }
                  setExpandedResources={
                    setExpandedResources
                  }
                  tablePaneWidth={
                    tablePaneWidth
                  }
                  open={resourcesOpen}
                  setOpen={setResourcesOpen}
                  panelHeight={
                    resourcesPanelHeight
                  }
                />
              </div>
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
