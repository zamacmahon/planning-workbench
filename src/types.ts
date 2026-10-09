export interface AssetDefinition {
  id: string;
  description: string;
}

export type DateTimeMs = number;

export type Priority = 1 | 2 | 3 | 4;

export type Availability = 1 | 2 | 3;

export type StoppageId = string;

export interface PriorityDefinition {
  label: string;
  colour: string;
}

/**
 * Work item as received from the imported source.
 *
 * This type contains no app-specific allocation or scheduling state.
 */
export interface RawWorkItem {
  /**
   * Stable identifier for the order and operation combination.
   *
   * Example:
   * "4123456-0010"
   */
  id: string;

  /**
   * Short operation description.
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
   * Planning priority from the imported source.
   */
  priority: Priority;

  /**
   * Material availability from the imported source.
   */
  availability: Availability;

  /**
   * Imported baseline start date and time.
   *
   * Every imported work item has a baseline start.
   * App-specific scheduling may override this value.
   */
  startMs: DateTimeMs;

  /**
   * Imported planned operation duration.
   */
  durationMinutes: number;

  /**
   * Imported forecast date and time.
   *
   * Null means no forecast is available.
   */
  forecastMs: DateTimeMs | null;

  /**
   * Whether the operation can justify creating a stoppage.
   */
  isStoppageReason: boolean;

  /**
   * SAP maintenance order number.
   *
   * Null means no maintenance order exists.
   */
  workOrderId: string | null;

  /**
   * SAP operation number.
   *
   * Null means no operation number exists.
   */
  operationId: string | null;

  /**
   * Resource-demand expression.
   *
   * Examples:
   * "2x HDF"
   * "2x HDF, 1x AUT"
   */
  resourceDemand: string;

  /**
   * Tailwind classes used to style the scheduled Gantt bar.
   */
  barClass?: string;
}

/**
 * App-specific state applied to a raw work item.
 */
export interface WorkItemPlanningState {
  /**
   * Stoppage to which the operation is allocated.
   *
   * Null means the operation is not allocated.
   */
  allocatedStoppageId: StoppageId | null;
}

/**
 * Effective work item used by the application after raw imported data and
 * app-specific planning state have been merged.
 */
export interface WorkItem
  extends RawWorkItem,
  WorkItemPlanningState { }

export interface ResourceDefinition {
  code: string;
  label: string;
  capacity: number;
  colour: string;
}

export interface ResourceDemand {
  code: string;
  count: number;
}

export interface ResourceContributor {
  id: string;
  count: number;
}

export interface ResourceInterval {
  startMs: DateTimeMs;
  endMs: DateTimeMs;
  count: number;
  contributors: ResourceContributor[];
}

export interface ResourceSeries
  extends ResourceDefinition {
  intervals: ResourceInterval[];
}

export interface ForecastMarker {
  id: string;
  forecastMs: DateTimeMs;
  workOrderId: string | null;
  description: string | null;
  isStoppageReason: boolean;
}

export interface StoppageSummary {
  id: StoppageId;
  asset: string;
  description: string;
  startMs: DateTimeMs;
  durationMinutes: number;
  priority: Priority | null;
  availability: Availability | null;
  resourceDemand: string;
}

export type PlanningRowType =
  | 'asset'
  | 'stoppage'
  | 'allocated'
  | 'unallocatedHeader'
  | 'unallocated'
  | 'topReason';

export interface PlanningRow extends Partial<WorkItem> {
  id: string;
  rowKey: string;
  type: PlanningRowType;
  level: number;
  hasChildren?: boolean;
  description: string;
  asset: string;
  forecastMarkers?: ForecastMarker[];
  stoppageSummaries?: StoppageSummary[];
  orderKey?: string;
  stoppageId?: StoppageId;
}

export interface OverlayState {
  forecasts: boolean;
  resources: boolean;
  priorities: boolean;
  availability: boolean;
  descriptions: boolean;
}

/**
 * Allocation overrides keyed by work-item ID.
 */
export type AllocationState = Record<
  string,
  StoppageId | null
>;

/**
 * Schedule offsets keyed by work-item ID.
 *
 * Each value is the difference in milliseconds from the imported or
 * baseline start time.
 */
export type ScheduleOffsetState = Record<
  string,
  number
>;

export type ExpandedState = Record<
  string,
  boolean
>;

/**
 * Explicit row order keyed by planning section.
 *
 * Example keys:
 * "allocated:stop-123"
 * "unallocated:stop-123"
 * "topLevel:TD6310"
 */
export type SectionOrderState = Record<string, string[]>;

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

export interface TimelineTick {
  value: DateTimeMs;
  label: string;
}

export interface StartUpdate {
  id: string;
  startMs: DateTimeMs;
}

export interface Stoppage {
  id: StoppageId;
  asset: string;
  description: string;
}

export type StoppageState = Record<StoppageId, Stoppage>;
