import type {
  AllocationState,
  DateTimeMs,
  ExpandedState,
  SectionOrderState,
  StoppageState,
} from '../types';

export interface ScheduleEntry {
  startMs: DateTimeMs;
}

export type ScheduleState = Record<string, ScheduleEntry>;

export const sampleStoppages: StoppageState = {};

export const sampleAllocation: AllocationState = {};

export const sampleSchedule: ScheduleState = {};

export const sampleExpanded: ExpandedState = {};

export const sampleExpandedResources: ExpandedState = {
  HDF: true,
  AUT: false,
  BLM: false,
  TYR: false,
};

export const sampleOrders: SectionOrderState = {};
