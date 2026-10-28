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

export interface ForecastDerivationCall {
  id: string;
  mpCall: number;

  workOrderId: number | null;

  description: string;

  orderDescription: string | null;

  plannedMs: number | null;
  completedMs: number | null;

  isCompleted: boolean;

  completionHours: number | null;
  forecastMs: number | null;
  forecastHours: number | null;

  forecastSource: ForecastSource | null;

  warning: ForecastWarning | null;

  warningDetail: string | null;
}

export interface ForecastDerivation {
  maintenancePlanId: number;
  selectedCall: number;

  asset: string;
  counter: number | null;
  counterDescription: string | null;
  strategy: string | null;

  readings: Array<{
    whenMs: number;
    usage: number;
    reading: number;
  }>;

  calls: ForecastDerivationCall[];

  predictorSnapshot: ReturnType<
    Predictor['getSnapshot']
  > | null;

  predictorError: string | null;
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
    forecastMs: source.planned == null
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

  const counter =
    calls.find(
      (call) =>
        call.counter != null
    )?.counter ?? null;

  if (counter == null) {
    for (const call of calls) {
      if (call.isCompleted) {
        continue;
      }

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
    for (const call of calls) {
      if (call.isCompleted) {
        continue;
      }

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

  let forecastHours = null;
  let hasBaseline = false;

  for (const call of calls) {
    if (
      call.isCompleted &&
      call.completed != null
    ) {
      try {
        forecastHours =
          predictor.predictY(
            call.completed
          );

        hasBaseline = true;
      } catch {
        forecastHours = null;
        hasBaseline = false;
      }

      continue;
    }

    if (call.isCompleted) {
      continue;
    }

    if (!hasBaseline) {
      const fallback =
        plannedForecast(
          call,
          'missing-baseline',
          `Maintenance plan ${maintenancePlanId}, call ${call.mpCall} has no preceding completed baseline. The call is treated as completed on its planned date.`
        );

      if (call.planned != null) {
        try {
          forecastHours =
            predictor.predictY(
              call.planned
            );

          fallback.forecastHours =
            forecastHours;

          hasBaseline = true;
        } catch {
          forecastHours = null;
          hasBaseline = false;
        }
      }

      forecastByPlanCall.set(
        getPlanCallKey(call),
        fallback
      );

      continue;
    }

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

          hasBaseline = true;
        } catch {
          // Keep the preceding usage baseline.
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
          forecastMs: prediction.x.getTime(),
          forecastHours,
          source: 'usage',
          warning: null,
          warningDetail: null,
        }
      );
    } catch (error) {
      const fallback =
        plannedForecast(
          call,
          'predictor-error',
          error instanceof Error
            ? error.message
            : String(error)
        );

      if (call.planned != null) {
        try {
          forecastHours =
            predictor.predictY(
              call.planned
            );

          fallback.forecastHours =
            forecastHours;

          hasBaseline = true;
        } catch {
          hasBaseline = false;
          forecastHours = null;
        }
      } else {
        hasBaseline = false;
        forecastHours = null;
      }

      forecastByPlanCall.set(
        getPlanCallKey(call),
        fallback
      );
    }
  }
}

