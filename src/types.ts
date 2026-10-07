export interface AssetDefinition {
  id: string;
  description: string;
}

/**
 * Millisecond timestamp representing an absolute date and time.
 *
 * Example:
 * Date.parse("2026-06-30T05:00:00+08:00")
 */
export type DateTimeMs = number;

/**
 * Work priority used by planning items.
 *
 * 1 = Very High
 * 2 = High
 * 3 = Medium
 * 4 = Low
 */
export type Priority = 1 | 2 | 3 | 4;

/**
 * Identifier for a planner-created stoppage.
 *
 * Example:
 * "stop-1"
 */
export type StoppageId = string;

/**
 * Visual and descriptive configuration for a priority.
 *
 * Example:
 * {
 *   label: "Very High",
 *   colour: "#dc2626"
 * }
 */
 export interface PriorityDefinition {
  /** Human-readable priority name. */
  label: string;

  /** CSS-compatible colour value used by the priority marker. */
  colour: string;
}

/**
 * A source work item supplied to the planning application.
 *
 * A work item may represent:
 * - an SAP maintenance order;
 * - a forecast task without a maintenance order; or
 * - a planner-created stoppage reason.
 *
 * Example:
 * {
 *   id: "4123456",
 *   description: "250H PM SERVICE",
 *   asset: "TD6310",
 *   priority: 2,
 *   startMs: Date.parse("2026-06-30T05:00:00+08:00"),
 *   durationMinutes: 390,
 *   forecastMs: Date.parse("2026-06-30T12:30:00+08:00"),
 *   isStoppageReason: true,
 *   workOrderId: "4123456",
 *   resourceDemand: "2x HDF",
 *   allocatedStoppageId: "stop-1",
 *   visibleInUnallocatedFor: "stop-1",
 *   barClass: "bg-green-600 text-white"
 * }
 */
 export interface WorkItem {
  /**
   * Stable application identifier.
   *
   * The value does not have to be an SAP maintenance order number.
   *
   * Examples:
   * "4123456-0010"
   * "forecast-task"
   * "planner-reason"
   */
  id: string;

  /**
   * Short work description.
   *
   * Example:
   * "250H PM SERVICE"
   */
  description: string;

  /**
   * Asset identifier.
   *
   * Example:
   * "TD6310"
   */
  asset: string;

  /**
   * Planning priority.
   *
   * Example:
   * 2
   */
  priority: Priority;

  /**
   * Scheduled start date and time.
   *
   * Null means the item has not been scheduled.
   * Scheduled values are snapped to 15-minute boundaries.
   */
  startMs: DateTimeMs | null;

  /**
   * Scheduled duration in whole minutes.
   *
   * Null means the item does not yet have a scheduled duration.
   *
   * Example:
   * 390
   */
  durationMinutes: number | null;

  /**
   * Forecast date and time.
   *
   * Null means no forecast is available.
   *
   * A forecast may exist without a work order or scheduled start.
   */
  forecastMs: DateTimeMs | null;

  /**
   * Whether the item can cause or justify a stoppage.
   *
   * Examples:
   * - service work: true;
   * - seat replacement: false;
   * - planner-created stoppage reason: true.
   */
  isStoppageReason: boolean;

  /**
   * SAP maintenance order number.
   *
   * Null means the item is not associated with a maintenance order.
   *
   * Example:
   * "4123456"
   */
  workOrderId: string | null;

  operationId: string | null;

  /**
   * Resource-demand expression.
   *
   * Multiple demands may be separated by commas or semicolons.
   *
   * Examples:
   * "2x HDF"
   * "2x HDF, 1x AUT"
   * ""
   */
  resourceDemand: string;

  /**
   * Stoppage to which the item is currently allocated.
   *
   * Null means the item is not allocated to a stoppage.
   *
   * Example:
   * "stop-1"
   */
  allocatedStoppageId: StoppageId | null;

  /**
   * Stoppage under which this item may appear in Unallocated Work.
   *
   * Null means the item is not associated with an unallocated-work
   * group.
   *
   * Example:
   * "stop-1"
   */
  visibleInUnallocatedFor: StoppageId | null;

  /**
   * Tailwind classes used to style the scheduled Gantt bar.
   *
   * Example:
   * "bg-green-600 text-white"
   */
  barClass?: string;
}

/**
 * Available resource export type and its capacity.
 *
 * Example:
 * {
 *   code: "HDF",
 *   label: "M001-HDF HD Fitter",
 *   capacity: 4,
 *   colour: "#155e75"
 * }
 */
 export interface ResourceDefinition {
  /**
   * Short resource code used in work-item demand expressions.
   *
   * Example:
   * "HDF"
   */
  code: string;

  /**
   * Human-readable resource description.
   *
   * Example:
   * "M001-HDF HD Fitter"
   */
  label: string;

  /**
   * Number of resource units available concurrently.
   *
   * Example:
   * 4
   */
  capacity: number;

  /**
   * CSS-compatible colour used by the resource graph.
   *
   * Example:
   * "#155e75"
   */
  colour: string;
}

/**
 * One parsed resource demand from a work item.
 *
 * Example:
 * {
 *   code: "HDF",
 *   count: 2
 * }
 */
 export interface ResourceDemand {
  /** Resource code matched against ResourceDefinition.code. */
  code: string;

  /** Number of units required concurrently. */
  count: number;
}

