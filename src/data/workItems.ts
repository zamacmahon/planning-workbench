import { Predictor } from '../lib/predictor';
import { counters } from './counters';
import { readings } from './readings';
import { rawWorkItems } from './rawWorkItems';

type ForecastSource =
  | 'planned'
  | 'usage';

type ForecastWarning =
  | 'missing-baseline'
  | 'missing-frequency'
  | 'missing-counter'
  | 'predictor-error';

interface ForecastResult {
  forecastMs: number | null;
  forecastHours: number | null;
  source: ForecastSource;
  warning: ForecastWarning | null;
  warningDetail: string | null;
}

const predictorByCounter =
  new Map();

const predictorErrorByCounter =
  new Map();

for (const counter of counters) {
  const counterReadings =
    readings
      .filter(
        (reading) =>
          reading.counter ===
          counter.counter
      )
      .map((reading) => ({
        x: reading.when,
        y: reading.usage,
      }));

  try {
    predictorByCounter.set(
      counter.counter,
      new Predictor(
        counterReadings
      )
    );
  } catch (error) {
    predictorErrorByCounter.set(
      counter.counter,
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}

function getPlanCallKey(
  source
) {
  return `${source.mp}:${source.mpCall}`;
}

function plannedForecast(
  source,
  warning = null,
  warningDetail = null
): ForecastResult {
  return {
    forecastMs:
      source.planned == null
        ? null
        : Date.parse(
          source.planned
        ),
    forecastHours: null,
    source: 'planned',
    warning,
    warningDetail,
  };
}

const planCalls =
  rawWorkItems.filter(
    (source) =>
      source.mp != null &&
      source.mpCall != null &&
      source.mpCall <
      90_000_000
  );


const planCallsByMaintenancePlan =
  new Map();

for (const source of planCalls) {
  let callsByNumber =
    planCallsByMaintenancePlan.get(
      source.mp
    );

  if (!callsByNumber) {
    callsByNumber =
      new Map();

    planCallsByMaintenancePlan.set(
      source.mp,
      callsByNumber
    );
  }

  const existing =
    callsByNumber.get(
      source.mpCall
    );

  if (
    !existing ||
    (
      source.isCompleted &&
      !existing.isCompleted
    )
  ) {
    callsByNumber.set(
      source.mpCall,
      source
    );
  }
}

const orderedPlanCallsByMaintenancePlan =
  new Map(
    [
      ...planCallsByMaintenancePlan
        .entries(),
    ].map(
      ([
        maintenancePlanId,
        callsByNumber,
      ]) => [
          maintenancePlanId,
          [
            ...callsByNumber.values(),
          ].sort(
            (a, b) =>
              a.mpCall -
              b.mpCall
          ),
        ]
    )
  );

const forecastByPlanCall =
  new Map();

for (
  const [
    maintenancePlanId,
    calls,
  ] of
  orderedPlanCallsByMaintenancePlan
) {
  if (calls.length === 0) {
    continue;
  }

  const strategy =
    planCalls.find(
      (call) =>
        call.mp ===
        maintenancePlanId &&
        call.strat != null
    )?.strat ?? null;

  const isPerformanceBased =
    strategy?.startsWith(
      'P'
    ) ?? false;

  if (!isPerformanceBased) {
    for (const call of calls) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        plannedForecast(call)
      );
    }

    continue;
  }

  const completedCalls =
    calls.filter(
      (call) =>
        call.isCompleted &&
        call.completed != null
    );

  const baselineCall =
    completedCalls.length > 0
      ? completedCalls[
      completedCalls.length - 1
      ]
      : calls.find(
        (call) =>
          !call.isCompleted
      ) ?? null;

  if (!baselineCall) {
    continue;
  }

  const futureCalls =
    calls.filter(
      (call) =>
        !call.isCompleted &&
        call.mpCall >=
        baselineCall.mpCall
    );

  if (futureCalls.length === 0) {
    continue;
  }

  const counter =
    baselineCall.counter ??
    futureCalls.find(
      (call) =>
        call.counter != null
    )?.counter ??
    null;

  if (counter == null) {
    for (const call of futureCalls) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        plannedForecast(
          call,
          'missing-counter',
          `Maintenance plan ${maintenancePlanId} has no counter.`
        )
      );
    }

    continue;
  }

  const predictor =
    predictorByCounter.get(
      counter
    );

  const predictorError =
    predictorErrorByCounter.get(
      counter
    );

  if (!predictor) {
    for (const call of futureCalls) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        plannedForecast(
          call,
          'predictor-error',
          predictorError ??
          `Counter ${counter} has no usable predictor.`
        )
      );
    }

    continue;
  }

  const hasCompletedBaseline =
    baselineCall.isCompleted &&
    baselineCall.completed != null;

  const baselineDate =
    hasCompletedBaseline
      ? baselineCall.completed
      : baselineCall.planned;

  if (baselineDate == null) {
    for (const call of futureCalls) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        plannedForecast(
          call,
          'missing-baseline',
          `Maintenance plan ${maintenancePlanId} has no completed or planned baseline date.`
        )
      );
    }

    continue;
  }

  let forecastHours;

  try {
    forecastHours =
      predictor.predictY(
        baselineDate
      );
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : String(error);

    for (const call of futureCalls) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        plannedForecast(
          call,
          'predictor-error',
          detail
        )
      );
    }

    continue;
  }

  let firstFutureCall = true;

  for (const call of futureCalls) {
    if (
      !hasCompletedBaseline &&
      firstFutureCall
    ) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        {
          forecastMs:
            call.planned == null
              ? null
              : Date.parse(
                call.planned
              ),
          forecastHours,
          source: 'planned',
          warning:
            'missing-baseline',
          warningDetail:
            `Maintenance plan ${maintenancePlanId} has no completed baseline. The first available open call is treated as completed on its planned date.`,
        }
      );

      firstFutureCall = false;
      continue;
    }

    firstFutureCall = false;

    if (
      call.mpFreq == null ||
      !Number.isFinite(
        call.mpFreq
      ) ||
      call.mpFreq <= 0
    ) {
      const fallback =
        plannedForecast(
          call,
          'missing-frequency',
          `Maintenance plan ${maintenancePlanId}, call ${call.mpCall} has no valid mpFreq.`
        );

      if (call.planned != null) {
        try {
          forecastHours =
            predictor.predictY(
              call.planned
            );

          fallback.forecastHours =
            forecastHours;
        } catch {
          // Keep the previous forecast-hours
          // baseline and planned-date fallback.
        }
      }

      forecastByPlanCall.set(
        getPlanCallKey(call),
        fallback
      );

      continue;
    }

    forecastHours +=
      call.mpFreq;

    try {
      const prediction =
        predictor.predictXWithDetails(
          forecastHours
        );

      forecastByPlanCall.set(
        getPlanCallKey(call),
        {
          forecastMs:
            prediction.x.getTime(),
          forecastHours,
          source: 'usage',
          warning: null,
          warningDetail: null,
        }
      );
    } catch (error) {
      forecastByPlanCall.set(
        getPlanCallKey(call),
        plannedForecast(
          call,
          'predictor-error',
          error instanceof Error
            ? error.message
            : String(error)
        )
      );
    }
  }
}

