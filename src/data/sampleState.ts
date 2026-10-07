import type {
  AllocationState,
  DateTimeMs,
  ExpandedState,
  SectionOrderState,
  StoppageId,
} from '../types';

export interface ScheduleEntry {
  startMs: DateTimeMs;
}

export type ScheduleState = Record<string, ScheduleEntry>;

export type CandidateState = Record<string, StoppageId | null>;

export const sampleAllocation: AllocationState = {};

export const sampleSchedule: ScheduleState = {};

export const sampleCandidates: CandidateState = {};

export const sampleExpanded: ExpandedState = {};

export const sampleExpandedResources: ExpandedState = {
  HDF: true,
  AUT: false,
  BLM: false,
  TYR: false,
};

export const sampleOrders: SectionOrderState = {
  allocated: [],
  unallocated: [],
  topLevel: [],
};
