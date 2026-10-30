import React from 'react';

import {
  SAP_ORDER_URL,
  SAP_MP_URL,
  makeWomaUrl,
} from './data/misc';

import {
  calculateForecastStartAdvice,
  deriveForecastExplanation,
  workItems,
} from './data/workItems';

import { resourceDefinitions } from './data/resources';

import { assets } from './data/assets';

import {
  stoppages as importedStoppages,
} from './data/stoppages';

import {
  schedules as importedSchedules,
} from './data/schedules';

import {
  sites,
} from './data/sites';

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
const DAY = 24 * HOUR;
const SNAP = 15 * MINUTE;
const DEFAULT_TIMELINE_START = Date.parse('2026-10-26T06:00:00+08:00');
const DEFAULT_TIMELINE_END = DEFAULT_TIMELINE_START + 7 * 24 * 60 * 60 * 1000;

const DEFAULT_COLUMNS = [
  {
    key: 'description',
    label: 'Description',
    shortLabel: 'Desc',
    width: 360,
    render: DescriptionCell,
  },
  {
    key: 'action',
    label: 'Action',
    shortLabel: 'Act',
    width: 120,
    render: ActionCell,
  },
  {
    key: 'asset',
    label: 'Asset',
    width: 60,
    render: AssetCell,
  },
  {
    key: 'location',
    label: 'Location',
    shortLabel: 'Loc',
    width: 70,
    render: LocationCell,
  },
  {
    key: 'stoppage',
    label: 'Stoppage',
    shortLabel: 'Stop',
    width: 150,
    render: StoppageCell,
  },
  {
    key: 'schedule',
    label: 'Schedule',
    shortLabel: 'Sched',
    width: 180,
    render: ScheduleCell,
  },
  {
    key: 'priority',
    label: 'Priority',
    shortLabel: 'Pri',
    width: 100,
    render: PriorityCell,
  },
  {
    key: 'availability',
    label: 'Material Availability',
    shortLabel: 'Mat',
    width: 140,
    render: AvailabilityCell,
  },
  {
    key: 'forecast',
    label: 'Forecast',
    width: 120,
    render: ForecastCell,
  },
  {
    key: 'start',
    label: 'Start',
    width: 160,
    render: StartCell,
  },
  {
    key: 'expectedUsage',
    label: 'Expected Usage',
    shortLabel: 'Usage',
    width: 110,
    render: ExpectedUsageCell,
  },
  {
    key: 'forecastDeviation',
    label: 'Deviation',
    shortLabel: 'Dev',
    width: 120,
    render: ForecastDeviationCell,
  },
  {
    key: 'end',
    label: 'End',
    width: 160,
    render: EndCell,
  },
  {
    key: 'duration',
    label: 'Duration',
    shortLabel: 'Dur',
    width: 70,
    render: DurationCell,
  },
  {
    key: 'resources',
    label: 'Resources',
    shortLabel: 'Res',
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

function formatSignedQuantity(
  value
) {
  if (value == null) {
    return '';
  }

  const rounded =
    Math.round(value);

  if (rounded === 0) {
    return '0';
  }

  return `${rounded > 0
    ? '+'
    : ''
    }${rounded}`;
}

function formatSignedDuration(
  durationMs
) {
  if (durationMs == null) {
    return '';
  }

  const absoluteMs =
    Math.abs(durationMs);

  const absoluteDays =
    absoluteMs /
    (24 * HOUR);

  if (absoluteDays >= 1) {
    const roundedDays =
      Math.round(
        absoluteDays
      );

    if (roundedDays === 0) {
      return '0d';
    }

    return `${durationMs > 0
      ? '+'
      : '-'
      }${roundedDays}d`;
  }

  const roundedHours =
    Math.round(
      absoluteMs / HOUR
    );

  if (roundedHours === 0) {
    return '0h';
  }

  return `${durationMs > 0
    ? '+'
    : '-'
    }${roundedHours}h`;
}

function formatForecastStartAdvice(
  row
) {
  if (
    row.startMs == null ||
    row.forecastMs == null
  ) {
    return '';
  }

  const start =
    formatFullDateTime(
      row.startMs
    );

  const usage =
    row.expectedStartHours != null
      ? ` @${Math.round(
        row.expectedStartHours
      )}hrs`
      : '';

  const usageDeviation =
    row.forecastDeviationHours !=
      null
      ? `Usage ${formatSignedQuantity(
        row.forecastDeviationHours
      )}hrs`
      : null;

  const timeDeviation =
    row.forecastDeviationMs != null
      ? `Time ${formatSignedDuration(
        row.forecastDeviationMs
      )}`
      : null;

  const deviations = [
    usageDeviation,
    timeDeviation,
  ]
    .filter(Boolean)
    .join(' / ');

  return `${start}${usage}${deviations
    ? ` (${deviations})`
    : ''
    }`;
}

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

function formatResourceDemandIcons(
  resourceDemands = []
) {
  return resourceDemands
    .map((demand) => {
      const resource =
        resourceDefinitionByCode[
        demand.resourceCode
        ];

      const emoji =
        resource?.emoji ?? '❓';

      const quantity =
        Math.round(
          demand.quantity
        );

      if (quantity <= 2) {
        return emoji.repeat(
          quantity
        );
      }

      return `${emoji}×${quantity}`;
    })
    .join('');
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

function getWorkItemGroupKey(
  item
) {
  return item.workOrderId
    ? `order:${item.workOrderId}`
    : `item:${item.id}`;
}

function getGroupedWorkItems(
  item,
  items
) {
  const groupKey =
    getWorkItemGroupKey(item);

  return items.filter(
    (candidate) =>
      getWorkItemGroupKey(candidate) ===
      groupKey
  );
}

function normaliseImportedSchedules() {
  return Object.fromEntries(
    importedSchedules.map(
      (schedule) => [
        schedule.schedule,
        {
          id:
            schedule.schedule,

          locations:
            schedule.locations ?? [],

          title:
            schedule.title,

          startMs:
            Date.parse(
              schedule.start
            ),

          endMs:
            Date.parse(
              schedule.end
            ),

          status:
            'Draft',

          imported: true,
        },
      ]
    )
  );
}

function scheduleMatchesLocations(
  schedule,
  selectedLocations
) {
  return (
    schedule.locations.length === 0 ||
    schedule.locations.some(
      (location) =>
        selectedLocations.has(
          location
        )
    )
  );
}

function scheduleAcceptsLocation(
  schedule,
  location
) {
  return (
    schedule.locations.length === 0 ||
    schedule.locations.includes(
      location
    )
  );
}

function getSiteForItem(
  item
) {
  return (
    sites.find(
      (site) =>
        site.plant ===
        item.plant &&
        site.pg ===
        item.pg
    ) ?? null
  );
}

function getItemLocation(
  item
) {
  return (
    getSiteForItem(
      item
    )?.loc ?? null
  );
}

function buildImportedPlanningState(
  items
) {
  const stoppages = {};
  const allocation = {};

  const importedStoppageById =
    new Map(
      importedStoppages.map(
        (stoppage) => [
          stoppage.stoppage,
          stoppage,
        ]
      )
    );

  for (
    const imported of
    importedStoppages
  ) {
    stoppages[
      imported.stoppage
    ] = {
      id:
        imported.stoppage,

      asset:
        imported.asset,

      description:
        imported.title ??
        imported.stoppage,

      scheduleId:
        imported.schedule ??
        null,

      location:
        imported.loc,

      imported: true,
    };
  }

  for (const item of items) {
    if (!item.importedStoppage) {
      continue;
    }

    const imported =
      importedStoppageById.get(
        item.importedStoppage
      );

    if (
      !stoppages[
      item.importedStoppage
      ]
    ) {
      stoppages[
        item.importedStoppage
      ] = {
        id:
          item.importedStoppage,

        asset:
          item.asset,

        description:
          item.orderDescription ??
          item.description ??
          item.importedStoppage,

        scheduleId: null,

        location:
          getItemLocation(
            item
          ),

        imported: true,
      };
    } else if (
      imported?.title == null &&
      (
        stoppages[
          item.importedStoppage
        ].description ===
        imported?.stoppage ||
        !stoppages[
          item.importedStoppage
        ].description
      )
    ) {
      stoppages[
        item.importedStoppage
      ].description =
        item.orderDescription ??
        item.description ??
        item.importedStoppage;
    }

    allocation[item.id] =
      item.importedStoppage;
  }

  return {
    stoppages,
    allocation,
  };
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
  const rank = new Map(
    order.map((id, index) => [
      id,
      index,
    ])
  );

  const orderStartByWorkOrder =
    new Map();

  for (const item of items) {
    if (!item.workOrderId) {
      continue;
    }

    const current =
      orderStartByWorkOrder.get(
        item.workOrderId
      ) ?? {
        earliestStartMs:
          Number.POSITIVE_INFINITY,
        earliestForecastMs:
          Number.POSITIVE_INFINITY,
      };

    if (
      item.startMs != null
    ) {
      current.earliestStartMs =
        Math.min(
          current.earliestStartMs,
          item.startMs
        );
    }

    if (
      item.forecastMs != null
    ) {
      current.earliestForecastMs =
        Math.min(
          current.earliestForecastMs,
          item.forecastMs
        );
    }

    orderStartByWorkOrder.set(
      item.workOrderId,
      current
    );
  }

  const sortMsFor = (item) => {
    if (item.workOrderId) {
      const orderTiming =
        orderStartByWorkOrder.get(
          item.workOrderId
        );

      if (!orderTiming) {
        return Number.POSITIVE_INFINITY;
      }

      return Number.isFinite(
        orderTiming.earliestStartMs
      )
        ? orderTiming.earliestStartMs
        : orderTiming.earliestForecastMs;
    }

    return (
      item.startMs ??
      item.forecastMs ??
      Number.POSITIVE_INFINITY
    );
  };

  return [...items].sort(
    (a, b) => {
      const aRank =
        rank.get(a.id);

      const bRank =
        rank.get(b.id);

      if (
        aRank != null ||
        bRank != null
      ) {
        if (aRank == null) {
          return 1;
        }

        if (bRank == null) {
          return -1;
        }

        return aRank - bRank;
      }

      const aSortMs =
        sortMsFor(a);

      const bSortMs =
        sortMsFor(b);

      if (aSortMs !== bSortMs) {
        return aSortMs < bSortMs
          ? -1
          : 1;
      }

      const aOrder =
        a.workOrderId == null
          ? `~${a.id}`
          : String(
            a.workOrderId
          );

      const bOrder =
        b.workOrderId == null
          ? `~${b.id}`
          : String(
            b.workOrderId
          );

      const orderDifference =
        aOrder.localeCompare(
          bOrder,
          undefined,
          {
            numeric: true,
          }
        );

      if (orderDifference !== 0) {
        return orderDifference;
      }

      return String(
        a.operationId ?? ''
      ).localeCompare(
        String(
          b.operationId ?? ''
        ),
        undefined,
        {
          numeric: true,
        }
      );
    }
  );
}

function getDefaultExpanded(
  rowId
) {
  return (
    rowId.endsWith(
      '-stoppage-reasons'
    ) ||
    rowId ===
    'unallocated-stoppages'
  );
}

function getExpanded(
  expanded,
  rowId
) {
  return (
    expanded[rowId] ??
    getDefaultExpanded(
      rowId
    )
  );
}

function appendStoppageRows({
  rows,
  parentLevel,
  stoppage,
  items,
  schedules,
  expanded,
  orders,
  rangeStartMs,
  rangeEndMs,
}) {
  const assetItems =
    items.filter(
      (item) =>
        item.asset ===
        stoppage.asset
    );

  const unallocatedAssetItems =
    assetItems.filter(
      (item) =>
        item.allocatedStoppageId ==
        null
    );

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
    orders[
    allocatedOrderKey
    ] ?? []
  );

  const unallocated = ordered(
    unallocatedAssetItems,
    orders[
    unallocatedOrderKey
    ] ?? []
  );

  const timed =
    allocated.filter(
      (item) =>
        item.startMs != null &&
        item.durationMinutes != null
    );

  const startMs =
    timed.length > 0
      ? Math.min(
        ...timed.map(
          (item) =>
            item.startMs
        )
      )
      : null;

  const finishMs =
    timed.length > 0
      ? Math.max(
        ...timed.map(
          (item) =>
            item.startMs +
            item.durationMinutes *
            MINUTE
        )
      )
      : null;

  const assignedSchedule =
    stoppage.scheduleId == null
      ? null
      : schedules[
      stoppage.scheduleId
      ] ?? null;

  const scheduleBoundaryIssue =
    assignedSchedule == null ||
      startMs == null ||
      finishMs == null
      ? null
      : startMs <
        assignedSchedule.startMs
        ? 'before'
        : finishMs >
          assignedSchedule.endMs
          ? 'after'
          : null;

  const resourceDemands =
    calculatePeakResourceDemands(
      allocated
    );

  const priorities =
    allocated
      .map(
        (item) =>
          item.priority
      )
      .filter(
        (priority) =>
          priority != null
      );

  const availabilities =
    allocated
      .map(
        (item) =>
          item.availability
      )
      .filter(
        (availability) =>
          availability != null
      );

  const forecastMarkers =
    allocated
      .filter(
        (item) =>
          item.isStoppageReason &&
          item.forecastMs != null &&
          item.forecastMs >=
          rangeStartMs &&
          item.forecastMs <=
          rangeEndMs
      )
      .map(
        (item) => ({
          id: item.id,
          forecastMs:
            item.forecastMs,
          forecastHours:
            item.forecastHours,
          forecastSource:
            item.forecastSource,
          forecastWarning:
            item.forecastWarning,
          forecastWarningDetail:
            item.forecastWarningDetail,
          expectedStartHours:
            item.expectedStartHours,
          forecastDeviationHours:
            item.forecastDeviationHours,
          forecastDeviationMs:
            item.forecastDeviationMs,
          forecastAdviceWarning:
            item.forecastAdviceWarning,
          workOrderId:
            item.workOrderId,
          description:
            item.description,
          isStoppageReason:
            true,
          allocatedStoppageId:
            item.allocatedStoppageId,
        })
      )
      .sort(
        (a, b) =>
          a.forecastMs -
          b.forecastMs
      );

  const unallocatedId =
    `${stoppage.id}-unallocated`;

  rows.push({
    id: stoppage.id,
    rowKey:
      stoppage.id,
    type: 'stoppage',
    level:
      parentLevel,
    hasChildren:
      allocated.length > 0 ||
      unallocated.length > 0,
    description:
      stoppage.description,
    asset:
      stoppage.asset,
    location:
      stoppage.location,
    scheduleId:
      stoppage.scheduleId ??
      null,
    scheduleBoundaryIssue,
    scheduleStartMs:
      assignedSchedule?.startMs ??
      null,
    scheduleEndMs:
      assignedSchedule?.endMs ??
      null,
    priority:
      priorities.length > 0
        ? Math.min(
          ...priorities
        )
        : null,
    availability:
      availabilities.length > 0
        ? Math.max(
          ...availabilities
        )
        : null,
    startMs,
    durationMinutes:
      startMs == null ||
        finishMs == null
        ? null
        : Math.round(
          (
            finishMs -
            startMs
          ) /
          MINUTE
        ),
    resourceDemands,
    forecastMarkers,
    barClass:
      'bg-cyan-800 text-white',
  });

  if (
    !getExpanded(
      expanded,
      stoppage.id
    )
  ) {
    return;
  }

  rows.push(
    ...allocated.map(
      (item) => ({
        ...item,
        rowKey:
          `${stoppage.id}-allocated-${item.id}`,
        type:
          'allocated',
        level:
          parentLevel + 1,
        stoppageId:
          stoppage.id,
        orderKey:
          allocatedOrderKey,
      })
    )
  );

  rows.push({
    id:
      unallocatedId,
    rowKey:
      unallocatedId,
    type:
      'unallocatedHeader',
    level:
      parentLevel + 1,
    hasChildren:
      true,
    description:
      'Unallocated Work (Add to Stoppage)',
    asset:
      stoppage.asset,
    priority:
      null,
    stoppageId:
      stoppage.id,
  });

  if (
    unallocated.length > 0 &&
    getExpanded(
      expanded,
      unallocatedId
    )
  ) {
    rows.push(
      ...unallocated.map(
        (item) => ({
          ...item,
          rowKey:
            `${stoppage.id}-unallocated-${item.id}`,
          type:
            'unallocated',
          level:
            parentLevel + 2,
          stoppageId:
            stoppage.id,
          orderKey:
            unallocatedOrderKey,
        })
      )
    );
  }
}

function deriveAssetRows(
  items,
  stoppages,
  schedules,
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

    if (
      assetItems.length === 0 &&
      assetStoppages.length === 0
    ) {
      continue;
    }

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

    const assetStoppageReasonsId =
      `${assetDefinition.id}-stoppage-reasons`;

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
        forecastHours:
          item.forecastHours,
        forecastSource:
          item.forecastSource,
        forecastWarning:
          item.forecastWarning,
        forecastWarningDetail:
          item.forecastWarningDetail,
        expectedStartHours:
          item.expectedStartHours,
        forecastDeviationHours:
          item.forecastDeviationHours,
        forecastDeviationMs:
          item.forecastDeviationMs,
        forecastAdviceWarning:
          item.forecastAdviceWarning,
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

      location:
        assetItems.find(
          (item) =>
            item.location != null
        )?.location ??
        assetStoppages.find(
          (stoppage) =>
            stoppage.location != null
        )?.location ??
        null,

      priority: null,
      forecastMarkers: assetForecastMarkers,
      stoppageSummaries:
        assetStoppageSummaries,
    });


    if (
      !getExpanded(
        expanded,
        assetRowId
      )
    ) {
      continue;
    }

    for (
      const stoppage of assetStoppages
    ) {
      appendStoppageRows({
        rows,
        parentLevel: 1,
        stoppage,
        items,
        schedules,
        expanded,
        orders,
        rangeStartMs,
        rangeEndMs,
      });
    }

    rows.push({
      id: assetStoppageReasonsId,
      rowKey: assetStoppageReasonsId,
      type: 'assetStoppageReasonsHeader',
      level: 1,
      hasChildren: true,
      description: 'Stoppage Reasons (Create Stoppage)',
      asset: assetDefinition.id,
      priority: null,
    });

    if (
      getExpanded(
        expanded,
        assetStoppageReasonsId
      )
    ) {
      rows.push(
        ...topLevelReasons.map(
          (item) => ({
            ...item,
            rowKey:
              `top-${item.id}`,
            type: 'topReason',
            level: 2,
            orderKey:
              topLevelOrderKey,
          })
        )
      );
    }

    const assetUnallocatedId =
      `${assetDefinition.id}-unallocated`;

    rows.push({
      id: assetUnallocatedId,
      rowKey: assetUnallocatedId,
      type: 'assetUnallocatedHeader',
      level: 1,
      hasChildren:
        true,
      description: 'Unallocated Work (Create Stoppage)',
      asset: assetDefinition.id,
      priority: null,
    });

    if (
      getExpanded(
        expanded,
        assetUnallocatedId
      )
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

function deriveScheduleRows(
  items,
  stoppages,
  schedules,
  stoppageSchedule,
  expanded,
  orders,
  selectedLocations,
  rangeStartMs,
  rangeEndMs
) {
  const rows = [];

  const visibleSchedules =
    Object.values(
      schedules
    )
      .filter(
        (schedule) =>
          scheduleMatchesLocations(
            schedule,
            selectedLocations
          )
      )
      .sort(
        (a, b) =>
          a.startMs -
          b.startMs ||
          a.title.localeCompare(
            b.title
          )
      );

  const effectiveStoppages =
    Object.values(
      stoppages
    ).map(
      (stoppage) => ({
        ...stoppage,

        scheduleId:
          stoppageSchedule[
          stoppage.id
          ] ?? null,
      })
    );

  for (
    const schedule of
    visibleSchedules
  ) {
    const scheduleRowId =
      `schedule-${schedule.id}`;

    const scheduleStoppages =
      effectiveStoppages
        .filter(
          (stoppage) =>
            stoppage.scheduleId ===
            schedule.id
        )
        .sort(
          (a, b) => {
            const aItems =
              items.filter(
                (item) =>
                  item.allocatedStoppageId ===
                  a.id
              );

            const bItems =
              items.filter(
                (item) =>
                  item.allocatedStoppageId ===
                  b.id
              );

            const aStart =
              Math.min(
                ...aItems
                  .map(
                    (item) =>
                      item.startMs
                  )
                  .filter(
                    (value) =>
                      value != null
                  ),
                Number.POSITIVE_INFINITY
              );

            const bStart =
              Math.min(
                ...bItems
                  .map(
                    (item) =>
                      item.startMs
                  )
                  .filter(
                    (value) =>
                      value != null
                  ),
                Number.POSITIVE_INFINITY
              );

            return (
              aStart -
              bStart ||
              a.asset.localeCompare(
                b.asset
              ) ||
              a.description.localeCompare(
                b.description
              )
            );
          }
        );

    rows.push({
      id:
        scheduleRowId,

      rowKey:
        scheduleRowId,

      type:
        'schedule',

      level: 0,

      hasChildren:
        scheduleStoppages.length >
        0,

      description:
        schedule.title,

      locations:
        schedule.locations,

      scheduleId:
        schedule.id,

      asset: null,

      priority: null,

      startMs:
        schedule.startMs,

      durationMinutes:
        Math.round(
          (
            schedule.endMs -
            schedule.startMs
          ) /
          MINUTE
        ),
    });

    if (
      !getExpanded(
        expanded,
        scheduleRowId
      )
    ) {
      continue;
    }

    for (
      const stoppage of
      scheduleStoppages
    ) {
      appendStoppageRows({
        rows,
        parentLevel: 1,
        stoppage,
        items,
        schedules,
        expanded,
        orders,
        rangeStartMs,
        rangeEndMs,
      });
    }
  }

  const unallocatedStoppages =
    effectiveStoppages
      .filter(
        (stoppage) =>
          stoppage.scheduleId ==
          null &&
          selectedLocations.has(
            stoppage.location
          )
      )
      .sort(
        (a, b) =>
          a.asset.localeCompare(
            b.asset
          ) ||
          a.description.localeCompare(
            b.description
          )
      );

  const unallocatedRowId =
    'unallocated-stoppages';

  rows.push({
    id:
      unallocatedRowId,

    rowKey:
      unallocatedRowId,

    type:
      'unallocatedStoppagesHeader',

    level: 0,

    hasChildren:
      unallocatedStoppages.length >
      0,

    description:
      'Unallocated Stoppages',

    asset: null,

    priority: null,
  });

  if (
    getExpanded(
      expanded,
      unallocatedRowId
    )
  ) {
    for (
      const stoppage of
      unallocatedStoppages
    ) {
      appendStoppageRows({
        rows,
        parentLevel: 1,
        stoppage,
        items,
        schedules,
        expanded,
        orders,
        rangeStartMs,
        rangeEndMs,
      });
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

  const panHorizontal = (
    deltaPixels
  ) => {
    const sourceRef =
      itemsRef.current
        ? itemsRef
        : resourcesRef;

    if (!sourceRef.current) {
      return;
    }

    sourceRef.current.scrollLeft +=
      deltaPixels;

    sync(sourceRef);
  };

  return {
    headerRef,
    itemsRef,
    resourcesRef,
    scrollLeft,
    panHorizontal,

    onHeaderScroll: () =>
      sync(headerRef),

    onItemsScroll: () =>
      sync(itemsRef),

    onResourcesScroll: () =>
      sync(resourcesRef),
  };
}

function EyeIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 10c2-3 5-5 9-5s7 2 9 5c-2 3-5 5-9 5s-7-2-9-5z" />
      <circle
        cx="10"
        cy="10"
        r="2.5"
      />
    </svg>
  );
}

function ExpandIcon({
  expanded,
}) {
  return (
    <span
      className={`
        inline-block
        w-3
        text-center
        transition-transform
        ${expanded
          ? ''
          : '-rotate-90'
        }
      `}
    >
      ▼
    </span>
  );
}

function Accordion({ title, children }) {
  const [open, setOpen] = React.useState(true);
  return (
    <section className="border-b border-slate-300">
      <button
        className="h-8 w-full px-2 text-left text-xs font-semibold"
        onClick={() => setOpen(!open)}
      >
        <ExpandIcon
          expanded={open}
        /> {title}
      </button>
      {open && <div className="px-2 pb-3 text-xs">{children}</div>}
    </section>
  );
}

function Config({
  overlays,
  setOverlays,
  selectedLocations,
  toggleLocation,
  schedules,
  activeScheduleId,
  setActiveScheduleId,
  setCreatingSchedule,
  setEditingScheduleId,
}) {
  const toggle = (key) =>
    setOverlays((current) => ({
      ...current,
      [key]: !current[key],
    }));

  const visibleSchedules =
    Object.values(
      schedules
    )
      .filter(
        (schedule) =>
          scheduleMatchesLocations(
            schedule,
            selectedLocations
          )
      )
      .sort(
        (a, b) =>
          a.startMs -
          b.startMs ||
          a.title.localeCompare(
            b.title
          )
      );

  const activeScheduleVisible =
    activeScheduleId == null ||
    visibleSchedules.some(
      (schedule) =>
        schedule.id ===
        activeScheduleId
    );

  React.useEffect(() => {
    if (
      !activeScheduleVisible
    ) {
      setActiveScheduleId(
        null
      );
    }
  }, [
    activeScheduleId,
    activeScheduleVisible,
    setActiveScheduleId,
  ]);

  const activeSchedule =
    activeScheduleId == null
      ? null
      : schedules[
      activeScheduleId
      ] ?? null;

  const allLocationsSelected =
    sites.length > 0 &&
    sites.every(
      (site) =>
        selectedLocations.has(
          site.loc
        )
    );

  const someLocationsSelected =
    sites.some(
      (site) =>
        selectedLocations.has(
          site.loc
        )
    );

  const toggleAllLocations = () => {
    const shouldSelect =
      !someLocationsSelected;

    for (const site of sites) {
      const selected =
        selectedLocations.has(
          site.loc
        );

      if (
        selected !==
        shouldSelect
      ) {
        toggleLocation(
          site.loc
        );
      }
    }
  };

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
            checked={
              overlays.forecastDescriptions
            }
            onChange={() =>
              toggle(
                'forecastDescriptions'
              )
            }
          />
          Show Forecast Descriptions
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
        <div className="grid gap-2">
          <div className="font-semibold">
            Sites
          </div>

          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={
                allLocationsSelected
              }
              ref={(input) => {
                if (input) {
                  input.indeterminate =
                    someLocationsSelected &&
                    !allLocationsSelected;
                }
              }}
              onChange={
                toggleAllLocations
              }
            />
            <span className="font-semibold">
              Select all
            </span>
          </label>

          {sites.map(
            (site) => (
              <label
                key={site.loc}
                className="flex items-start gap-2"
              >
                <input
                  type="checkbox"
                  checked={
                    selectedLocations.has(
                      site.loc
                    )
                  }
                  onChange={() =>
                    toggleLocation(
                      site.loc
                    )
                  }
                />

                <span>
                  <span className="font-semibold">
                    {site.loc}
                  </span>

                  <span className="ml-1 text-slate-500">
                    {site.locName}
                  </span>
                </span>
              </label>
            )
          )}

          <div className="mt-2 border-t border-slate-200 pt-2">
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold">
                Active schedule
              </span>

              <select
                className="w-full border border-slate-300 bg-white px-1 py-1 text-xs"
                value={
                  activeScheduleId ??
                  ''
                }
                onChange={(event) =>
                  setActiveScheduleId(
                    event.target.value ||
                    null
                  )
                }
              >
                <option value="">
                  No active schedule
                </option>

                {visibleSchedules.map(
                  (schedule) => (
                    <option
                      key={
                        schedule.id
                      }
                      value={
                        schedule.id
                      }
                    >
                      {schedule.title}
                    </option>
                  )
                )}
              </select>
            </label>

            <div
              className={
                activeSchedule
                  ? 'mt-1 text-[10px] text-emerald-700'
                  : 'mt-1 text-[10px] text-amber-700'
              }
            >
              {activeSchedule
                ? activeSchedule.locations
                  .length === 0
                  ? 'All sites'
                  : activeSchedule.locations.join(
                    ', '
                  )
                : 'New stoppages will remain unallocated.'}
            </div>
            <div className="mt-2 flex gap-1">
              {activeSchedule == null ? (
                <button
                  type="button"
                  className="flex-1 border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                  onClick={() =>
                    setCreatingSchedule(
                      true
                    )
                  }
                >
                  + Create schedule
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    className="flex-1 border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() =>
                      setEditingScheduleId(
                        activeSchedule.id
                      )
                    }
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    title="Stop using this as the active schedule"
                    className="flex-1 border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50"
                    onClick={() =>
                      setActiveScheduleId(
                        null
                      )
                    }
                  >
                    Deselect
                  </button>
                </>
              )}
            </div>
          </div>
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

function formatScheduleBoundaryWarning(
  row
) {
  if (
    row.scheduleBoundaryIssue == null ||
    row.scheduleStartMs == null ||
    row.scheduleEndMs == null
  ) {
    return '';
  }

  const issue =
    row.scheduleBoundaryIssue ===
      'before'
      ? 'Stoppage starts before its schedule.'
      : 'Stoppage finishes after its schedule.';

  return [
    issue,
    `Schedule start: ${formatFullDateTime(
      row.scheduleStartMs
    )}`,
    `Schedule end: ${formatFullDateTime(
      row.scheduleEndMs
    )}`,
  ].join('\n');
}

function EditableStoppageDescription({
  row,
  editing,
  startEditing,
  finishEditing,
  renameStoppage,
  scrollToTime,
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
        className="min-w-0 flex flex-1 items-center gap-1"
      >
        {row.startMs != null && (
          <button
            className="shrink-0 text-slate-500 hover:text-slate-900"
            title="Scroll to stoppage"
            onClick={(event) => {
              event.stopPropagation();
              scrollToTime(
                row.startMs +
                (
                  (
                    row.durationMinutes ??
                    0
                  ) *
                  MINUTE
                ) /
                2
              );
            }}
          >
            <EyeIcon />
          </button>
        )}
        {row.scheduleBoundaryIssue != null && (
          <span
            className="shrink-0 cursor-help text-amber-600"
            title={
              formatScheduleBoundaryWarning(
                row
              )
            }
            aria-label="Stoppage is outside its schedule boundary"
          >
            ⚠
          </span>
        )}
        <div
          className="min-w-0 truncate cursor-text"
          title="Double-click to rename"
          onDoubleClick={startEditing}
        >
          {row.description}
        </div>
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

function LocationCell({
  row,
}) {
  const locations =
    row.locations ??
    (
      row.location != null
        ? [row.location]
        : []
    );

  return (
    <div
      className="flex items-center whitespace-nowrap border-r px-2"
      title={
        locations.join(', ')
      }
    >
      {locations.join(', ')}
    </div>
  );
}

function StoppageCell({
  row,
  stoppages,
}) {
  const stoppageId =
    row.type === 'stoppage'
      ? row.id
      : row.allocatedStoppageId ??
      null;

  const stoppage =
    stoppageId == null
      ? null
      : stoppages[
      stoppageId
      ] ?? null;

  return (
    <div
      className="flex items-center overflow-hidden whitespace-nowrap border-r px-2"
      title={
        stoppage?.description ??
        ''
      }
    >
      <span className="truncate">
        {stoppage?.description ??
          ''}
      </span>
    </div>
  );
}

function ScheduleCell({
  row,
  schedules,
  stoppageSchedule,
}) {
  const stoppageId =
    row.type === 'stoppage'
      ? row.id
      : row.allocatedStoppageId ??
      null;

  const scheduleId =
    row.type === 'schedule'
      ? row.scheduleId
      : stoppageId != null
        ? stoppageSchedule[
        stoppageId
        ] ?? null
        : row.scheduleId ??
        null;

  const schedule =
    scheduleId == null
      ? null
      : schedules[
      scheduleId
      ] ?? null;

  return (
    <div
      className="flex items-center overflow-hidden whitespace-nowrap border-r px-2"
      title={
        schedule?.title ??
        ''
      }
    >
      <span className="truncate">
        {schedule?.title ??
          ''}
      </span>
    </div>
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

          {showLabel &&
            row.workOrderId &&
            row.plant ? (
            <span className="min-w-0 truncate">
              <a
                href={makeWomaUrl(row.plant, row.workOrderId)}
                target="_blank"
                rel="noopener noreferrer"
                title={`View Material Availability for ${row.workOrderId}`}
                className={`text-sky-700 underline underline-offset-2 hover:text-sky-900`}
              >{availability.label}</a>
            </span>
          ) : (
            <span className="min-w-0 truncate">
              {availability.label}
            </span>
          )
          }
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

function getForecastSourceSymbol(
  row
) {
  if (row.forecastWarning) {
    return '⚠';
  }

  return row.forecastSource ===
    'usage'
    ? '∿'
    : '◷';
}

function formatForecastSource(
  row
) {
  if (row.forecastSource === 'usage') {
    return 'Computed from usage';
  }

  return row.forecastWarning
    ? 'Planned date fallback'
    : 'Planned date';
}

function formatForecastWarning(
  warning
) {
  switch (warning) {
    case 'missing-baseline':
      return 'Missing completed baseline';

    case 'missing-frequency':
      return 'Missing maintenance-plan frequency';

    case 'missing-counter':
      return 'Missing counter';

    case 'predictor-error':
      return 'Counter forecast failed';

    default:
      return null;
  }
}

function ForecastCell({
  row,
  scrollToTime,
  openForecastDerivation,
}) {
  if (row.forecastMs == null) {
    return (
      <div className="flex items-center whitespace-nowrap border-r px-2" />
    );
  }

  const warningLabel =
    formatForecastWarning(
      row.forecastWarning
    );

  const tooltip = [
    `Forecast: ${formatFullDateTime(
      row.forecastMs
    )}`,
    `Source: ${formatForecastSource(
      row
    )}`,
    row.forecastHours != null
      ? `Forecast usage: ${formatResourceQuantity(
        row.forecastHours
      )}`
      : null,
    warningLabel
      ? `Warning: ${warningLabel}`
      : null,
    row.forecastWarningDetail,
  ]
    .filter(Boolean)
    .join('\n');

  return (
    <div className="flex items-center gap-1 whitespace-nowrap border-r px-2">

      <button
        className="shrink-0 text-slate-500 hover:text-slate-900"
        title="Scroll to forecast"
        onClick={(event) => {
          event.stopPropagation();

          scrollToTime(
            row.forecastMs
          );
        }}
      >
        <EyeIcon />
      </button>

      <span title={tooltip}>
        {formatDateTime(
          row.forecastMs
        )}
      </span>

      <button
        className={
          row.forecastWarning
            ? 'shrink-0 text-amber-700 hover:text-amber-900 cursor-help'
            : 'shrink-0 text-slate-500 hover:text-slate-900 cursor-help'
        }
        title={`${tooltip}\nClick to view forecast derivation.`}
        onClick={(event) => {
          event.stopPropagation();

          openForecastDerivation(
            row
          );
        }}
      >
        {getForecastSourceSymbol(
          row
        )}
      </button>
    </div>
  );
}

function ResourcesCell({
  row,
  column,
}) {
  const resourceDemands =
    getRowResourceDemands(row);

  const showText =
    column.width >= COMPACT_WIDTH;

  return (
    <div
      className="flex items-center whitespace-nowrap border-r px-2"
      title={formatResourceDemands(
        resourceDemands
      )}
    >
      {showText
        ? resourceDemands
          .map((demand) => {
            const resource =
              resourceDefinitionByCode[
              demand.resourceCode
              ];

            return `${formatResourceQuantity(
              demand.quantity
            )}x ${demand.resourceCode}${resource?.emoji ?? ''}`;
          })
          .join(', ')
        : formatResourceDemandIcons(
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

function ExpectedUsageCell({
  row,
}) {
  const tooltip =
    formatForecastStartAdvice(
      row
    );

  return (
    <div
      className="flex items-center whitespace-nowrap border-r px-2"
      title={tooltip}
    >
      {row.expectedStartHours != null
        ? `${Math.round(
          row.expectedStartHours
        )}hrs`
        : ''}
    </div>
  );
}

function ForecastDeviationCell({
  row,
}) {
  const usageDeviation =
    row.forecastDeviationHours != null
      ? `Usage ${formatSignedQuantity(
        row.forecastDeviationHours
      )}hrs`
      : null;

  const timeDeviation =
    row.forecastDeviationMs != null
      ? `Time ${formatSignedDuration(
        row.forecastDeviationMs
      )}`
      : null;

  const text = [
    usageDeviation,
    timeDeviation,
  ]
    .filter(Boolean)
    .join(' / ');

  return (
    <div
      className="flex items-center whitespace-nowrap border-r px-2"
      title={
        formatForecastStartAdvice(
          row
        )
      }
    >
      {text}
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
  scrollToTime,
}) {
  const reorderable = [
    'allocated',
    'unallocated',
    'topReason',
  ].includes(row.type);

  const isGroupingHeader = [
    'unallocatedHeader',
    'assetUnallocatedHeader',
    'assetStoppageReasonsHeader',
    'unallocatedStoppagesHeader',
  ].includes(
    row.type
  );

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
          <ExpandIcon
            expanded={expanded}
          />
        </button>
      ) : (
        <span className="mr-4" />
      )}

      {row.type === 'stoppage' ? (
        <div className="min-w-0 flex flex-1 items-center">
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
            scrollToTime={
              scrollToTime
            }
          />
        </div>
      ) : (
        <div className="min-w-0 flex flex-1 items-center gap-1 truncate">
          {row.startMs != null && (
            <button
              className="shrink-0 text-slate-500 hover:text-slate-900"
              title="Scroll to scheduled work"
              onClick={(event) => {
                event.stopPropagation();
                scrollToTime(
                  row.startMs +
                  (
                    (
                      row.durationMinutes ??
                      0
                    ) *
                    MINUTE
                  ) /
                  2
                );
              }}
            >
              <EyeIcon />
            </button>
          )}
          {row.type === 'unallocatedHeader' ||
            row.type ===
            'assetUnallocatedHeader' ? (
            <>
              <span className="mr-1 text-slate-400">
                📂
              </span>

              <span className="font-medium text-slate-500">
                {row.description}
              </span>
            </>
          ) : row.type ===
            'assetStoppageReasonsHeader' ? (
            <>
              <span className="mr-1 text-slate-400">
                🗓️
              </span>

              <span className="font-medium text-slate-500">
                {row.description}
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
  schedules,
  activeScheduleId,
  addStoppageToActiveSchedule,
  removeStoppageFromSchedule,
  hoveredActionGroupKey,
  setHoveredActionGroupKey,
}) {
  const isWorkItem =
    row.type === 'allocated' ||
    row.type === 'unallocated' ||
    row.type === 'assetUnallocated' ||
    row.type === 'topReason';

  const actionGroupKey =
    !isWorkItem
      ? null
      : row.workOrderId
        ? `order:${row.workOrderId}`
        : row.id != null
          ? `item:${row.id}`
          : null;

  const groupHighlighted =
    actionGroupKey != null &&
    hoveredActionGroupKey ===
    actionGroupKey;

  const sharedActionProps =
    actionGroupKey == null
      ? {}
      : {
        onPointerEnter: () =>
          setHoveredActionGroupKey(
            actionGroupKey
          ),
        onPointerLeave: () =>
          setHoveredActionGroupKey(
            (current) =>
              current ===
                actionGroupKey
                ? null
                : current
          ),
      };

  const actionClassName =
    `inline-flex items-center text-sky-700 ${groupHighlighted
      ? 'bg-sky-100'
      : ''
    }`;

  if (
    row.type === 'stoppage'
  ) {
    const assignedSchedule =
      row.scheduleId == null
        ? null
        : schedules[
        row.scheduleId
        ] ?? null;

    const activeSchedule =
      activeScheduleId == null
        ? null
        : schedules[
        activeScheduleId
        ] ?? null;

    const isScheduled =
      assignedSchedule != null;

    const isInActiveSchedule =
      activeScheduleId != null &&
      row.scheduleId ===
      activeScheduleId;

    const canAssignToActive =
      activeSchedule != null &&
      !isInActiveSchedule;

    return (
      <div className="flex items-center gap-2 overflow-hidden whitespace-nowrap border-r px-2 text-[11px]">
        {canAssignToActive && (
          <button
            className="text-sky-700"
            title={
              isScheduled
                ? `Move to ${activeSchedule.title}`
                : `Add to ${activeSchedule.title}`
            }
            onClick={() =>
              addStoppageToActiveSchedule(
                row
              )
            }
          >
            {isScheduled
              ? '→ Move'
              : '→ Add'}
          </button>
        )}

        {isScheduled && (
          <button
            className="text-sky-700"
            title={`Remove from ${assignedSchedule.title}`}
            onClick={() =>
              removeStoppageFromSchedule(
                row
              )
            }
          >
            ← Remove
          </button>
        )}

        <button
          className="text-red-700"
          title={`Delete ${row.description}`}
          onClick={() =>
            deleteStoppage(
              row
            )
          }
        >
          × Delete
        </button>
      </div>
    );
  }

  // TODO: extract the button out as we may want multiple actions per cell
  // and currently the key is the row type but it may be a composite key if more advanced predicates are required.
  const actions = {
    'asset': {
      action: allocate,
      symbol: '＋',
      text: "Create Stoppage",
    },
    'assetUnallocated': {
      action: allocate,
      symbol: '＋',
      text: "Create Stoppage with",
    },
    'allocated': {
      action: remove,
      symbol: '←',
      text: "Remove from Stoppage",
    },
    'unallocated': {
      action: allocate,
      symbol: '→',
      text: "Add to Stoppage",
    },
    'topReason': {
      action: allocate,
      symbol: '＋',
      text: "Create Stoppage with",
    },
  }
  const action = actions[row.type] ?? null;
  return (
    <div className="flex items-center overflow-hidden whitespace-nowrap border-r px-2 text-[11px]">
      {action && (
        <button
          {...sharedActionProps}
          className={actionClassName}
          onClick={() =>
            action.action(row)
          }
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            {action.symbol}
          </span>
          {action.text}
        </button>
      )}
    </div>
  );
}

function TableRow({
  row,
  stoppages,
  stoppageSchedule,
  schedules,
  activeScheduleId,
  addStoppageToActiveSchedule,
  removeStoppageFromSchedule,
  openForecastDerivation,
  hovered,
  setHoveredRowId,
  startResourceHover,
  finishResourceHover,
  flashed,
  hoveredActionGroupKey,
  setHoveredActionGroupKey,
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
  scrollToTime,
}) {
  const height = getHeight(row);

  const finishMs =
    row.startMs != null &&
      row.durationMinutes != null
      ? row.startMs +
      row.durationMinutes * MINUTE
      : null;

  const isGroupingHeader = [
    'unallocatedHeader',
    'assetUnallocatedHeader',
    'assetStoppageReasonsHeader',
    'unallocatedStoppagesHeader',
  ].includes(
    row.type
  );

  const cellProps = {
    row,
    stoppages,
    stoppageSchedule,
    schedules,
    activeScheduleId,
    addStoppageToActiveSchedule,
    removeStoppageFromSchedule,
    openForecastDerivation,
    hoveredActionGroupKey,
    setHoveredActionGroupKey,
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
    scrollToTime,
  };

  return (
    <div
      className={`grid ${height} border-b border-slate-200 text-xs transition-colors duration-150
        ${flashed ? 'bg-yellow-100'
          : hovered ? 'bg-sky-50'
            : isGroupingHeader ? 'bg-slate-100'
              : ''}`
      }
      style={{
        gridTemplateColumns: template,
      }}
      onPointerEnter={() => {
        setHoveredRowId(
          row.id
        );

        startResourceHover(
          row
        );
      }}
      onPointerLeave={() => {
        setHoveredRowId(
          (current) =>
            current === row.id
              ? null
              : current
        );

        finishResourceHover(
          row
        );
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
          {row.workOrderId &&
            row.plant ? (
            <a href={makeWomaUrl(
              row.plant,
              row.workOrderId
            )}
              target="_blank"
              rel="noopener noreferrer"
              title={`View Material Availability for ${row.workOrderId}`}
              className="cursor-pointer hover:opacity-70"
              onPointerDown={(event) => {
                event.stopPropagation();
              }}
              onClick={(event) => {
                event.stopPropagation();
              }}
            >
              {availability.symbol}
            </a>
          ) : (
            availability.symbol
          )}
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
  forecastStartAdvice,
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

  if (forecastStartAdvice) {
    lines.push(
      `Scheduled: ${forecastStartAdvice}`
    );
  }

  return lines.join('\n');
}

function getHeight(row) {
  return [
    'unallocatedHeader',
    'assetUnallocatedHeader',
    'assetStoppageReasonsHeader',
    'unallocatedStoppagesHeader',
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
  hovered,
  hoveredRowId,
  setHoveredRowId,
  flashed,
  flashedRowIds,
  overlays,
  startDrag,
  moveToForecast,
  startResourceHover,
  finishResourceHover,
  allocate,
  remove,
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
            forecastHours:
              row.forecastHours ?? null,
            forecastSource:
              row.forecastSource ?? 'planned',
            forecastWarning:
              row.forecastWarning ?? null,
            forecastWarningDetail:
              row.forecastWarningDetail ?? null,
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

  const resourceDemandIcons =
    formatResourceDemandIcons(
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

          const resourceDemandIcons =
            formatResourceDemandIcons(
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
                    <span
                      title={
                        formattedResourceDemands
                      }
                    >
                      {resourceDemandIcons}
                    </span>
                  </div>
                )}

              <div
                className={`absolute top-1/2 -translate-y-1/2 z-20 flex h-6 cursor-ew-resize select-none items-center justify-center rounded bg-cyan-800 px-1 text-[10px] font-semibold text-white transition-[box-shadow] duration-700
                ${flashedRowIds.has(
                  summary.id
                )
                    ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-white'
                    : hoveredRowId === summary.id
                      ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-white'
                      : ''
                  }`
                }
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
                onPointerEnter={() => {
                  setHoveredRowId(
                    summary.id
                  );

                  startResourceHover({
                    ...summary,
                    type: 'stoppage',
                  });
                }}
                onPointerLeave={() => {
                  setHoveredRowId(
                    (current) =>
                      current === summary.id
                        ? null
                        : current
                  );

                  finishResourceHover({
                    ...summary,
                    type: 'stoppage',
                  });
                }}
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
            <span
              title={
                formattedResourceDemands
              }
            >
              {resourceDemandIcons}
            </span>
          </div>
        )}

      {row.type !== 'asset' &&
        row.type !== 'schedule' &&
        row.startMs != null &&
        durationMs != null && (
          <div
            className={`absolute top-1/2 z-20 flex h-6 -translate-y-1/2 cursor-ew-resize select-none items-center justify-center rounded text-[10px] font-semibold transition-[box-shadow] duration-700 ${getBarClass(row)}
            ${flashed
                ? 'ring-2 ring-yellow-400 ring-offset-1 ring-offset-white'
                : hovered
                  ? 'ring-2 ring-sky-400 ring-offset-1 ring-offset-white'
                  : row.type === 'stoppage' &&
                    row.scheduleBoundaryIssue != null
                    ? 'ring-2 ring-amber-500 ring-offset-1 ring-offset-white'
                    : ''
              }`
            }
            style={{
              left: leftAt(row.startMs),
              width: widthFor(durationMs),
              touchAction: 'none',
            }}
            title={[
              formatWorkTooltip({
                workOrderId:
                  row.type === 'stoppage'
                    ? null
                    : row.workOrderId ?? null,
                description:
                  row.description,
                startMs:
                  row.startMs,
                finishMs:
                  row.startMs +
                  durationMs,
                forecastMs:
                  row.type === 'stoppage'
                    ? null
                    : row.forecastMs ?? null,
                forecastStartAdvice:
                  row.type === 'stoppage'
                    ? null
                    : formatForecastStartAdvice(
                      row
                    ),
              }),
              row.type === 'stoppage'
                ? formatScheduleBoundaryWarning(
                  row
                )
                : '',
            ]
              .filter(Boolean)
              .join('\n\n')}
            onPointerEnter={() => {
              setHoveredRowId(
                row.id
              );

              startResourceHover(
                row
              );
            }}
            onPointerLeave={() => {
              setHoveredRowId(
                (current) =>
                  current === row.id
                    ? null
                    : current
              );

              finishResourceHover(
                row
              );
            }}
            onPointerDown={(event) =>
              startDrag(event, row)
            }
            onDoubleClick={(event) => {
              event.stopPropagation();

              if (
                row.type === 'unallocated' &&
                row.stoppageId
              ) {
                allocate(row);
                return;
              }

              if (row.type === 'allocated') {
                remove(row);
              }
            }}
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

          const forecastOwner =
            row.type === 'asset'
              ? marker
              : row;

          const warningLabel =
            formatForecastWarning(
              forecastOwner.forecastWarning
            );

          const tooltip = [
            `${forecastType}: ${formatFullDateTime(
              forecastMs
            )}`,
            `Source: ${formatForecastSource(
              forecastOwner
            )}`,
            forecastOwner.forecastHours != null
              ? `Forecast usage: ${formatResourceQuantity(
                forecastOwner.forecastHours
              )}`
              : null,
            warningLabel
              ? `Warning: ${warningLabel}`
              : null,
            forecastOwner.forecastWarningDetail ??
            null,
            formatForecastStartAdvice(
              forecastOwner
            )
              ? `Scheduled: ${formatForecastStartAdvice(
                forecastOwner
              )}`
              : null,
            forecastOwner.forecastAdviceWarning
              ? `Schedule advice warning: ${forecastOwner.forecastAdviceWarning}`
              : null,
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
                className={`absolute top-1/2 z-40 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border
                ${row.type === 'asset'
                    ? 'cursor-default'
                    : 'cursor-pointer'
                  }
                ${forecastClass}`
                } style={{
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
              {overlays.forecastDescriptions &&
                row.type === 'asset' &&
                marker.isStoppageReason &&
                marker.allocatedStoppageId == null &&
                marker.description && (

                  <div
                    className="pointer-events-none absolute top-1/2 z-30 -translate-y-1/2 whitespace-nowrap px-1 text-[10px] text-slate-700"
                    style={{
                      left: `calc(${leftAt(
                        forecastMs
                      )} + 12px)`,
                    }}
                  >
                    {marker.description}
                  </div>
                )}
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

function startGrabScroll(
  event,
  {
    panHorizontal = null,
    verticalElement = null,
    vertical = false,
  }
) {
  if (event.button !== 1) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  const originY =
    event.clientY;

  const originScrollTop =
    verticalElement?.scrollTop ??
    0;

  let previousX =
    event.clientX;

  const previousCursor =
    document.body.style.cursor;

  const previousUserSelect =
    document.body.style.userSelect;

  document.body.style.cursor =
    'grabbing';

  document.body.style.userSelect =
    'none';

  const move = (moveEvent) => {
    moveEvent.preventDefault();

    if (panHorizontal) {
      const deltaX =
        previousX -
        moveEvent.clientX;

      previousX =
        moveEvent.clientX;

      panHorizontal(
        deltaX
      );
    }

    if (
      vertical &&
      verticalElement
    ) {
      verticalElement.scrollTop =
        originScrollTop -
        (
          moveEvent.clientY -
          originY
        );
    }
  };

  const finish = () => {
    document.body.style.cursor =
      previousCursor;

    document.body.style.userSelect =
      previousUserSelect;

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
}

function PaneResizeHandle({
  tablePaneWidth,
  setTablePaneWidth,
}) {
  const startResize = (event) => {
    if (event.button !== 0) {
      return;
    }

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
    if (event.button !== 0) {
      return;
    }

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
  stoppages,
  stoppageSchedule,
  schedules,
  activeScheduleId,
  addStoppageToActiveSchedule,
  removeStoppageFromSchedule,
  openForecastDerivation,
  hoveredRowId,
  setHoveredRowId,
  flashedRowIds,
  hoveredActionGroupKey,
  setHoveredActionGroupKey,
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
  scrollToTime,
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

  const itemsViewportRef =
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

  const panTableHorizontal = (
    deltaPixels
  ) => {
    if (!tableBodyRef.current) {
      return;
    }

    tableBodyRef.current.scrollLeft +=
      deltaPixels;

    syncTableScroll(
      tableBodyRef,
      tableScrollbarRef
    );
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
    if (event.button !== 0) {
      return;
    }

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
                        if (event.button !== 0) {
                          return;
                        }

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

      <div
        ref={itemsViewportRef}
        className="h-full min-h-0 overflow-x-hidden overflow-y-auto"
      >
        <div
          className="grid min-h-full"
          style={{
            gridTemplateColumns:
              `${tablePaneWidth}px minmax(0, 1fr)`,
          }}
        >
          <div
            ref={tableBodyRef}
            className="h-full overflow-x-auto overflow-y-hidden border-r [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            onScroll={() =>
              syncTableScroll(
                tableBodyRef,
                tableScrollbarRef
              )
            }
            onPointerDown={(event) => {
              startGrabScroll(
                event,
                {
                  panHorizontal:
                    panTableHorizontal,
                  verticalElement:
                    itemsViewportRef.current,
                  vertical: true,
                }
              );
            }}
          >
            <div
              style={{
                width: contentWidth,
              }}
            >
              {rows.map((row) => (
                <TableRow
                  key={`table-${row.rowKey}`}
                  openForecastDerivation={
                    openForecastDerivation
                  }
                  row={row}
                  stoppages={
                    stoppages
                  }
                  stoppageSchedule={
                    stoppageSchedule
                  }
                  schedules={
                    schedules
                  }
                  activeScheduleId={
                    activeScheduleId
                  }
                  addStoppageToActiveSchedule={
                    addStoppageToActiveSchedule
                  }
                  removeStoppageFromSchedule={
                    removeStoppageFromSchedule
                  }
                  hovered={
                    hoveredRowId === row.id
                  }
                  setHoveredRowId={
                    setHoveredRowId
                  }
                  hoveredRowId={
                    hoveredRowId
                  }
                  startResourceHover={
                    startResourceHover
                  }
                  finishResourceHover={
                    finishResourceHover
                  }
                  flashed={
                    flashedRowIds.has(
                      row.id
                    )
                  }
                  hoveredActionGroupKey={
                    hoveredActionGroupKey
                  }
                  setHoveredActionGroupKey={
                    setHoveredActionGroupKey
                  }
                  columns={columns}
                  template={template}
                  expanded={
                    getExpanded(
                      expanded,
                      row.id
                    )
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
                  scrollToTime={
                    scrollToTime
                  }
                />
              ))}
            </div>
          </div>

          <div
            className="h-full min-w-0 overflow-hidden"
            onPointerDown={(event) => {
              startGrabScroll(
                event,
                {
                  panHorizontal:
                    timeline.panHorizontal,
                  verticalElement:
                    itemsViewportRef.current,
                  vertical: true,
                }
              );
            }}
          >
            <div
              ref={timeline.itemsRef}
              onScroll={
                timeline.onItemsScroll
              }
              className="h-full overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              <div style={{ width }}>
                {rows.map((row) => (
                  <GanttRow
                    key={`gantt-${row.rowKey}`}
                    allocate={allocate}
                    remove={remove}
                    row={row}
                    hovered={
                      hoveredRowId === row.id
                    }
                    setHoveredRowId={
                      setHoveredRowId
                    }
                    flashed={
                      flashedRowIds.has(
                        row.id
                      )
                    }
                    flashedRowIds={
                      flashedRowIds
                    }
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
        <ExpandIcon
          expanded={expanded}
        />
        {' '}
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
  const resourcesViewportRef =
    React.useRef(null);

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
          <ExpandIcon
            expanded={open}
          />{' '}
          Resources
        </button>

        <div />
      </div>

      {open && (
        <div
          ref={resourcesViewportRef}
          className="h-full min-h-0 overflow-x-hidden overflow-y-auto"
        >
          <div
            className="grid min-h-full"
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

            <div className="relative h-full min-w-0 overflow-hidden">
              <div
                ref={
                  timeline.resourcesRef
                }
                onScroll={
                  timeline
                    .onResourcesScroll
                }
                onPointerDown={(event) => {
                  startGrabScroll(
                    event,
                    {
                      panHorizontal:
                        timeline.panHorizontal,
                      verticalElement:
                        resourcesViewportRef.current,
                      vertical: true,
                    }
                  );
                }}
                className="h-full overflow-x-auto overflow-y-hidden"
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

const FORECAST_CHART = {
  width: 1000,
  height: 440,

  margin: {
    top: 30,
    right: 40,
    bottom: 50,
    left: 70,
  },

  colour: {
    reading: '#1e3a8a',
    interpolation: '#0891b2',
    extrapolationBefore: '#16a34a',
    extrapolationAfter: '#2563eb',

    completedCallFill: '#fecaca',
    completedCallStroke: '#ef4444',

    forecastCallFill: '#f8fafc',
    forecastCallStroke: '#475569',

    baselineCallFill: '#fed7aa',
    baselineCallStroke: '#ea580c',
    baselineGuide: '#f97316',

    selectedCallFill: '#22c55e',
    selectedCallStroke: '#15803d',
    selectedGuide: '#16a34a',

    axis: '#475569',
    axisText: '#64748b',
    grid: '#e2e8f0',
    minorGrid: '#f1f5f9',
  },

  radius: {
    reading: 2.25,
  },

  callMarker: {
    normalSize: 6,
    baselineSize: 8,
    selectedSize: 8,

    normalStrokeWidth: 1,
    baselineStrokeWidth: 2,
    selectedStrokeWidth: 2,
  },

  line: {
    interpolationWidth: 1.25,
    extrapolationWidth: 1.5,
    guideWidth: 1,
    gridWidth: 1,

    dash: '3 3',
    guideDash: '4 4',
    baselineGuideDash: '6 3',
  },

  opacity: {
    reading: 0.75,
  },

  label: {
    usageOffsetX: 8,
    usageOffsetY: 6,
    dateOffsetX: 8,
    dateOffsetY: 8,

    selectedDescriptionOffsetX: 16,
    selectedDescriptionOffsetY: 0,

    baselineDescriptionOffsetX: 16,
    baselineDescriptionOffsetY: 0,

    fontSize: 10,
    descriptionFontSize: 10,
  },

  tick: {
    preferredYCount: 6,
    preferredXCount: 6,

    smallYStep: 250,
    mediumYStep: 500,
    largeYStep: 1000,

    defaultDaySteps: [
      1,
      2,
      7,
      14,
      30,
      60,
      90,
      180,
      365,
    ],
  },
};

function getForecastChartYStep(
  range
) {
  const target =
    range /
    FORECAST_CHART.tick
      .preferredYCount;

  if (
    target <=
    FORECAST_CHART.tick.smallYStep
  ) {
    return FORECAST_CHART.tick
      .smallYStep;
  }

  if (
    target <=
    FORECAST_CHART.tick.mediumYStep
  ) {
    return FORECAST_CHART.tick
      .mediumYStep;
  }

  if (
    target <=
    FORECAST_CHART.tick.largeYStep
  ) {
    return FORECAST_CHART.tick
      .largeYStep;
  }

  return (
    Math.ceil(
      target / 1000
    ) * 1000
  );
}

function createNumericTicks(
  start,
  end,
  step
) {
  const ticks = [];

  for (
    let value = start;
    value <= end;
    value += step
  ) {
    ticks.push(value);
  }

  return ticks;
}

function getForecastChartDayStep(
  rangeDays
) {
  const targetStep =
    rangeDays /
    FORECAST_CHART.tick
      .preferredXCount;

  return (
    FORECAST_CHART.tick
      .defaultDaySteps
      .find(
        (step) =>
          step >= targetStep
      ) ??
    Math.ceil(
      targetStep / 365
    ) * 365
  );
}

function getForecastChartDefaults(
  derivation
) {
  const snapshot =
    derivation.predictorSnapshot;

  const callDates =
    derivation.calls.flatMap(
      (call) => [
        call.completedMs,
        call.forecastMs,
      ].filter(
        (value) =>
          value != null
      )
    );

  const readingDates =
    snapshot?.points.map(
      (point) =>
        point.x.getTime()
    ) ?? [];

  const dates = [
    ...readingDates,
    ...callDates,
  ];

  const rawStartMs =
    Math.min(...dates);

  const rawEndMs =
    Math.max(...dates);

  const rawRangeMs =
    Math.max(
      DAY,
      rawEndMs -
      rawStartMs
    );

  const paddingMs =
    Math.max(
      DAY,
      rawRangeMs * 0.05
    );

  const startMs =
    rawStartMs -
    paddingMs;

  const endMs =
    rawEndMs +
    paddingMs;

  const rangeDays =
    (
      endMs -
      startMs
    ) /
    DAY;

  return {
    startMs,
    endMs,
    dayStep:
      getForecastChartDayStep(
        rangeDays
      ),
  };
}

function formatForecastChartDate(
  value,
  includeYear
) {
  const date =
    new Date(value);

  const day =
    date.getDate();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  if (!includeYear) {
    return `${day}/${month}`;
  }

  return `${day}/${month}/${date.getFullYear()}`;
}

function ForecastDerivationChartControls({
  config,
  setConfig,
  reset,
}) {
  const setDate = (
    key,
    value
  ) => {
    const parsed =
      Date.parse(
        `${value}T00:00:00+08:00`
      );

    if (!Number.isFinite(parsed)) {
      return;
    }

    setConfig(
      (current) => ({
        ...current,
        [key]: parsed,
      })
    );
  };

  return (
    <div className="mb-3 flex flex-wrap items-end gap-3 border-b border-slate-200 pb-3">
      <label className="grid gap-1 text-[11px]">
        <span>Chart start</span>

        <input
          type="date"
          className="h-8 border border-slate-300 bg-white px-2 text-xs"
          value={formatDateInput(
            config.startMs
          )}
          onChange={(event) =>
            setDate(
              'startMs',
              event.target.value
            )
          }
        />
      </label>

      <label className="grid gap-1 text-[11px]">
        <span>Chart end</span>

        <input
          type="date"
          className="h-8 border border-slate-300 bg-white px-2 text-xs"
          value={formatDateInput(
            config.endMs
          )}
          onChange={(event) =>
            setDate(
              'endMs',
              event.target.value
            )
          }
        />
      </label>

      <label className="grid gap-1 text-[11px]">
        <span>Tick interval</span>

        <div className="flex items-center gap-1">
          <input
            type="number"
            min="1"
            step="1"
            className="h-8 w-20 border border-slate-300 bg-white px-2 text-xs"
            value={
              config.dayStep
            }
            onChange={(event) => {
              const dayStep =
                Math.max(
                  1,
                  Math.round(
                    Number(
                      event.target.value
                    )
                  )
                );

              if (
                !Number.isFinite(
                  dayStep
                )
              ) {
                return;
              }

              setConfig(
                (current) => ({
                  ...current,
                  dayStep,
                })
              );
            }}
          />

          <span className="text-xs text-slate-500">
            days
          </span>
        </div>
      </label>

      <button
        type="button"
        className="h-8 border border-slate-300 bg-white px-3 text-xs hover:bg-slate-50"
        onClick={reset}
      >
        Reset
      </button>
    </div>
  );
}

function ForecastDerivationChart({
  derivation,
  config,
  baselineCall,
}) {
  const snapshot =
    derivation.predictorSnapshot;

  if (
    !snapshot ||
    snapshot.points.length === 0
  ) {
    return (
      <div className="flex h-80 items-center justify-center text-xs text-slate-500">
        No predictor data available.
      </div>
    );
  }

  const {
    width,
    height,
    margin,
  } = FORECAST_CHART;

  const plotWidth =
    width -
    margin.left -
    margin.right;

  const plotHeight =
    height -
    margin.top -
    margin.bottom;

  const callPoints =
    derivation.calls
      .map((call) => {
        if (
          call.isCompleted &&
          call.completedMs != null &&
          call.completionHours != null
        ) {
          return {
            call,
            x: call.completedMs,
            y: call.completionHours,
          };
        }

        if (
          !call.isCompleted &&
          call.forecastMs != null &&
          call.forecastHours != null
        ) {
          return {
            call,
            x: call.forecastMs,
            y: call.forecastHours,
          };
        }

        return null;
      })
      .filter(Boolean);

  const selectedPoint =
    callPoints.find(
      (point) =>
        point.call.mpCall ===
        derivation.selectedCall
    ) ?? null;

  const baselinePoint =
    baselineCall == null
      ? null
      : callPoints.find(
        (point) =>
          point.call.id ===
          baselineCall.id
      ) ?? null;

  const allX = [
    ...snapshot.points.map(
      (point) =>
        point.x.getTime()
    ),
    ...callPoints.map(
      (point) => point.x
    ),
  ];

  const allY = [
    ...snapshot.points.map(
      (point) => point.y
    ),
    ...callPoints.map(
      (point) => point.y
    ),
  ];

  const rawMinX =
    Math.min(...allX);

  const rawMaxX =
    Math.max(...allX);

  const rawMinY =
    Math.min(...allY);

  const rawMaxY =
    Math.max(...allY);

  const minX =
    config.startMs;

  const maxX =
    config.endMs;

  const rawYRange =
    Math.max(
      1,
      rawMaxY -
      rawMinY
    );

  const yStep =
    getForecastChartYStep(
      rawYRange
    );

  const minY =
    Math.floor(
      rawMinY / yStep
    ) * yStep;

  const maxY =
    Math.ceil(
      rawMaxY / yStep
    ) * yStep;

  const xAt = (
    value
  ) =>
    margin.left +
    (
      (
        value -
        minX
      ) /
      (
        maxX -
        minX
      )
    ) *
    plotWidth;

  const yAt = (
    value
  ) =>
    margin.top +
    (
      1 -
      (
        value -
        minY
      ) /
      (
        maxY -
        minY
      )
    ) *
    plotHeight;

  const xTicks = [];

  for (
    let value = minX;
    value <= maxX;
    value +=
    config.dayStep * DAY
  ) {
    xTicks.push(value);
  }

  if (
    xTicks[
    xTicks.length - 1
    ] !== maxX
  ) {
    xTicks.push(maxX);
  }

  const yTicks =
    createNumericTicks(
      minY,
      maxY,
      yStep
    );

  const readingPath =
    snapshot.points
      .map(
        (point, index) =>
          `${index === 0
            ? 'M'
            : 'L'
          } ${xAt(
            point.x.getTime()
          )} ${yAt(
            point.y
          )}`
      )
      .join(' ');

  const daysBetween = (
    valueMs,
    anchorMs
  ) =>
    (
      valueMs -
      anchorMs
    ) /
    DAY;

  const beforeRegressionY =
    snapshot.beforeFirst.anchorY +
    snapshot.beforeFirst.slopePerDay *
    daysBetween(
      minX,
      snapshot.beforeFirst.anchorX.getTime()
    );

  const afterRegressionY =
    snapshot.afterLast.anchorY +
    snapshot.afterLast.slopePerDay *
    daysBetween(
      maxX,
      snapshot.afterLast.anchorX.getTime()
    );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[800px] w-full"
        role="img"
        aria-label="Maintenance forecast derivation"
      >
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="white"
        />

        <g
          transform={`translate(${margin.left} 12)`}
          fontSize={9}
          fill={
            FORECAST_CHART.colour.axis
          }
        >
          <g transform="translate(0 0)">
            <circle
              cx={4}
              cy={0}
              r={
                FORECAST_CHART.radius
                  .reading
              }
              fill={
                FORECAST_CHART.colour
                  .reading
              }
              opacity={
                FORECAST_CHART.opacity
                  .reading
              }
            />

            <text
              x={12}
              y={0}
              dominantBaseline="middle"
            >
              reading
            </text>
          </g>

          <g transform="translate(70 0)">
            <line
              x1={0}
              y1={0}
              x2={20}
              y2={0}
              stroke={
                FORECAST_CHART.colour
                  .interpolation
              }
              strokeWidth={
                FORECAST_CHART.line
                  .interpolationWidth
              }
            />

            <text
              x={26}
              y={0}
              dominantBaseline="middle"
            >
              interpolated usage
            </text>
          </g>

          <g transform="translate(225 0)">
            <line
              x1={0}
              y1={0}
              x2={20}
              y2={0}
              stroke={
                FORECAST_CHART.colour
                  .extrapolationAfter
              }
              strokeWidth={
                FORECAST_CHART.line
                  .extrapolationWidth
              }
              strokeDasharray={
                FORECAST_CHART.line
                  .dash
              }
            />

            <text
              x={26}
              y={0}
              dominantBaseline="middle"
            >
              extrapolated
            </text>
          </g>

          <g transform="translate(330 0)">
            <rect
              x={-4}
              y={-4}
              width={8}
              height={8}
              transform="rotate(45)"
              fill={
                FORECAST_CHART.colour
                  .completedCallFill
              }
              stroke={
                FORECAST_CHART.colour
                  .completedCallStroke
              }
            />

            <text
              x={12}
              y={0}
              dominantBaseline="middle"
            >
              completed call
            </text>
          </g>

          <g transform="translate(425 0)">
            <rect
              x={-4}
              y={-4}
              width={8}
              height={8}
              transform="rotate(45)"
              fill={
                FORECAST_CHART.colour
                  .baselineCallFill
              }
              stroke={
                FORECAST_CHART.colour
                  .baselineCallStroke
              }
            />

            <text
              x={12}
              y={0}
              dominantBaseline="middle"
            >
              baseline
            </text>
          </g>

          <g transform="translate(500 0)">
            <rect
              x={-4}
              y={-4}
              width={8}
              height={8}
              transform="rotate(45)"
              fill={
                FORECAST_CHART.colour
                  .forecastCallFill
              }
              stroke={
                FORECAST_CHART.colour
                  .forecastCallStroke
              }
            />

            <text
              x={12}
              y={0}
              dominantBaseline="middle"
            >
              forecast call
            </text>
          </g>
        </g>

        {yTicks.map(
          (value) => {
            const y =
              yAt(value);

            return (
              <React.Fragment
                key={`y-${value}`}
              >
                <line
                  x1={margin.left}
                  y1={y}
                  x2={
                    width -
                    margin.right
                  }
                  y2={y}
                  stroke={
                    FORECAST_CHART.colour
                      .grid
                  }
                  strokeWidth={
                    FORECAST_CHART.line
                      .gridWidth
                  }
                />

                <text
                  x={
                    margin.left -
                    8
                  }
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill={
                    FORECAST_CHART.colour
                      .axisText
                  }
                >
                  {Math.round(
                    value
                  )}
                </text>
              </React.Fragment>
            );
          }
        )}

        {xTicks.map(
          (value, index) => {
            const x =
              xAt(value);

            return (
              <React.Fragment
                key={`x-${value}`}
              >
                <line
                  x1={x}
                  y1={margin.top}
                  x2={x}
                  y2={
                    height -
                    margin.bottom
                  }
                  stroke={
                    FORECAST_CHART.colour
                      .minorGrid
                  }
                  strokeWidth={
                    FORECAST_CHART.line
                      .gridWidth
                  }
                />

                <text
                  x={x}
                  y={
                    height -
                    margin.bottom +
                    18
                  }
                  textAnchor="middle"
                  fontSize={10}
                  fill={
                    FORECAST_CHART.colour
                      .axisText
                  }
                >
                  {formatForecastChartDate(
                    value,
                    index === 0 ||
                    (
                      index > 0 &&
                      new Date(
                        value
                      ).getFullYear() !==
                      new Date(
                        xTicks[
                        index - 1
                        ]
                      ).getFullYear()
                    )
                  )}
                </text>
              </React.Fragment>
            );
          }
        )}

        <line
          x1={margin.left}
          y1={margin.top}
          x2={margin.left}
          y2={
            height -
            margin.bottom
          }
          stroke={
            FORECAST_CHART.colour
              .axis
          }
          strokeWidth={1}
        />

        <line
          x1={margin.left}
          y1={
            height -
            margin.bottom
          }
          x2={
            width -
            margin.right
          }
          y2={
            height -
            margin.bottom
          }
          stroke={
            FORECAST_CHART.colour
              .axis
          }
          strokeWidth={1}
        />

        <text
          x={16}
          y={
            margin.top +
            plotHeight / 2
          }
          transform={`rotate(-90 16 ${margin.top +
            plotHeight / 2
            })`}
          textAnchor="middle"
          fontSize={11}
          fill="#475569"
        >
          Cumulative usage (hrs)
        </text>

        <line
          x1={xAt(minX)}
          y1={yAt(
            beforeRegressionY
          )}
          x2={xAt(
            snapshot.beforeFirst.anchorX.getTime()
          )}
          y2={yAt(
            snapshot.beforeFirst.anchorY
          )}
          stroke={
            FORECAST_CHART.colour
              .extrapolationBefore
          }
          strokeWidth={
            FORECAST_CHART.line
              .extrapolationWidth
          }
          strokeDasharray={
            FORECAST_CHART.line
              .dash
          }
        />

        <path
          d={readingPath}
          fill="none"
          stroke={
            FORECAST_CHART.colour
              .interpolation
          }
          strokeWidth={
            FORECAST_CHART.line
              .interpolationWidth
          }
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line
          x1={xAt(
            snapshot.afterLast.anchorX.getTime()
          )}
          y1={yAt(
            snapshot.afterLast.anchorY
          )}
          x2={xAt(maxX)}
          y2={yAt(
            afterRegressionY
          )}
          stroke={
            FORECAST_CHART.colour
              .extrapolationAfter
          }
          strokeWidth={
            FORECAST_CHART.line
              .extrapolationWidth
          }
          strokeDasharray={
            FORECAST_CHART.line
              .dash
          }
        />

        {snapshot.points.map(
          (point, index) => (
            <circle
              key={`reading-${index}`}
              cx={xAt(
                point.x.getTime()
              )}
              cy={yAt(
                point.y
              )}
              r={
                FORECAST_CHART.radius
                  .reading
              }
              fill={
                FORECAST_CHART.colour
                  .reading
              }
              opacity={
                FORECAST_CHART.opacity
                  .reading
              }
            >
              <title>
                {`${formatFullDateTime(
                  point.x.getTime()
                )}\nUsage: ${formatResourceQuantity(
                  point.y
                )} hrs`}
              </title>
            </circle>
          )
        )}

        {callPoints.map(
          ({
            call,
            x,
            y,
          }) => {
            const selected =
              call.mpCall ===
              derivation.selectedCall;

            const baseline =
              call.id ===
              baselineCall?.id;

            const completed =
              call.isCompleted;

            const cx =
              xAt(x);

            const cy =
              yAt(y);

            const size =
              selected
                ? FORECAST_CHART
                  .callMarker
                  .selectedSize
                : baseline
                  ? FORECAST_CHART
                    .callMarker
                    .baselineSize
                  : FORECAST_CHART
                    .callMarker
                    .normalSize;

            const fill =
              selected
                ? FORECAST_CHART.colour
                  .selectedCallFill
                : baseline
                  ? FORECAST_CHART.colour
                    .baselineCallFill
                  : completed
                    ? FORECAST_CHART.colour
                      .completedCallFill
                    : FORECAST_CHART.colour
                      .forecastCallFill;

            const stroke =
              selected
                ? FORECAST_CHART.colour
                  .selectedCallStroke
                : baseline
                  ? FORECAST_CHART.colour
                    .baselineCallStroke
                  : completed
                    ? FORECAST_CHART.colour
                      .completedCallStroke
                    : FORECAST_CHART.colour
                      .forecastCallStroke;

            const strokeWidth =
              selected
                ? FORECAST_CHART
                  .callMarker
                  .selectedStrokeWidth
                : baseline
                  ? FORECAST_CHART
                    .callMarker
                    .baselineStrokeWidth
                  : FORECAST_CHART
                    .callMarker
                    .normalStrokeWidth;

            return (
              <g
                key={`call-${call.id}`}
              >
                {baseline && (
                  <>
                    <line
                      x1={margin.left}
                      y1={cy}
                      x2={cx}
                      y2={cy}
                      stroke={
                        FORECAST_CHART.colour
                          .baselineGuide
                      }
                      strokeDasharray={
                        FORECAST_CHART.line
                          .baselineGuideDash
                      }
                      strokeWidth={
                        FORECAST_CHART.line
                          .guideWidth
                      }
                    />

                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx}
                      y2={
                        height -
                        margin.bottom
                      }
                      stroke={
                        FORECAST_CHART.colour
                          .baselineGuide
                      }
                      strokeDasharray={
                        FORECAST_CHART.line
                          .baselineGuideDash
                      }
                      strokeWidth={
                        FORECAST_CHART.line
                          .guideWidth
                      }
                    />
                  </>
                )}

                {selected && (
                  <>
                    <line
                      x1={
                        margin.left
                      }
                      y1={cy}
                      x2={cx}
                      y2={cy}
                      stroke={
                        FORECAST_CHART.colour
                          .selectedGuide
                      }
                      strokeDasharray={
                        FORECAST_CHART.line
                          .guideDash
                      }
                      strokeWidth={
                        FORECAST_CHART.line
                          .guideWidth
                      }
                    />

                    <line
                      x1={cx}
                      y1={cy}
                      x2={cx}
                      y2={
                        height -
                        margin.bottom
                      }
                      stroke={
                        FORECAST_CHART.colour
                          .selectedGuide
                      }
                      strokeDasharray={
                        FORECAST_CHART.line
                          .guideDash
                      }
                      strokeWidth={
                        FORECAST_CHART.line
                          .guideWidth
                      }
                    />
                  </>
                )}

                <rect
                  x={
                    cx -
                    size / 2
                  }
                  y={
                    cy -
                    size / 2
                  }
                  width={size}
                  height={size}
                  transform={`rotate(45 ${cx} ${cy})`}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={
                    strokeWidth
                  }
                >
                  <title>
                    {[
                      `Call ${call.mpCall}`,
                      call.description,
                      completed
                        ? 'Completed'
                        : 'Forecast',
                      formatFullDateTime(
                        x
                      ),
                      `${formatResourceQuantity(
                        y
                      )} hrs`,
                    ].join('\n')}
                  </title>
                </rect>

                <text
                  x={cx}
                  y={cy - 11}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={
                    selected
                      ? 600
                      : 400
                  }
                  fill={stroke}
                >
                  {call.mpCall}
                </text>
              </g>
            );
          }
        )}

        {selectedPoint && (
          <>
            <text
              x={
                margin.left +
                FORECAST_CHART.label
                  .usageOffsetX
              }
              y={
                yAt(
                  selectedPoint.y
                ) -
                FORECAST_CHART.label
                  .usageOffsetY
              }
              textAnchor="start"
              fontSize={
                FORECAST_CHART.label
                  .fontSize
              }
              fontWeight={600}
              fill={
                FORECAST_CHART.colour
                  .selectedCallStroke
              }
            >
              {formatResourceQuantity(
                selectedPoint.y
              )}
            </text>

            <text
              x={
                xAt(
                  selectedPoint.x
                ) +
                FORECAST_CHART.label
                  .dateOffsetX
              }
              y={
                height -
                margin.bottom -
                FORECAST_CHART.label
                  .dateOffsetY
              }
              textAnchor="start"
              fontSize={
                FORECAST_CHART.label
                  .fontSize
              }
              fontWeight={600}
              fill={
                FORECAST_CHART.colour
                  .selectedCallStroke
              }
            >
              {formatFullDateTime(
                selectedPoint.x
              )}
            </text>

            {selectedPoint.call.workOrderId != null ? (
              <a
                href={`${SAP_ORDER_URL}${selectedPoint.call.workOrderId}`}
                target="_blank"
                rel="noreferrer"
              >
                <text
                  x={
                    xAt(
                      selectedPoint.x
                    ) +
                    FORECAST_CHART.label
                      .selectedDescriptionOffsetX
                  }
                  y={
                    yAt(
                      selectedPoint.y
                    ) -
                    4
                  }
                  textAnchor="start"
                  fontSize={
                    FORECAST_CHART.label
                      .descriptionFontSize
                  }
                  fontWeight={600}
                  fill={
                    FORECAST_CHART.colour
                      .selectedCallStroke
                  }
                  textDecoration="underline"
                  className="cursor-pointer"
                >
                  {`MO ${selectedPoint.call.workOrderId}`}
                </text>
              </a>
            ) : (
              <text
                x={
                  xAt(
                    selectedPoint.x
                  ) +
                  FORECAST_CHART.label
                    .selectedDescriptionOffsetX
                }
                y={
                  yAt(
                    selectedPoint.y
                  ) -
                  4
                }
                textAnchor="start"
                fontSize={
                  FORECAST_CHART.label
                    .descriptionFontSize
                }
                fontWeight={600}
                fill={
                  FORECAST_CHART.colour
                    .selectedCallStroke
                }
              >
                Forecast only
              </text>
            )}

            <text
              x={
                xAt(
                  selectedPoint.x
                ) +
                FORECAST_CHART.label
                  .selectedDescriptionOffsetX
              }
              y={
                yAt(
                  selectedPoint.y
                ) +
                9
              }
              textAnchor="start"
              fontSize={
                FORECAST_CHART.label
                  .descriptionFontSize
              }
              fill={
                FORECAST_CHART.colour
                  .selectedCallStroke
              }
            >
              {selectedPoint.call
                .orderDescription ??
                selectedPoint.call
                  .description}
            </text>
          </>
        )}

        {baselinePoint && (
          <>
            <text
              x={
                margin.left +
                FORECAST_CHART.label
                  .usageOffsetX
              }
              y={
                yAt(
                  baselinePoint.y
                ) +
                14
              }
              textAnchor="start"
              fontSize={
                FORECAST_CHART.label
                  .fontSize
              }
              fontWeight={600}
              fill={
                FORECAST_CHART.colour
                  .baselineCallStroke
              }
            >
              {formatResourceQuantity(
                baselinePoint.y
              )}
            </text>

            <text
              x={
                xAt(
                  baselinePoint.x
                ) -
                FORECAST_CHART.label
                  .dateOffsetX
              }
              y={
                height -
                margin.bottom -
                FORECAST_CHART.label
                  .dateOffsetY
              }
              textAnchor="end"
              fontSize={
                FORECAST_CHART.label
                  .fontSize
              }
              fontWeight={600}
              fill={
                FORECAST_CHART.colour
                  .baselineCallStroke
              }
            >
              {formatForecastChartDate(
                baselinePoint.x,
                true
              )}
            </text>
            {baselinePoint.call.workOrderId != null ? (
              <a
                href={`${SAP_ORDER_URL}${baselinePoint.call.workOrderId}`}
                target="_blank"
                rel="noreferrer"
              >
                <text
                  x={
                    xAt(
                      baselinePoint.x
                    ) -
                    FORECAST_CHART.label
                      .baselineDescriptionOffsetX
                  }
                  y={
                    yAt(
                      baselinePoint.y
                    ) -
                    4
                  }
                  textAnchor="end"
                  fontSize={
                    FORECAST_CHART.label
                      .descriptionFontSize
                  }
                  fontWeight={600}
                  fill={
                    FORECAST_CHART.colour
                      .baselineCallStroke
                  }
                  textDecoration="underline"
                  className="cursor-pointer"
                >
                  {`MO ${baselinePoint.call.workOrderId}`}
                </text>
              </a>
            ) : (
              <text
                x={
                  xAt(
                    baselinePoint.x
                  ) -
                  FORECAST_CHART.label
                    .baselineDescriptionOffsetX
                }
                y={
                  yAt(
                    baselinePoint.y
                  ) -
                  4
                }
                textAnchor="end"
                fontSize={
                  FORECAST_CHART.label
                    .descriptionFontSize
                }
                fontWeight={600}
                fill={
                  FORECAST_CHART.colour
                    .baselineCallStroke
                }
              >
                Completed call
              </text>
            )}

            <text
              x={
                xAt(
                  baselinePoint.x
                ) -
                FORECAST_CHART.label
                  .baselineDescriptionOffsetX
              }
              y={
                yAt(
                  baselinePoint.y
                ) +
                9
              }
              textAnchor="end"
              fontSize={
                FORECAST_CHART.label
                  .descriptionFontSize
              }
              fill={
                FORECAST_CHART.colour
                  .baselineCallStroke
              }
            >
              {baselinePoint.call
                .orderDescription ??
                baselinePoint.call
                  .description}
            </text>
          </>
        )}
      </svg>
    </div>
  );
}

function CollapsibleForecastSection({
  title,
  defaultOpen = true,
  children,
}) {
  const [
    open,
    setOpen,
  ] = React.useState(
    defaultOpen
  );

  return (
    <section className="mt-4 border border-slate-200">
      <button
        type="button"
        className="flex w-full items-center gap-1 border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
      >
        <ExpandIcon
          expanded={
            open
          }
        />

        {title}
      </button>

      {open && children}
    </section>
  );
}

function ForecastDerivationContent({
  derivation,
  item,
}) {
  const defaultConfig =
    React.useMemo(
      () =>
        getForecastChartDefaults(
          derivation
        ),
      [derivation]
    );

  const [
    chartConfig,
    setChartConfig,
  ] = React.useState(
    defaultConfig
  );

  React.useEffect(() => {
    setChartConfig(
      defaultConfig
    );
  }, [
    defaultConfig,
  ]);

  const selectedCall =
    derivation.calls.find(
      (call) =>
        call.mpCall ===
        derivation.selectedCall
    ) ?? null;

  const baselineCall =
    derivation.calls
      .filter(
        (call) =>
          call.isCompleted &&
          call.completedMs != null &&
          call.completionHours != null &&
          call.mpCall <
          derivation.selectedCall
      )
      .sort(
        (a, b) =>
          b.mpCall -
          a.mpCall
      )[0] ?? null;

  const isTimeBased =
    derivation.strategy
      ?.startsWith('T') ??
    false;

  return (
    <div className="min-h-0 overflow-auto p-4">
      {!isTimeBased && (
        <section className="mb-4 border border-slate-200 p-3">
          <div className="mb-2 text-xs font-semibold">
            Usage Forecast
          </div>

          <ForecastDerivationChartControls
            config={
              chartConfig
            }
            setConfig={
              setChartConfig
            }
            reset={() =>
              setChartConfig(
                defaultConfig
              )
            }
          />

          {chartConfig.endMs <=
            chartConfig.startMs ? (
            <div className="flex h-80 items-center justify-center text-xs text-red-700">
              Chart end must be after chart start.
            </div>
          ) : (
            <ForecastDerivationChart
              derivation={
                derivation
              }
              config={
                chartConfig
              }
              baselineCall={
                baselineCall
              }
            />
          )}
        </section>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="border border-slate-200 p-3">
          <h3 className="mb-2 text-xs font-semibold">
            Selected Forecast
          </h3>

          <dt className="text-slate-500">
            Maintenance plan
          </dt>

          <dd>
            <a
              href={`${SAP_MP_URL}${derivation.maintenancePlanId}`}
              target="_blank"
              rel="noreferrer"
              className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
            >
              {derivation.maintenancePlanId}
            </a>
          </dd>

          <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs">
            <dt className="text-slate-500">
              Description
            </dt>
            <dd>
              {selectedCall?.description ??
                item.description}
            </dd>

            <dt className="text-slate-500">
              Strategy
            </dt>
            <dd>
              {derivation.strategy ??
                '—'}
            </dd>

            <dt className="text-slate-500">
              Forecast date
            </dt>
            <dd>
              {selectedCall?.forecastMs != null
                ? formatFullDateTime(
                  selectedCall.forecastMs
                )
                : '—'}
            </dd>

            {!isTimeBased && (
              <>
                <dt className="text-slate-500">
                  Forecast usage
                </dt>
                <dd>
                  {selectedCall?.forecastHours != null
                    ? `${formatResourceQuantity(
                      selectedCall.forecastHours
                    )} hrs`
                    : '—'}
                </dd>

                <dt className="text-slate-500">
                  Baseline call
                </dt>
                <dd>
                  {baselineCall
                    ? `${baselineCall.mpCall} · ${formatFullDateTime(
                      baselineCall.completedMs
                    )} @${formatResourceQuantity(
                      baselineCall.completionHours
                    )} hrs`
                    : '—'}
                </dd>
              </>
            )}

            <dt className="text-slate-500">
              Source
            </dt>
            <dd>
              {selectedCall?.forecastSource ??
                '—'}
            </dd>

            <dt className="text-slate-500">
              Warning
            </dt>
            <dd>
              {selectedCall?.warningDetail ??
                selectedCall?.warning ??
                'None'}
            </dd>
          </dl>
        </section>

        {!isTimeBased && (
          <section className="border border-slate-200 p-3">
            <h3 className="mb-2 text-xs font-semibold">
              Predictor
            </h3>

            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1 text-xs">
              <dt className="text-slate-500">
                Counter
              </dt>
              <dd>
                {derivation.counter ??
                  '—'}
              </dd>

              <dt className="text-slate-500">
                Readings
              </dt>
              <dd>
                {derivation.predictorSnapshot
                  ?.points.length ?? 0}
              </dd>

              <dt className="text-slate-500">
                Direction
              </dt>
              <dd>
                {derivation.predictorSnapshot
                  ?.direction ?? '—'}
              </dd>

              <dt className="text-slate-500">
                Predictor error
              </dt>
              <dd>
                {derivation.predictorError ??
                  'None'}
              </dd>
            </dl>
          </section>
        )}
      </div>

      <CollapsibleForecastSection
        title="Maintenance Plan Calls"
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-2 py-1">
                  Call
                </th>
                <th className="px-2 py-1">
                  Work Order
                </th>
                <th className="px-2 py-1">
                  Description
                </th>
                <th className="px-2 py-1">
                  Status
                </th>
                <th className="px-2 py-1">
                  Completed
                </th>
                {!isTimeBased && (
                  <th className="px-2 py-1">
                    Completion Usage
                  </th>
                )}
                <th className="px-2 py-1">
                  Forecast
                </th>
                {!isTimeBased && (
                  <th className="px-2 py-1">
                    Forecast Usage
                  </th>
                )}
                <th className="px-2 py-1">
                  Source
                </th>
              </tr>
            </thead>

            <tbody>
              {derivation.calls.map(
                (call) => {
                  const selected =
                    call.mpCall ===
                    derivation.selectedCall;

                  const baseline =
                    call.id ===
                    baselineCall?.id;

                  return (
                    <tr
                      key={call.id}
                      className={
                        selected
                          ? 'bg-emerald-50 font-medium'
                          : baseline
                            ? 'bg-orange-50 font-medium'
                            : 'border-t border-slate-100'
                      }
                    >
                      <td className="px-2 py-1">
                        {call.mpCall}
                      </td>

                      <td className="px-2 py-1">
                        {call.workOrderId != null ? (
                          <a
                            href={`${SAP_ORDER_URL}${call.workOrderId}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-sky-700 hover:underline"
                          >
                            {call.workOrderId}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>

                      <td className="px-2 py-1">
                        {call.orderDescription ??
                          call.description}
                      </td>

                      <td className="px-2 py-1">
                        {selected
                          ? 'Selected'
                          : baseline
                            ? 'Baseline'
                            : call.isCompleted
                              ? 'Completed'
                              : 'Future'}
                      </td>

                      <td className="px-2 py-1">
                        {call.completedMs != null
                          ? formatFullDateTime(
                            call.completedMs
                          )
                          : '—'}
                      </td>

                      {!isTimeBased && (
                        <td className="px-2 py-1">
                          {call.completionHours != null
                            ? formatResourceQuantity(
                              call.completionHours
                            )
                            : '—'}
                        </td>
                      )}

                      <td className="px-2 py-1">
                        {call.forecastMs != null
                          ? formatFullDateTime(
                            call.forecastMs
                          )
                          : '—'}
                      </td>

                      {!isTimeBased && (
                        <td className="px-2 py-1">
                          {call.forecastHours != null
                            ? formatResourceQuantity(
                              call.forecastHours
                            )
                            : '—'}
                        </td>
                      )}

                      <td className="px-2 py-1">
                        {call.forecastSource ??
                          '—'}
                      </td>
                    </tr>
                  );
                }
              )}
            </tbody>
          </table>
        </div>
      </CollapsibleForecastSection>

      {!isTimeBased && (
        <>
          <CollapsibleForecastSection
            title={`Counter Readings (${derivation.readings.length})`}
            defaultOpen={false}
          >
            <div className="max-h-80 overflow-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th className="px-2 py-1">
                      Date
                    </th>

                    <th className="px-2 py-1 text-right">
                      Usage
                    </th>

                    <th className="px-2 py-1 text-right">
                      Reading
                    </th>

                    <th className="px-2 py-1 text-right">
                      Usage Change
                    </th>

                    <th className="px-2 py-1 text-right">
                      Reading Change
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {derivation.readings.map(
                    (
                      reading,
                      index
                    ) => {
                      const previous =
                        index === 0
                          ? null
                          : derivation.readings[
                          index - 1
                          ];

                      const usageChange =
                        previous == null
                          ? null
                          : reading.usage -
                          previous.usage;

                      const readingChange =
                        previous == null
                          ? null
                          : reading.reading -
                          previous.reading;

                      return (
                        <tr
                          key={`${reading.whenMs}-${index}`}
                          className="border-t border-slate-100"
                        >
                          <td className="whitespace-nowrap px-2 py-1">
                            {formatFullDateTime(
                              reading.whenMs
                            )}
                          </td>

                          <td className="px-2 py-1 text-right">
                            {formatResourceQuantity(
                              reading.usage
                            )}
                          </td>

                          <td className="px-2 py-1 text-right">
                            {formatResourceQuantity(
                              reading.reading
                            )}
                          </td>

                          <td className="px-2 py-1 text-right">
                            {usageChange == null
                              ? '—'
                              : formatSignedQuantity(
                                usageChange
                              )}
                          </td>

                          <td
                            className={
                              readingChange != null &&
                                readingChange < 0
                                ? 'px-2 py-1 text-right text-amber-700'
                                : 'px-2 py-1 text-right'
                            }
                            title={
                              readingChange != null &&
                                readingChange < 0
                                ? 'Physical meter reading decreased. This may indicate a meter reset.'
                                : undefined
                            }
                          >
                            {readingChange == null
                              ? '—'
                              : formatSignedQuantity(
                                readingChange
                              )}
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleForecastSection>
        </>
      )}
    </div>
  );
}

function ForecastDerivationModal({
  item,
  close,
}) {
  if (!item) {
    return null;
  }

  const derivation =
    deriveForecastExplanation(
      item
    );

  if (!derivation) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/40 p-6"
      onPointerDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          close();
        }
      }}
    >
      <div className="flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded border border-slate-300 bg-white shadow-xl">
        <header className="flex items-start justify-between border-b border-slate-300 px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">
              Forecast Derivation
            </h2>

            <div className="mt-1 text-xs text-slate-600">
              {derivation.asset}
              {' · '}
              Plan{' '}
              <a
                href={`${SAP_MP_URL}${derivation.maintenancePlanId}`}
                target="_blank"
                rel="noreferrer"
                className="text-sky-700 underline underline-offset-2 hover:text-sky-900"
                onClick={(event) =>
                  event.stopPropagation()
                }
              >
                {derivation.maintenancePlanId}
              </a>
              {' · '}
              Call {
                derivation.selectedCall
              }
            </div>

            {derivation.counter != null && (
              <div className="text-xs text-slate-600">
                Counter {
                  derivation.counter
                }
                {derivation.counterDescription
                  ? ` · ${derivation.counterDescription}`
                  : ''}
              </div>
            )}
          </div>

          <button
            className="px-2 py-1 text-sm text-slate-500 hover:text-slate-950"
            onClick={close}
          >
            ×
          </button>
        </header>

        <div className="min-h-0 overflow-auto p-4">
          <ForecastDerivationContent
            derivation={
              derivation
            }
            item={
              item
            }
          />
        </div>
      </div>
    </div>
  );
}

function getIsoWeekParts(
  when
) {
  const date =
    new Date(
      Date.UTC(
        when.getFullYear(),
        when.getMonth(),
        when.getDate()
      )
    );

  const day =
    date.getUTCDay() || 7;

  date.setUTCDate(
    date.getUTCDate() +
    4 -
    day
  );

  const isoYear =
    date.getUTCFullYear();

  const yearStart =
    new Date(
      Date.UTC(
        isoYear,
        0,
        1
      )
    );

  const isoWeek =
    Math.ceil(
      (
        (
          date.getTime() -
          yearStart.getTime()
        ) /
        DAY +
        1
      ) /
      7
    );

  return {
    isoYear,
    isoWeek,
  };
}

function getNextWeeklyStart({
  weekday,
  hour,
  minute,
  weekOffset = 0,
}) {
  const now =
    new Date();

  const start =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      hour,
      minute,
      0,
      0
    );

  const daysUntil =
    (
      weekday -
      start.getDay() +
      7
    ) %
    7;

  start.setDate(
    start.getDate() +
    daysUntil
  );

  if (
    start.getTime() <=
    now.getTime()
  ) {
    start.setDate(
      start.getDate() +
      7
    );
  }

  start.setDate(
    start.getDate() +
    weekOffset * 7
  );

  return start;
}

function getNextMonthlyStart() {
  const now =
    new Date();

  return new Date(
    now.getFullYear(),
    now.getMonth() + 1,
    1,
    6,
    0,
    0,
    0
  );
}

function getScheduleSiteTitle(
  locations
) {
  const selectedSites =
    sites.filter(
      (site) =>
        locations.has(
          site.loc
        )
    );

  if (
    selectedSites.length === 1
  ) {
    return selectedSites[0]
      .locName;
  }

  if (
    selectedSites.length > 1
  ) {
    return selectedSites
      .map(
        (site) =>
          site.loc
      )
      .join(' + ');
  }

  return '';
}

function getWeeklyScheduleTitle(
  locations,
  start
) {
  const {
    isoYear,
    isoWeek,
  } = getIsoWeekParts(
    start
  );

  const week =
    `${isoYear}-W${String(
      isoWeek
    ).padStart(
      2,
      '0'
    )}`;

  const siteTitle =
    getScheduleSiteTitle(
      locations
    );

  if (
    locations.size === 1
  ) {
    return `${siteTitle} Maintenance Schedule Week ${week}`;
  }

  if (
    locations.size > 1
  ) {
    return `${siteTitle} Maintenance Schedule ${week}`;
  }

  return `Maintenance Schedule Week ${week}`;
}

function getMonthlyScheduleTitle(
  locations,
  start
) {
  const year =
    start.getFullYear();

  const monthNumber =
    String(
      start.getMonth() + 1
    ).padStart(
      2,
      '0'
    );

  const monthName =
    start.toLocaleDateString(
      'en-AU',
      {
        month: 'long',
      }
    );

  const siteTitle =
    getScheduleSiteTitle(
      locations
    );

  const prefix =
    siteTitle.length > 0
      ? `${siteTitle} `
      : '';

  return `${prefix}Maintenance Schedule ${year}-${monthNumber} ${monthName} ${year}`;
}

function CreateScheduleDialog({
  open,
  selectedLocations,
  schedule,
  cancel,
  createSchedule,
  updateSchedule,
  requestDelete,
}) {
  const [
    title,
    setTitle,
  ] = React.useState('');
  const [
    locations,
    setLocations,
  ] = React.useState(
    new Set()
  );
  const [
    start,
    setStart,
  ] = React.useState(
    formatDateTimeInput(
      DEFAULT_TIMELINE_START
    )
  );
  const [
    end,
    setEnd,
  ] = React.useState(
    formatDateTimeInput(
      DEFAULT_TIMELINE_END
    )
  );

  React.useEffect(() => {
    if (!open) {
      return;
    }

    if (schedule != null) {
      setTitle(
        schedule.title
      );
      setLocations(
        new Set(
          schedule.locations
        )
      );
      setStart(
        formatDateTimeInput(
          schedule.startMs
        )
      );
      setEnd(
        formatDateTimeInput(
          schedule.endMs
        )
      );
      return;
    }

    setTitle('');
    setLocations(
      new Set(
        selectedLocations
      )
    );
    setStart(
      formatDateTimeInput(
        DEFAULT_TIMELINE_START
      )
    );
    setEnd(
      formatDateTimeInput(
        DEFAULT_TIMELINE_END
      )
    );
  }, [
    open,
    schedule,
    selectedLocations,
  ]);

  if (!open) {
    return null;
  }

  const toggleLocation = (
    location
  ) => {
    setLocations(
      (current) => {
        const next =
          new Set(current);

        if (
          next.has(location)
        ) {
          next.delete(
            location
          );
        } else {
          next.add(
            location
          );
        }

        return next;
      }
    );
  };

  const allLocationsSelected =
    sites.length > 0 &&
    sites.every(
      (site) =>
        locations.has(
          site.loc
        )
    );

  const someLocationsSelected =
    sites.some(
      (site) =>
        locations.has(
          site.loc
        )
    );

  const toggleAllLocations = () => {
    setLocations(
      allLocationsSelected ||
        someLocationsSelected
        ? new Set()
        : new Set(
          sites.map(
            (site) =>
              site.loc
          )
        )
    );
  };

  const startMs =
    new Date(start).getTime();

  const endMs =
    new Date(end).getTime();

  const canCreate =
    title.trim().length > 0 &&
    Number.isFinite(
      startMs
    ) &&
    Number.isFinite(
      endMs
    ) &&
    endMs > startMs;

  const submit = () => {
    if (!canCreate) {
      return;
    }

    const values = {
      title:
        title.trim(),
      locations:
        Array.from(
          locations
        ),
      startMs,
      endMs,
    };

    if (schedule != null) {
      updateSchedule(
        schedule.id,
        values
      );
      return;
    }

    createSchedule(
      values
    );
  };

  const buildWeeklyTemplate = ({
    weekday,
    hour,
    minute,
    weekOffset,
    label,
  }) => {
    const templateStart =
      getNextWeeklyStart({
        weekday,
        hour,
        minute,
        weekOffset,
      });

    const templateEnd =
      new Date(
        templateStart.getTime() +
        7 * DAY
      );

    return {
      label,
      start:
        templateStart,
      end:
        templateEnd,
      title:
        getWeeklyScheduleTitle(
          locations,
          templateStart
        ),
    };
  };

  const monthlyStart =
    getNextMonthlyStart();

  const monthlyEnd =
    new Date(
      monthlyStart.getFullYear(),
      monthlyStart.getMonth() + 1,
      1,
      monthlyStart.getHours(),
      monthlyStart.getMinutes(),
      0,
      0
    );

  const scheduleTemplates = [
    buildWeeklyTemplate({
      weekday: 1,
      hour: 6,
      minute: 0,
      weekOffset: 0,
      label:
        'Monday 06:00 · next week',
    }),
    buildWeeklyTemplate({
      weekday: 1,
      hour: 5,
      minute: 30,
      weekOffset: 0,
      label:
        'Monday 05:30 · next week',
    }),
    buildWeeklyTemplate({
      weekday: 4,
      hour: 6,
      minute: 0,
      weekOffset: 0,
      label:
        'Thursday 06:00 · next week',
    }),
    buildWeeklyTemplate({
      weekday: 4,
      hour: 5,
      minute: 30,
      weekOffset: 0,
      label:
        'Thursday 05:30 · next week',
    }),
    buildWeeklyTemplate({
      weekday: 1,
      hour: 6,
      minute: 0,
      weekOffset: 1,
      label:
        'Monday 06:00 · following week',
    }),
    buildWeeklyTemplate({
      weekday: 1,
      hour: 5,
      minute: 30,
      weekOffset: 1,
      label:
        'Monday 05:30 · following week',
    }),
    buildWeeklyTemplate({
      weekday: 4,
      hour: 6,
      minute: 0,
      weekOffset: 1,
      label:
        'Thursday 06:00 · following week',
    }),
    buildWeeklyTemplate({
      weekday: 4,
      hour: 5,
      minute: 30,
      weekOffset: 1,
      label:
        'Thursday 05:30 · following week',
    }),
    {
      label:
        'Monthly · next month',
      start:
        monthlyStart,
      end:
        monthlyEnd,
      title:
        getMonthlyScheduleTitle(
          locations,
          monthlyStart
        ),
    },
  ];

  const applyScheduleTemplate = (
    template
  ) => {
    setTitle(
      template.title
    );

    setStart(
      formatDateTimeInput(
        template.start.getTime()
      )
    );

    setEnd(
      formatDateTimeInput(
        template.end.getTime()
      )
    );
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-300 px-4 py-3 text-sm font-semibold">
          {schedule == null
            ? 'Create schedule'
            : 'Edit schedule'}
        </div>

        <div className="grid gap-4 p-4 text-xs">
          <div className="grid gap-2">
            <div className="font-semibold">
              Sites
            </div>

            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={
                  allLocationsSelected
                }
                ref={(input) => {
                  if (input) {
                    input.indeterminate =
                      someLocationsSelected &&
                      !allLocationsSelected;
                  }
                }}
                onChange={
                  toggleAllLocations
                }
              />
              <span className="font-semibold">
                Select all
              </span>
            </label>

            {sites.map(
              (site) => (
                <label
                  key={site.loc}
                  className="flex items-start gap-2"
                >
                  <input
                    type="checkbox"
                    checked={
                      locations.has(
                        site.loc
                      )
                    }
                    onChange={() =>
                      toggleLocation(
                        site.loc
                      )
                    }
                  />
                  <span>
                    <span className="font-semibold">
                      {site.loc}
                    </span>
                    <span className="ml-1 text-slate-500">
                      {site.locName}
                    </span>
                  </span>
                </label>
              )
            )}

            <div className="text-[10px] text-slate-500">
              No sites selected means
              the schedule applies to
              all sites.
            </div>

            <div className="grid gap-2">
              <div className="font-semibold">
                Templates
              </div>

              <div className="grid grid-cols-2 gap-1">
                {scheduleTemplates.map(
                  (template) => (
                    <button
                      key={
                        template.label
                      }
                      type="button"
                      className="border border-slate-300 bg-white px-2 py-1.5 text-left text-[11px] hover:bg-slate-50"
                      title={[
                        template.title,
                        '',
                        `Start: ${formatFullDateTime(
                          template.start.getTime()
                        )}`,
                        `End: ${formatFullDateTime(
                          template.end.getTime()
                        )}`,
                      ].join('\n')}
                      onClick={() =>
                        applyScheduleTemplate(
                          template
                        )
                      }
                    >
                      {template.label}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          <label className="grid gap-1">
            <span className="font-semibold">
              Title
            </span>
            <input
              type="text"
              className="border border-slate-300 px-2 py-1.5"
              value={title}
              onChange={(event) =>
                setTitle(
                  event.target.value
                )
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="font-semibold">
              Start
            </span>
            <input
              type="datetime-local"
              className="border border-slate-300 px-2 py-1.5"
              value={start}
              onChange={(event) =>
                setStart(
                  event.target.value
                )
              }
            />
          </label>

          <label className="grid gap-1">
            <span className="font-semibold">
              End
            </span>
            <input
              type="datetime-local"
              className="border border-slate-300 px-2 py-1.5"
              value={end}
              onChange={(event) =>
                setEnd(
                  event.target.value
                )
              }
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-slate-300 px-4 py-3">
          <div>
            {schedule != null && (
              <button
                type="button"
                className="border border-red-300 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
                onClick={() =>
                  requestDelete(
                    schedule.id
                  )
                }
              >
                Delete schedule
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="border border-slate-300 px-3 py-1.5 text-xs"
              onClick={cancel}
            >
              Cancel
            </button>

            <button
              type="button"
              className="bg-slate-900 px-3 py-1.5 text-xs text-white disabled:cursor-not-allowed disabled:bg-slate-300"
              disabled={!canCreate}
              onClick={submit}
            >
              {schedule == null
                ? 'Create'
                : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DeleteScheduleDialog({
  schedule,
  stoppageCount,
  confirm,
  cancel,
}) {
  if (!schedule) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-300 px-4 py-3 text-sm font-semibold">
          Delete schedule
        </div>

        <div className="grid gap-3 p-4 text-xs">
          <p>
            Delete “{schedule.title}”?
          </p>

          <p className="text-slate-600">
            {stoppageCount === 0
              ? 'No stoppages will be affected.'
              : `${stoppageCount} ${stoppageCount === 1
                ? 'stoppage'
                : 'stoppages'
              } will become unscheduled.`}
          </p>

          {stoppageCount > 0 && (
            <p className="text-slate-600">
              The stoppages and their
              allocated work will not
              be deleted.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-300 px-4 py-3">
          <button
            type="button"
            className="border border-slate-300 px-3 py-1.5 text-xs"
            onClick={cancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="bg-red-700 px-3 py-1.5 text-xs text-white hover:bg-red-800"
            onClick={confirm}
          >
            Delete schedule
          </button>
        </div>
      </div>
    </div>
  );
}

function DeleteStoppageDialog({
  row,
  releasedItemCount,
  confirm,
  cancel,
}) {
  if (!row) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-md border border-slate-300 bg-white shadow-xl">
        <div className="border-b border-slate-300 px-4 py-3 text-sm font-semibold">
          Delete stoppage
        </div>

        <div className="p-4 text-xs">
          <p>
            Delete “{row.description}”?
          </p>

          <p className="mt-2 text-slate-600">
            {releasedItemCount === 0
              ? 'No work items will be released.'
              : `${releasedItemCount} ${releasedItemCount === 1
                ? 'work item'
                : 'work items'
              } will be released.`}
          </p>

          {row.scheduleId != null && (
            <p className="mt-1 text-slate-600">
              The stoppage will also be removed from its schedule.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-300 px-4 py-3">
          <button
            type="button"
            className="border border-slate-300 px-3 py-1.5 text-xs"
            onClick={cancel}
          >
            Cancel
          </button>

          <button
            type="button"
            className="bg-red-700 px-3 py-1.5 text-xs text-white"
            onClick={confirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
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
    forecastDescriptions: true,
    resources: true,
    priorities: true,
    availability: true,
    descriptions: true,
  });
  const [
    schedules,
    setSchedules,
  ] = React.useState(
    () =>
      normaliseImportedSchedules()
  );
  const importedPlanningState =
    React.useMemo(
      () =>
        buildImportedPlanningState(
          workItems
        ),
      []
    );

  const [
    planningView,
    setPlanningView,
  ] = React.useState(
    'assets'
  );

  const [
    selectedLocations,
    setSelectedLocations,
  ] = React.useState(
    () =>
      new Set(
        sites.map(
          (site) =>
            site.loc
        )
      )
  );

  const [
    activeScheduleId,
    setActiveScheduleId,
  ] = React.useState(null);

  const [
    creatingSchedule,
    setCreatingSchedule,
  ] = React.useState(false);

  const [
    editingScheduleId,
    setEditingScheduleId,
  ] = React.useState(null);

  const editingSchedule =
    editingScheduleId == null
      ? null
      : schedules[
      editingScheduleId
      ] ?? null;

  const [
    deletingScheduleId,
    setDeletingScheduleId,
  ] = React.useState(null);

  const deletingSchedule =
    deletingScheduleId == null
      ? null
      : schedules[
      deletingScheduleId
      ] ?? null;

  const [
    planningNotice,
    setPlanningNotice,
  ] = React.useState(null);

  const [
    stoppages,
    setStoppages,
  ] = React.useState(
    () => ({
      ...importedPlanningState
        .stoppages,
      ...sampleStoppages,
    })
  );

  const [
    stoppageSchedule,
    setStoppageSchedule,
  ] = React.useState(
    () =>
      Object.fromEntries(
        Object.values(
          importedPlanningState
            .stoppages
        ).map(
          (stoppage) => [
            stoppage.id,
            stoppage.scheduleId ??
            null,
          ]
        )
      )
  );



  const createSchedule = ({
    title,
    locations,
    startMs,
    endMs,
  }) => {
    const id =
      `schedule-${Date.now()}`;

    setSchedules(
      (current) => ({
        ...current,
        [id]: {
          id,
          title,
          locations,
          startMs,
          endMs,
        },
      })
    );

    setActiveScheduleId(
      id
    );

    setCreatingSchedule(
      false
    );
  };

  const updateSchedule = (
    id,
    {
      title,
      locations,
      startMs,
      endMs,
    }
  ) => {
    setSchedules(
      (current) => {
        const schedule =
          current[id];

        if (schedule == null) {
          return current;
        }

        return {
          ...current,
          [id]: {
            ...schedule,
            title,
            locations,
            startMs,
            endMs,
          },
        };
      }
    );

    setEditingScheduleId(
      null
    );
  };

  const deleteSchedule = (
    scheduleId
  ) => {
    setSchedules(
      (current) => {
        if (
          current[
          scheduleId
          ] == null
        ) {
          return current;
        }

        const next = {
          ...current,
        };

        delete next[
          scheduleId
        ];

        return next;
      }
    );

    setStoppageSchedule(
      (current) =>
        Object.fromEntries(
          Object.entries(
            current
          ).map(
            ([
              stoppageId,
              assignedScheduleId,
            ]) => [
                stoppageId,
                assignedScheduleId ===
                  scheduleId
                  ? null
                  : assignedScheduleId,
              ]
          )
        )
    );

    setActiveScheduleId(
      (current) =>
        current ===
          scheduleId
          ? null
          : current
    );

    setEditingScheduleId(
      null
    );
  };

  const [
    allocation,
    setAllocation,
  ] = React.useState(
    () => ({
      ...importedPlanningState
        .allocation,
      ...sampleAllocation,
    })
  );

  const [schedule, setSchedule] = React.useState(sampleSchedule);
  const [expanded, setExpanded] = React.useState(sampleExpanded);
  const [expandedResources, setExpandedResources] = React.useState(
    sampleExpandedResources
  );

  const [editingStoppageId, setEditingStoppageId] =
    React.useState(null);

  const [
    pendingDeleteStoppage,
    setPendingDeleteStoppage,
  ] = React.useState(null);

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

  const toggleLocation = (
    location
  ) => {
    setSelectedLocations(
      (current) => {
        const next =
          new Set(current);

        if (next.has(location)) {
          next.delete(location);
        } else {
          next.add(location);
        }

        return next;
      }
    );
  };

  const allItems = applyState(
    allocation,
    schedule
  ).map((item) => ({
    ...item,

    location:
      getItemLocation(
        item
      ),

    ...calculateForecastStartAdvice(
      item
    ),
  }));

  const items =
    allItems.filter(
      (item) =>
        item.location != null &&
        selectedLocations.has(
          item.location
        )
    );

  const visibleStoppages =
    Object.fromEntries(
      Object.entries(
        stoppages
      ).filter(
        ([
          stoppageId,
          stoppage,
        ]) => {
          const location =
            stoppage.location ??
            allItems.find(
              (item) =>
                item.allocatedStoppageId ===
                stoppageId
            )?.location ??
            null;

          return (
            location != null &&
            selectedLocations.has(
              location
            )
          );
        }
      )
    );

  const itemById = Object.fromEntries(
    allItems.map((item) => [
      item.id,
      item,
    ])
  );

  const [
    forecastDerivationItem,
    setForecastDerivationItem,
  ] = React.useState(null);

  const [
    hoveredRowId,
    setHoveredRowId,
  ] = React.useState(null);

  const [
    hoveredActionGroupKey,
    setHoveredActionGroupKey,
  ] = React.useState(null);

  const [
    flashedRowIds,
    setFlashedRowIds,
  ] = React.useState(
    new Set()
  );

  const flashTimeoutsRef =
    React.useRef(
      new Map()
    );

  const flashRows = (
    rowIds
  ) => {
    const ids = [
      ...new Set(
        rowIds.filter(Boolean)
      ),
    ];

    if (ids.length === 0) {
      return;
    }

    setFlashedRowIds(
      (current) => {
        const next =
          new Set(current);

        for (const id of ids) {
          next.add(id);
        }

        return next;
      }
    );

    for (const id of ids) {
      const existingTimeout =
        flashTimeoutsRef.current.get(
          id
        );

      if (existingTimeout != null) {
        window.clearTimeout(
          existingTimeout
        );
      }

      const timeout =
        window.setTimeout(() => {
          setFlashedRowIds(
            (current) => {
              const next =
                new Set(current);

              next.delete(id);

              return next;
            }
          );

          flashTimeoutsRef.current.delete(
            id
          );
        }, 1200);

      flashTimeoutsRef.current.set(
        id,
        timeout
      );
    }
  };

  React.useEffect(() => {
    return () => {
      for (
        const timeout of
        flashTimeoutsRef.current.values()
      ) {
        window.clearTimeout(
          timeout
        );
      }
    };
  }, []);

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

  const effectiveStoppages =
    Object.fromEntries(
      Object.entries(
        visibleStoppages
      ).map(
        ([
          stoppageId,
          stoppage,
        ]) => [
            stoppageId,
            {
              ...stoppage,

              scheduleId:
                stoppageSchedule[
                stoppageId
                ] ?? null,
            },
          ]
      )
    );

  const assetRows =
    deriveAssetRows(
      items,
      effectiveStoppages,
      schedules,
      expanded,
      orders,
      timelineGeometry.startMs,
      timelineGeometry.endMs
    );

  const scheduleRows =
    deriveScheduleRows(
      items,
      effectiveStoppages,
      schedules,
      stoppageSchedule,
      expanded,
      orders,
      selectedLocations,
      timelineGeometry.startMs,
      timelineGeometry.endMs
    );

  const rows =
    planningView ===
      'schedules'
      ? scheduleRows
      : assetRows;

  const openForecastDerivation = (
    row
  ) => {
    if (
      row.maintenancePlanId == null ||
      row.maintenancePlanCall == null
    ) {
      return;
    }

    setForecastDerivationItem(
      row
    );
  };

  const scrollToTime = (
    targetMs
  ) => {
    const scroller =
      timeline.itemsRef.current;

    if (
      !scroller ||
      targetMs == null
    ) {
      return;
    }

    const targetPixel =
      (
        (targetMs -
          timelineRange.startMs) /
        HOUR
      ) *
      timelineRange.pixelsPerHour;

    const nextScrollLeft =
      targetPixel -
      scroller.clientWidth / 2;

    timeline.headerRef.current &&
      (
        timeline.headerRef.current.scrollLeft =
        nextScrollLeft
      );

    timeline.itemsRef.current &&
      (
        timeline.itemsRef.current.scrollLeft =
        nextScrollLeft
      );

    timeline.resourcesRef.current &&
      (
        timeline.resourcesRef.current.scrollLeft =
        nextScrollLeft
      );
  };

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
      event.button !== 0 ||
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

  const toggleExpanded = (
    id
  ) => {
    setExpanded((current) => ({
      ...current,
      [id]: !getExpanded(
        current,
        id
      ),
    }));
  };

  const focusCreatedStoppage = (
    assetId,
    stoppageId
  ) => {
    setExpanded((current) => {
      const next = {
        ...current,
      };

      for (
        const stoppage of
        Object.values(stoppages)
      ) {
        if (
          stoppage.asset === assetId
        ) {
          next[stoppage.id] =
            false;

          next[
            `${stoppage.id}-unallocated`
          ] = false;
        }
      }

      next[
        `${assetId}-unallocated`
      ] = false;

      next[
        `${assetId}-stoppage-reasons`
      ] = false;

      next[
        `asset-${assetId}`
      ] = true;

      next[stoppageId] = true;

      next[
        `${stoppageId}-unallocated`
      ] = true;

      return next;
    });
  };

  const getInitialScheduleForLocation = (
    location
  ) => {
    if (
      activeScheduleId == null
    ) {
      return null;
    }

    const activeSchedule =
      schedules[
      activeScheduleId
      ];

    if (
      !activeSchedule ||
      !scheduleAcceptsLocation(
        activeSchedule,
        location
      )
    ) {
      return null;
    }

    return activeScheduleId;
  };

  const createStoppage = ({
    stoppageId,
    asset,
    location,
    description,
  }) => {
    const initialScheduleId =
      getInitialScheduleForLocation(
        location
      );

    setStoppages(
      (current) => ({
        ...current,
        [stoppageId]: {
          id: stoppageId,
          asset,
          location,
          description,
          imported: false,
        },
      })
    );

    setStoppageSchedule(
      (current) => ({
        ...current,
        [stoppageId]:
          initialScheduleId,
      })
    );

    if (
      activeScheduleId != null &&
      initialScheduleId == null
    ) {
      const activeSchedule =
        schedules[
        activeScheduleId
        ];

      setPlanningNotice({
        type: 'warning',
        message:
          `Stoppage created without a schedule because "${activeSchedule?.title ?? activeScheduleId}" does not include ${location}.`,
      });
    }
  };

  const allocateWork = (row) => {
    if (row.type === 'asset') {
      const stoppageId =
        `stop-${crypto.randomUUID()}`;

      createStoppage({
        stoppageId,
        asset:
          row.asset,
        location:
          row.location,
        description:
          'Stoppage',
      });

      focusCreatedStoppage(
        row.asset,
        stoppageId
      );

      flashRows([
        stoppageId,
      ]);

      return;
    }

    if (
      row.type === 'assetUnallocated' ||
      row.type === 'topReason'
    ) {
      const stoppageId =
        `stop-${crypto.randomUUID()}`;

      const groupedItems =
        getGroupedWorkItems(
          row,
          items
        );

      createStoppage({
        stoppageId,
        asset:
          row.asset,
        location:
          row.location,
        description:
          row.description,
      });

      setAllocation((current) => {
        const next = {
          ...current,
        };

        for (
          const item of groupedItems
        ) {
          next[item.id] =
            stoppageId;
        }

        return next;
      });

      focusCreatedStoppage(
        row.asset,
        stoppageId
      );

      flashRows([
        stoppageId,
        ...groupedItems.map(
          (item) => item.id
        ),
      ]);

      return;
    }

    if (
      row.type === 'unallocated' &&
      row.stoppageId
    ) {
      const groupedItems =
        getGroupedWorkItems(
          row,
          items
        );

      setAllocation((current) => {
        const next = {
          ...current,
        };

        for (
          const item of groupedItems
        ) {
          next[item.id] =
            row.stoppageId;
        }

        return next;
      });

      flashRows(
        groupedItems.map(
          (item) => item.id
        )
      );
    }
  };

  const removeWork = (row) => {
    if (
      row.type !== 'allocated' ||
      !row.stoppageId
    ) {
      return;
    }

    const groupedItems =
      getGroupedWorkItems(
        row,
        items
      );

    setAllocation((current) => {
      const next = {
        ...current,
      };

      for (
        const item of groupedItems
      ) {
        next[item.id] = null;
      }

      return next;
    });

    flashRows(
      groupedItems.map(
        (item) => item.id
      )
    );
  };

  const addStoppageToActiveSchedule = (
    row
  ) => {
    if (
      row.type !== 'stoppage' ||
      activeScheduleId == null
    ) {
      return;
    }

    const activeSchedule =
      schedules[
      activeScheduleId
      ];

    if (!activeSchedule) {
      return;
    }

    if (
      !scheduleAcceptsLocation(
        activeSchedule,
        row.location
      )
    ) {
      setPlanningNotice({
        type: 'warning',
        message:
          `"${activeSchedule.title}" does not include ${row.location}. The stoppage was not moved.`,
      });

      return;
    }

    setStoppageSchedule(
      (current) => ({
        ...current,
        [row.id]:
          activeScheduleId,
      })
    );

    flashRows([
      row.id,
    ]);
  };

  const removeStoppageFromSchedule = (
    row
  ) => {
    if (
      row.type !== 'stoppage'
    ) {
      return;
    }

    setStoppageSchedule(
      (current) => ({
        ...current,
        [row.id]: null,
      })
    );

    flashRows([
      row.id,
    ]);
  };

  const deleteStoppage = (row) => {
    if (row.type !== 'stoppage') {
      return;
    }

    setPendingDeleteStoppage(
      row
    );
  };

  const confirmDeleteStoppage =
    () => {
      const row =
        pendingDeleteStoppage;

      if (
        !row ||
        row.type !== 'stoppage'
      ) {
        return;
      }

      const releasedItemIds =
        items
          .filter(
            (item) =>
              item.allocatedStoppageId ===
              row.id
          )
          .map(
            (item) => item.id
          );

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

      setStoppageSchedule(
        (current) => {
          const next = {
            ...current,
          };

          delete next[
            row.id
          ];

          return next;
        }
      );

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

      flashRows(
        releasedItemIds
      );

      setPendingDeleteStoppage(
        null
      );
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
      <ForecastDerivationModal
        item={
          forecastDerivationItem
        }
        close={() =>
          setForecastDerivationItem(
            null
          )
        }
      />

      <DeleteScheduleDialog
        schedule={
          deletingSchedule
        }
        stoppageCount={
          deletingSchedule == null
            ? 0
            : Object.values(
              stoppages
            ).filter(
              (stoppage) =>
                stoppageSchedule[
                stoppage.id
                ] ===
                deletingSchedule.id
            ).length
        }
        confirm={() => {
          if (
            deletingSchedule == null
          ) {
            return;
          }

          deleteSchedule(
            deletingSchedule.id
          );

          setDeletingScheduleId(
            null
          );
        }}
        cancel={() =>
          setDeletingScheduleId(
            null
          )
        }
      />

      <CreateScheduleDialog
        open={
          creatingSchedule ||
          editingSchedule != null
        }
        schedule={
          editingSchedule
        }

        selectedLocations={
          selectedLocations
        }
        cancel={() => {
          setCreatingSchedule(
            false
          );
          setEditingScheduleId(
            null
          );
        }}
        createSchedule={
          createSchedule
        }
        updateSchedule={
          updateSchedule
        }
        requestDelete={(
          scheduleId
        ) => {
          setEditingScheduleId(
            null
          );
          setDeletingScheduleId(
            scheduleId
          );
        }}
      />

      <DeleteStoppageDialog
        row={
          pendingDeleteStoppage
        }
        releasedItemCount={
          pendingDeleteStoppage
            ? allItems.filter(
              (item) =>
                item.allocatedStoppageId ===
                pendingDeleteStoppage.id
            ).length
            : 0
        }
        confirm={
          confirmDeleteStoppage
        }
        cancel={() =>
          setPendingDeleteStoppage(
            null
          )
        }
      />

      <header className="border-b border-slate-300 px-4 py-2">
        <h1 className="text-xl font-bold">Planning grid / stoppage mockup</h1>
        <p className="text-xs text-slate-700">
          Resource demand appears before each scheduled bar, with availability,
          description and priority shown after it.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            className={`border px-2 py-1 text-xs ${screen === 'planning' &&
              planningView === 'assets'
              ? 'bg-slate-900 text-white'
              : 'bg-white'
              }`}
            onClick={() => {
              setScreen(
                'planning'
              );

              setPlanningView(
                'assets'
              );
            }}
          >
            Planning Grid (Assets)
          </button>

          <button
            className={`border px-2 py-1 text-xs ${screen === 'planning' &&
              planningView === 'schedules'
              ? 'bg-slate-900 text-white'
              : 'bg-white'
              }`}
            onClick={() => {
              setScreen(
                'planning'
              );

              setPlanningView(
                'schedules'
              );
            }}
          >
            Planning Grid (Schedules)
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
              selectedLocations={
                selectedLocations
              }
              toggleLocation={
                toggleLocation
              }
              schedules={
                schedules
              }
              activeScheduleId={
                activeScheduleId
              }
              setActiveScheduleId={
                setActiveScheduleId
              }
              setCreatingSchedule={
                setCreatingSchedule
              }
              setEditingScheduleId={
                setEditingScheduleId
              }
            />

            <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
              {planningNotice && (
                <div
                  className={
                    planningNotice.type ===
                      'warning'
                      ? 'flex items-center justify-between border-b border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900'
                      : 'flex items-center justify-between border-b border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-900'
                  }
                >
                  <span>
                    {planningNotice.message}
                  </span>

                  <button
                    type="button"
                    className="ml-3 shrink-0"
                    aria-label="Dismiss message"
                    onClick={() =>
                      setPlanningNotice(
                        null
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              )}

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
                  stoppages={
                    stoppages
                  }
                  stoppageSchedule={
                    stoppageSchedule
                  }
                  schedules={
                    schedules
                  }
                  activeScheduleId={
                    activeScheduleId
                  }
                  addStoppageToActiveSchedule={
                    addStoppageToActiveSchedule
                  }
                  removeStoppageFromSchedule={
                    removeStoppageFromSchedule
                  }
                  openForecastDerivation={
                    openForecastDerivation
                  }
                  hoveredRowId={
                    hoveredRowId
                  }
                  setHoveredRowId={
                    setHoveredRowId
                  }
                  flashedRowIds={
                    flashedRowIds
                  }
                  hoveredActionGroupKey={
                    hoveredActionGroupKey
                  }
                  setHoveredActionGroupKey={
                    setHoveredActionGroupKey
                  }
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
                  scrollToTime={
                    scrollToTime
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