const firstOperationIdByOrder =
  new Map();

for (const source of rawWorkItems) {
  if (
    source.isCompleted ||
    source.workOrderId == null ||
    source.operationId == null ||
    (
      source.mp != null &&
      source.desc
        .toLowerCase()
        .includes('daily')
    )
  ) {
    continue;
  }

  const operationId =
    String(
      source.operationId
    );

  const current =
    firstOperationIdByOrder.get(
      source.workOrderId
    );

  if (
    current == null ||
    operationId.localeCompare(
      current,
      undefined,
      {
        numeric: true,
      }
    ) < 0
  ) {
    firstOperationIdByOrder.set(
      source.workOrderId,
      operationId
    );
  }
}

function normaliseWorkItem(
  source
) {
  const plannedMs =
    source.planned == null
      ? null
      : Date.parse(
        source.planned
      );

  const forecastResult =
    source.mp != null &&
      source.mpCall != null
      ? forecastByPlanCall.get(
        getPlanCallKey(
          source
        )
      )
      : null;

  const forecast =
    forecastResult ??
    plannedForecast(
      source,
      source.strat?.startsWith('P')
        ? 'predictor-error'
        : null,
      source.strat?.startsWith('P')
        ? `No forecast result was generated for maintenance plan ${source.mp}, call ${source.mpCall}.`
        : null
    );

  const isForecastOnly =
    source.operationId == null;

  const firstOperationId =
    source.workOrderId == null
      ? null
      : firstOperationIdByOrder.get(
        source.workOrderId
      ) ?? null;

  const ownsForecast =
    isForecastOnly ||
    (
      firstOperationId != null &&
      String(
        source.operationId
      ) === firstOperationId
    );

  return {
    id:
      source.id,

    description:
      source.desc,

    asset:
      source.asset,

    priority:
      source.prio,

    availability:
      source.operationId === '0010'
        ? Math.floor(Math.random() * 3) + 1
        : null,

    startMs:
      source.operationId == null ||
        source.start == null
        ? null
        : Date.parse(
          source.start
        ),

    durationMinutes:
      source.operationId == null ||
        source.duration == null
        ? null
        : source.duration * 60,

    forecastMs:
      ownsForecast
        ? forecast.forecastMs
        : null,

    forecastHours:
      forecast.forecastHours,

    forecastSource:
      forecast.source,

    forecastWarning:
      forecast.warning,

    forecastWarningDetail:
      forecast.warningDetail,

    isStoppageReason:
      source.mp != null &&
      source.mi != null &&
      source.mat === "Y07",

    workOrderId:
      source.operationId == null ||
        source.workOrderId == null
        ? null
        : String(
          source.workOrderId
        ),

    operationId:
      source.operationId == null
        ? null
        : String(
          source.operationId
        ),

    resourceRequirements:
      source.operationId != null &&
        source.resourceCode != null &&
        source.quantity != null
        ? [
          {
            resourceCode:
              source.resourceCode,
            quantity:
              source.quantity,
          },
        ]
        : [],

    orderDescription:
      source.orderDesc,

    subphase:
      source.subphase,

    notes:
      source.notes,

    materialStatus:
      source.mat,

    materialStatusName:
      source.matName,

    maintenancePlanId:
      source.mp,

    maintenanceItemId:
      source.mi,

    maintenancePlanCall:
      source.mpCall,

    strategy:
      source.strat,

    plannedMs,

    counter:
      source.counter,

    importedStoppage:
      source.stoppage,
  };
}