/**
 * Contribution made by one work item to a calculated resource interval.
 *
 * Example:
 * {
 *   id: "4123456",
 *   count: 2
 * }
 */
 export interface ResourceContributor {
  /** Work-item identifier. */
  id: string;

  /** Resource units contributed by this work item. */
  count: number;
}

/**
 * Resource demand calculated between two consecutive time markers.
 *
 * Time markers are generated from all allocated work-item start and
 * finish times, then deduplicated and sorted.
 *
 * Example:
 * {
 *   startMs: Date.parse("2026-06-30T08:00:00+08:00"),
 *   endMs: Date.parse("2026-06-30T11:30:00+08:00"),
 *   count: 4,
 *   contributors: [
 *     { id: "4123456", count: 2 },
 *     { id: "4991234", count: 2 }
 *   ]
 * }
 */
 export interface ResourceInterval {
  /** Inclusive interval start. */
  startMs: DateTimeMs;

  /** Exclusive interval end. */
  endMs: DateTimeMs;

  /** Total concurrent demand during the interval. */
  count: number;

  /** Work items contributing to the interval demand. */
  contributors: ResourceContributor[];
}

/**
 * Resource definition combined with its calculated demand intervals.
 */
 export interface ResourceSeries extends ResourceDefinition {
  /** Non-zero demand intervals for this resource. */
  intervals: ResourceInterval[];
}

/**
 * Row types rendered by the left table and Gantt.
 */
 export type PlanningRowType =
 | 'asset'
 | 'stoppage'
 | 'allocated'
 | 'unallocatedHeader'
 | 'unallocated'
 | 'topReason';

/**
 * Derived row rendered by the planning table and Gantt.
 *
 * Work-item rows inherit their data from WorkItem. Stoppage summary
 * rows and group headers are created by deriveRows().
 */
 export interface PlanningRow extends Partial<WorkItem> {
  /** Identifier shared with the source item or stoppage. */
  id: string;

  /**
   * Unique identifier for this rendered row instance.
   *
   * The same source item may be rendered in more than one location.
   *
   * Examples:
   * "allocated-4123456"
   * "unallocated-4776628"
   * "top-planner-reason"
   */
  rowKey: string;

  /** Role of this row in the rendered hierarchy. */
  export type: PlanningRowType;

  /**
   * Visual indentation level.
   *
   * 0 = top level
   * 1 = inside stoppage
   * 2 = inside Unallocated Work
   */
  level: number;

  /** Whether the row controls visibility of child rows. */
  hasChildren?: boolean;

  /** Display description. */
  description: string;

  /** Asset identifier. */
  asset: string;

  /**
   * Forecast markers rendered on a stoppage summary.
   *
   * Each value comes from an allocated stoppage-reason work item.
   */
  forecastMarkers?: DateTimeMs[];
}

/**
 * Visibility state for optional Gantt overlays.
 *
 * Example:
 * {
 *   forecasts: true,
 *   resources: true,
 *   priorities: true,
 *   descriptions: true
 * }
 */
export interface OverlayState {
  /** Show forecast markers and variance lines. */
  forecasts: boolean;

  /** Show resource-demand text beside scheduled bars. */
  resources: boolean;

  /** Show priority circles beside work-order labels. */
  priorities: boolean;

  /** Show work-order labels below scheduled bars. */
  descriptions: boolean;
}

/**
 * Runtime allocation overrides keyed by work-item ID.
 *
 * Example:
 * {
 *   "4776628": "stop-1",
 *   "4123456": null
 * }
 *
 * A null value explicitly removes an item from a stoppage.
 */
export type AllocationState = Record<string, StoppageId | null>;

/**
 * Schedule offsets keyed by work-item ID.
 *
 * Each value is a millisecond difference from the source start time.
 *
 * Example:
 * {
 *   "4123456": 900000
 * }
 *
 * 900000 milliseconds represents a 15-minute movement.
 */
export type ScheduleOffsetState = Record<string, number>;

/**
 * Expanded/collapsed state keyed by stoppage, group or resource ID.
 *
 * Example:
 * {
 *   "stop-1": true,
 *   "stop-1-unallocated": true
 * }
 */
export type ExpandedState = Record<string, boolean>;

/**
 * Explicit work-item display order within each planning section.
 */
export interface SectionOrderState {
  /** Work allocated to the stoppage. */
  allocated: string[];

  /** Work displayed under Unallocated Work. */
  unallocated: string[];

  /** Unallocated stoppage reasons displayed at the top level. */
  topLevel: string[];
}

/**
 * Current width of each resizable table column, in pixels.
 *
 * Column order:
 * 0 Description
 * 1 Action
 * 2 Asset
 * 3 Priority
 * 4 Start
 * 5 End
 * 6 Forecast
 * 7 Resources
 */
export type ColumnWidths = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number
];

/**
 * One date-time marker displayed by the Gantt timeline.
 */
export interface TimelineTick {
  /** Marker timestamp. */
  value: DateTimeMs;

  /** Formatted marker label. */
  label: string;
}

/**
 * Proposed schedule update for one work item.
 */
export interface StartUpdate {
  /** Work-item identifier. */
  id: string;

  /** Requested absolute start time before clamping. */
  startMs: DateTimeMs;
}