export function deriveForecastExplanation(
  item
): ForecastDerivation | null {
  if (
    item.maintenancePlanId == null ||
    item.maintenancePlanCall == null
  ) {
    return null;
  }

  const maintenancePlanId =
    item.maintenancePlanId;

  const selectedCall =
    item.maintenancePlanCall;

  const calls =
    orderedPlanCallsByMaintenancePlan.get(
      maintenancePlanId
    );

  if (!calls) {
    return null;
  }

  const strategy =
    planCalls.find(
      (call) =>
        call.mp ===
        maintenancePlanId &&
        call.strat != null
    )?.strat ?? null;

  const counter =
    calls.find(
      (call) =>
        call.counter != null
    )?.counter ?? null;

  const predictor =
    counter == null
      ? null
      : predictorByCounter.get(
        counter
      ) ?? null;

  const predictorError =
    counter == null
      ? null
      : predictorErrorByCounter.get(
        counter
      ) ?? null;

  const derivationCalls =
    calls.map(
      (call) => {
        let completionHours = null;

        if (
          call.isCompleted &&
          call.completed != null &&
          predictor
        ) {
          try {
            completionHours =
              predictor.predictY(
                call.completed
              );
          } catch {
            completionHours = null;
          }
        }

        const forecast =
          forecastByPlanCall.get(
            getPlanCallKey(
              call
            )
          ) ?? null;

        return {
          id: call.id,

          mpCall:
            call.mpCall,

          workOrderId:
            call.workOrderId ??
            null,

          description:
            call.desc,

          orderDescription:
            call.orderDesc,

          plannedMs: call.planned == null
            ? null
            : Date.parse(
              call.planned
            ),

          completedMs: call.completed == null
            ? null
            : Date.parse(
              call.completed
            ),

          isCompleted: Boolean(
            call.isCompleted
          ),

          completionHours,

          forecastMs: forecast?.forecastMs ??
            null,

          forecastHours: forecast?.forecastHours ??
            null,

          forecastSource: forecast?.source ??
            null,

          warning: forecast?.warning ??
            null,

          warningDetail: forecast?.warningDetail ??
            null,
        };
      }
    );

  return {
    maintenancePlanId,
    selectedCall,

    asset: item.asset,

    counter,

    counterDescription: counter == null
      ? null
      : counters.find(
        (definition) =>
          definition.counter ===
          counter
      )?.longDesc ?? null,

    strategy,

    readings:
      counter == null
        ? []
        : readings
          .filter(
            (reading) =>
              reading.counter ===
              counter
          )
          .map(
            (reading) => ({
              whenMs:
                Date.parse(
                  reading.when
                ),
              usage:
                reading.usage,
              reading:
                reading.reading,
            })
          )
          .sort(
            (a, b) =>
              a.whenMs -
              b.whenMs
          ),

    calls:
      derivationCalls,

    predictorSnapshot: predictor
      ? predictor.getSnapshot()
      : null,

    predictorError,
  };
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
    id: source.id,

    description: source.desc,

    asset: source.asset,

    priority: source.prio,

    availability: source.operationId === '0010'
      ? Math.floor(Math.random() * 3) + 1
      : null,

    startMs: source.operationId == null ||
      source.start == null
      ? null
      : Date.parse(
        source.start
      ),

    durationMinutes: source.operationId == null ||
      source.duration == null
      ? null
      : source.duration * 60,

    forecastMs: ownsForecast
      ? forecast.forecastMs
      : null,

    forecastHours: forecast.forecastHours,

    forecastSource: forecast.source,

    forecastWarning: forecast.warning,

    forecastWarningDetail: forecast.warningDetail,

    isStoppageReason: source.mp != null &&
      source.mi != null &&
      source.mat === "Y07",

    workOrderId: source.operationId == null ||
      source.workOrderId == null
      ? null
      : String(
        source.workOrderId
      ),

    operationId: source.operationId == null
      ? null
      : String(
        source.operationId
      ),

    resourceRequirements: source.operationId != null &&
      source.resourceCode != null &&
      source.quantity != null
      ? [
        {
          resourceCode: source.resourceCode,
          quantity: source.quantity,
        },
      ]
      : [],

    orderDescription: source.orderDesc,

    subphase: source.subphase,

    notes: source.notes,

    materialStatus: source.mat,

    materialStatusName: source.matName,

    maintenancePlanId: source.mp,

    maintenanceItemId: source.mi,

    maintenancePlanCall: source.mpCall,

    strategy: source.strat,

    plant: source.plant,

    pg: source.pg,

    plannedMs,

    counter: source.counter,

    importedStoppage: source.stoppage,
  };
}

export function calculateForecastStartAdvice(
  item
) {
  const forecastDeviationMs =
    item.startMs != null &&
      item.forecastMs != null
      ? item.startMs -
      item.forecastMs
      : null;

  if (
    item.startMs == null ||
    item.forecastMs == null ||
    item.forecastSource !== 'usage'
  ) {
    return {
      expectedStartHours: null,
      forecastDeviationHours: null,
      forecastDeviationMs,
      forecastAdviceWarning: null,
    };
  }

  if (item.counter == null) {
    return {
      expectedStartHours: null,
      forecastDeviationHours: null,
      forecastDeviationMs,
      forecastAdviceWarning: 'No counter is available for this performance-based forecast.',
    };
  }

  const predictor =
    predictorByCounter.get(
      item.counter
    );

  if (!predictor) {
    return {
      expectedStartHours: null,
      forecastDeviationHours: null,
      forecastDeviationMs,
      forecastAdviceWarning: predictorErrorByCounter.get(
        item.counter
      ) ??
        `Counter ${item.counter} has no usable predictor.`,
    };
  }

  try {
    const expectedStartHours =
      predictor.predictY(
        item.startMs
      );

    const forecastDeviationHours =
      item.forecastHours == null
        ? null
        : expectedStartHours -
        item.forecastHours;

    return {
      expectedStartHours,
      forecastDeviationHours,
      forecastDeviationMs,
      forecastAdviceWarning: null,
    };
  } catch (error) {
    return {
      expectedStartHours: null,
      forecastDeviationHours: null,
      forecastDeviationMs,
      forecastAdviceWarning: error instanceof Error
        ? error.message
        : String(error),
    };
  }
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