export const workItems = rawWorkItems
  .filter(
    (source) =>
      !source.isCompleted &&
      !(
        source.mp != null &&
        source.desc
          .toLowerCase()
          .includes('daily')
      )
  )
  .map(
    normaliseWorkItem
  );

// export const workItems: RawWorkItem[] = [
//   {
//     id: '4123456-0010',
//     description: '250H PM SERVICE',
//     asset: 'TD6310',
//     priority: 2,
//     availability: 1,
//     startMs: Date.parse('2026-06-30T05:00:00+08:00'),
//     durationMinutes: 390,
//     forecastMs: Date.parse('2026-06-30T12:30:00+08:00'),
//     isStoppageReason: true,
//     workOrderId: '4123456',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 2,
//       },
//     ],
//   },
//   {
//     id: '4123456-0020',
//     description: 'REPLACE ENGINE OIL AND FILTERS',
//     asset: 'TD6310',
//     priority: 2,
//     availability: 1,
//     startMs: Date.parse('2026-06-30T05:00:00+08:00'),
//     durationMinutes: 120,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '4123456',
//     operationId: '0020',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: '4123456-0030',
//     description: 'INSPECT BRAKE SYSTEM',
//     asset: 'TD6310',
//     priority: 2,
//     availability: 1,
//     startMs: Date.parse('2026-06-30T07:00:00+08:00'),
//     durationMinutes: 90,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '4123456',
//     operationId: '0030',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 2,
//       },
//     ],
//   },
//   {
//     id: '4991234-0010',
//     description: '2W PM SERVICE',
//     asset: 'TD6310',
//     priority: 3,
//     availability: 1,
//     startMs: Date.parse('2026-06-30T08:30:00+08:00'),
//     durationMinutes: 270,
//     forecastMs: Date.parse('2026-06-30T13:15:00+08:00'),
//     isStoppageReason: true,
//     workOrderId: '4991234',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 2,
//       },
//     ],
//   },
//   {
//     id: '4776524-0010',
//     description: 'REPLACE OPERATOR SEAT',
//     asset: 'TD6310',
//     priority: 4,
//     availability: 2,
//     startMs: Date.parse('2026-06-30T12:30:00+08:00'),
//     durationMinutes: 180,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '4776524',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 2,
//       },
//     ],
//   },
//   {
//     id: '4776524-0020',
//     description: 'TEST OPERATOR SEAT CONTROLS',
//     asset: 'TD6310',
//     priority: 4,
//     availability: 1,
//     startMs: Date.parse('2026-06-30T15:30:00+08:00'),
//     durationMinutes: 60,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '4776524',
//     operationId: '0020',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: '4776628-0010',
//     description: 'REPLACE FRONT WINDOW',
//     asset: 'TD6310',
//     priority: 1,
//     availability: 3,
//     startMs: Date.parse('2026-06-30T06:00:00+08:00'),
//     durationMinutes: 270,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '4776628',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 2,
//       },
//     ],
//   },
//   {
//     id: '4776629-0010',
//     description: 'REPLACE WINDSCREEN WIPER',
//     asset: 'TD6310',
//     priority: 2,
//     availability: 2,
//     startMs: Date.parse('2026-07-02T08:30:00+08:00'),
//     durationMinutes: 60,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '4776629',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: 'forecast-task-0010',
//     description: 'INSPECT STEERING CYLINDER LEAK',
//     asset: 'TD6310',
//     priority: 3,
//     availability: 1,
//     startMs: Date.parse('2026-07-02T11:30:00+08:00'),
//     durationMinutes: 60,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: null,
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: 'planner-reason-0010',
//     description: 'REPORTED LOSS OF PROPULSION',
//     asset: 'TD6310',
//     priority: 1,
//     availability: 1,
//     startMs: Date.parse('2026-07-01T09:00:00+08:00'),
//     durationMinutes: 60,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: null,
//     operationId: '0010',
//     resourceRequirements: [],
//   },
//   {
//     id: '5267001-0010',
//     description: '500H PM SERVICE',
//     asset: 'TD6311',
//     priority: 2,
//     availability: 2,
//     startMs: Date.parse('2026-07-01T06:00:00+08:00'),
//     durationMinutes: 480,
//     forecastMs: Date.parse('2026-07-01T06:00:00+08:00'),
//     isStoppageReason: true,
//     workOrderId: '5267001',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 2,
//       },
//       {
//         resourceCode: 'AUT',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: '5267001-0020', // generate
//     description: 'COMPLETE ELECTRICAL INSPECTION', // extract
//     asset: 'TD6311', // extract
//     priority: 2, // extract
//     availability: 1, // compute
//     startMs: Date.parse('2026-07-01T10:00:00+08:00'), // transform
//     durationMinutes: 120, // transform
//     forecastMs: Date.parse('2026-07-01T06:00:00+08:00'), // compute
//     isStoppageReason: false, // compute
//     workOrderId: '5267001', // extract
//     operationId: '0020', // extract
//     resourceRequirements: [ // extract
//       {
//         resourceCode: 'AUT',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: '5267014-0010',
//     description: 'REPAIR EXHAUST BRACKET',
//     asset: 'TD6311',
//     priority: 3,
//     availability: 3,
//     startMs: Date.parse('2026-07-02T14:00:00+08:00'),
//     durationMinutes: 180,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '5267014',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'BLM',
//         quantity: 1,
//       },
//     ],
//   },
//   {
//     id: '5388100-0010',
//     description: 'REPLACE FRONT LEFT TYRE',
//     asset: 'TD6312',
//     priority: 1,
//     availability: 2,
//     startMs: Date.parse('2026-06-30T18:00:00+08:00'),
//     durationMinutes: 240,
//     forecastMs: null,
//     isStoppageReason: false,
//     workOrderId: '5388100',
//     operationId: '0010',
//     resourceRequirements: [
//       {
//         resourceCode: 'TYR',
//         quantity: 2,
//       },
//     ],
//   },
//   {
//     id: '5388100-0020',
//     description: 'INSPECT WHEEL ASSEMBLY',
//     asset: 'TD6312',
//     priority: 1,
//     availability: 1,
//     startMs: Date.parse('2026-06-30T21:00:00+08:00'),
//     durationMinutes: 60,
//     forecastMs: Date.parse('2026-06-30T18:00:00+08:00'),
//     isStoppageReason: false,
//     workOrderId: '5388100',
//     operationId: '0020',
//     resourceRequirements: [
//       {
//         resourceCode: 'HDF',
//         quantity: 1,
//       },
//     ],
//   },
// ];
