
// Predictor.ts

export type DateInput = Date | string | number;

export interface PredictorPoint {
  x: DateInput;
  y: number;
}

export type PredictionMethod =
  | "actual"
  | "interpolation"
  | "extrapolation-before"
  | "extrapolation-after";

export interface YPrediction {
  x: Date;
  y: number;
  method: PredictionMethod;
}

export interface XPrediction {
  x: Date;
  y: number;
  method: PredictionMethod;
}

interface NormalisedPoint {
  time: number;
  value: number;
}

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Predicts values across a time-based series using:
 *
 * - Linear interpolation between known points.
 * - Anchored linear-regression extrapolation before the first point.
 * - Anchored linear-regression extrapolation after the last point.
 *
 * The input points are automatically sorted by time.
 *
 * Each `x` value may be:
 *
 * - A browser `Date`.
 * - A date string accepted by `new Date()`.
 * - A Unix timestamp in milliseconds.
 *
 * Duplicate timestamps are not supported.
 *
 * To support `predictX(y)`, the y-values must be monotonically increasing or
 * monotonically decreasing. Repeated y-values are allowed. When an exact
 * y-value occurs at multiple consecutive timestamps, inverse prediction
 * returns the latest matching timestamp.
 *
 * Extrapolation before the first point uses a least-squares regression line
 * constrained to pass through the first point.
 *
 * Extrapolation after the last point uses a least-squares regression line
 * constrained to pass through the last point.
 *
 * Predictions between known points use the straight line between the nearest
 * known point before the requested x and the nearest known point after it.
 *
 * Predictions that exactly match a known x return the known point. If a
 * known y occurs at multiple consecutive timestamps, inverse prediction
 * returns the latest matching point.

 *
 * @example
 * Create a predictor:
 *
 * ```ts
 * const predictor = new Predictor([
 *   { x: new Date("2026-01-01T00:00:00Z"), y: 10 },
 *   { x: new Date("2026-01-05T00:00:00Z"), y: 18 },
 *   { x: new Date("2026-01-12T00:00:00Z"), y: 25 },
 *   { x: new Date("2026-01-20T00:00:00Z"), y: 40 },
 * ]);
 * ```
 *
 * Predict y from x:
 *
 * ```ts
 * const y = predictor.predictY(
 *   new Date("2026-01-08T00:00:00Z"),
 * );
 *
 * console.log(y);
 * ```
 *
 * Predict x from y:
 *
 * ```ts
 * const x = predictor.predictX(30);
 *
 * console.log(x);
 * console.log(x.toISOString());
 * ```
 *
 * Inspect the calculation method used:
 *
 * ```ts
 * const prediction = predictor.predictYWithDetails(
 *   new Date("2025-12-20T00:00:00Z"),
 * );
 *
 * console.log(prediction.y);
 * console.log(prediction.method);
 * ```
 *
 * The possible methods are:
 *
 * - `"actual"`
 * - `"interpolation"`
 * - `"extrapolation-before"`
 * - `"extrapolation-after"`
 *
 * Predict several y-values:
 *
 * ```ts
 * const predictions = predictor.predictManyY([
 *   new Date("2025-12-20T00:00:00Z"),
 *   new Date("2026-01-08T00:00:00Z"),
 *   new Date("2026-02-01T00:00:00Z"),
 * ]);
 * ```
 *
 * Predict several x-values:
 *
 * ```ts
 * const predictions = predictor.predictManyX([5, 20, 50]);
 * ```
 *
 * Get the endpoint regression slopes:
 *
 * ```ts
 * const slopes = predictor.getExtrapolationSlopes();
 *
 * console.log(slopes.beforeFirstPerDay);
 * console.log(slopes.afterLastPerDay);
 * ```
 *
 * Both slopes are expressed as y-units per day.
 *
 * @throws {Error} If fewer than two points are supplied.
 * @throws {Error} If a point contains an invalid date or non-finite y-value.
 * @throws {Error} If two points have the same timestamp.
 * @throws {Error} If the y-values change direction.
 * @throws {Error} If an endpoint regression produces a zero slope.
 */
export class Predictor {
  private readonly points: NormalisedPoint[];

  private readonly firstPoint: NormalisedPoint;
  private readonly lastPoint: NormalisedPoint;

  private readonly firstSlopePerDay: number;
  private readonly lastSlopePerDay: number;

  private readonly direction: 1 | -1;

  constructor(points: PredictorPoint[]) {
    if (!Array.isArray(points) || points.length < 2) {
      throw new Error("At least two points are required.");
    }

    this.points = points
      .map((point, index) => ({
        time: parseTime(point.x, `points[${index}].x`),
        value: parseNumber(point.y, `points[${index}].y`),
      }))
      .sort((a, b) => a.time - b.time);

    this.validateUniqueTimes();

    this.direction = this.determineDirection();
    this.validateMonotonicity();

    this.firstPoint = this.points[0];
    this.lastPoint = this.points[this.points.length - 1];

    this.firstSlopePerDay = calculateAnchoredSlope(
      this.points,
      this.firstPoint,
    );

    this.lastSlopePerDay = calculateAnchoredSlope(
      this.points,
      this.lastPoint,
    );

    if (this.firstSlopePerDay === 0) {
      throw new Error(
        "The regression anchored at the first point has a zero slope.",
      );
    }

    if (this.lastSlopePerDay === 0) {
      throw new Error(
        "The regression anchored at the last point has a zero slope.",
      );
    }
  }

  /**
   * Predicts y for a supplied date or timestamp.
   */
  predictY(x: DateInput): number {
    return this.predictYWithDetails(x).y;
  }

  /**
   * Predicts y and reports the method used.
   */
  predictYWithDetails(x: DateInput): YPrediction {
    const time = parseTime(x, "x");

    if (time < this.firstPoint.time) {
      return {
        x: new Date(time),
        y: predictFromAnchor(
          time,
          this.firstPoint,
          this.firstSlopePerDay,
        ),
        method: "extrapolation-before",
      };
    }

    if (time > this.lastPoint.time) {
      return {
        x: new Date(time),
        y: predictFromAnchor(
          time,
          this.lastPoint,
          this.lastSlopePerDay,
        ),
        method: "extrapolation-after",
      };
    }

    const rightIndex = findFirstPointAtOrAfter(
      this.points,
      time,
      (point) => point.time,
    );

    const rightPoint = this.points[rightIndex];

    if (rightPoint.time === time) {
      return {
        x: new Date(time),
        y: rightPoint.value,
        method: "actual",
      };
    }

    const leftPoint = this.points[rightIndex - 1];

    return {
      x: new Date(time),
      y: interpolateY(leftPoint, rightPoint, time),
      method: "interpolation",
    };
  }

  /**
   * Predicts x for a supplied y value.
   *
   * The y values must be monotonic. If an exact y-value occurs at
   * multiple consecutive timestamps, the latest timestamp is returned.
   */
  predictX(y: number): Date {
    return this.predictXWithDetails(y).x;
  }

  /**
   * Predicts x and reports the method used.
   */
  predictXWithDetails(y: number): XPrediction {
    const value = parseNumber(y, "y");

    if (this.isBeforeFirstValue(value)) {
      return {
        x: new Date(
          solveTimeFromAnchor(
            value,
            this.firstPoint,
            this.firstSlopePerDay,
          ),
        ),
        y: value,
        method: "extrapolation-before",
      };
    }

    if (this.isAfterLastValue(value)) {
      return {
        x: new Date(
          solveTimeFromAnchor(
            value,
            this.lastPoint,
            this.lastSlopePerDay,
          ),
        ),
        y: value,
        method: "extrapolation-after",
      };
    }

    const rightIndex = findFirstPointAtOrAfter(
      this.points,
      value,
      (point) => this.direction * point.value,
    );

    const rightPoint =
      this.points[rightIndex];

    if (rightPoint.value === value) {
      let lastMatchingIndex =
        rightIndex;

      while (
        lastMatchingIndex + 1 <
        this.points.length &&
        this.points[
          lastMatchingIndex + 1
        ].value === value
      ) {
        lastMatchingIndex += 1;
      }

      const lastMatchingPoint =
        this.points[
        lastMatchingIndex
        ];

      return {
        x: new Date(
          lastMatchingPoint.time
        ),
        y: value,
        method: "actual",
      };
    }

    const leftPoint = this.points[rightIndex - 1];

    return {
      x: new Date(interpolateTime(leftPoint, rightPoint, value)),
      y: value,
      method: "interpolation",
    };
  }

  /**
   * Predicts multiple y values.
   */
  predictManyY(xs: DateInput[]): YPrediction[] {
    return xs.map((x) => this.predictYWithDetails(x));
  }

  /**
   * Predicts multiple x values.
   */
  predictManyX(ys: number[]): XPrediction[] {
    return ys.map((y) => this.predictXWithDetails(y));
  }

  /**
   * Returns the two endpoint regression slopes.
   */
  getExtrapolationSlopes(): {
    beforeFirstPerDay: number;
    afterLastPerDay: number;
  } {
    return {
      beforeFirstPerDay: this.firstSlopePerDay,
      afterLastPerDay: this.lastSlopePerDay,
    };
  }

  /**
   * Returns a copy of the sorted, normalised points.
   */
  getPoints(): Array<{ x: Date; y: number }> {
    return this.points.map((point) => ({
      x: new Date(point.time),
      y: point.value,
    }));
  }

  private validateUniqueTimes(): void {
    for (let index = 1; index < this.points.length; index++) {
      const previous = this.points[index - 1];
      const current = this.points[index];

      if (current.time === previous.time) {
        throw new Error(
          `Duplicate timestamp: ${new Date(current.time).toISOString()}`,
        );
      }
    }
  }

  private determineDirection(): 1 | -1 {
    const firstValue = this.points[0].value;
    const lastValue = this.points[this.points.length - 1].value;

    if (lastValue === firstValue) {
      throw new Error(
        "The y values must be strictly increasing or strictly decreasing.",
      );
    }

    return lastValue > firstValue ? 1 : -1;
  }

  private validateMonotonicity(): void {
    for (
      let index = 1;
      index < this.points.length;
      index++
    ) {
      const previous =
        this.points[index - 1].value;

      const current =
        this.points[index].value;

      const isValid =
        this.direction === 1
          ? current >= previous
          : current <= previous;

      if (!isValid) {
        throw new Error(
          "The y values must be monotonically increasing or monotonically decreasing.",
        );
      }
    }
  }

  private isBeforeFirstValue(value: number): boolean {
    return this.direction === 1
      ? value < this.firstPoint.value
      : value > this.firstPoint.value;
  }

  private isAfterLastValue(value: number): boolean {
    return this.direction === 1
      ? value > this.lastPoint.value
      : value < this.lastPoint.value;
  }
}

function calculateAnchoredSlope(
  points: NormalisedPoint[],
  anchor: NormalisedPoint,
): number {
  let numerator = 0;
  let denominator = 0;

  for (const point of points) {
    const xPrime = daysBetween(point.time, anchor.time);
    const yPrime = point.value - anchor.value;

    numerator += xPrime * yPrime;
    denominator += xPrime * xPrime;
  }

  if (denominator === 0) {
    throw new Error(
      "The anchored regression slope cannot be calculated.",
    );
  }

  return numerator / denominator;
}

function predictFromAnchor(
  targetTime: number,
  anchor: NormalisedPoint,
  slopePerDay: number,
): number {
  return (
    anchor.value +
    slopePerDay * daysBetween(targetTime, anchor.time)
  );
}

function solveTimeFromAnchor(
  targetValue: number,
  anchor: NormalisedPoint,
  slopePerDay: number,
): number {
  const dayOffset =
    (targetValue - anchor.value) / slopePerDay;

  return anchor.time + dayOffset * MILLISECONDS_PER_DAY;
}

function interpolateY(
  leftPoint: NormalisedPoint,
  rightPoint: NormalisedPoint,
  targetTime: number,
): number {
  const position =
    (targetTime - leftPoint.time) /
    (rightPoint.time - leftPoint.time);

  return (
    leftPoint.value +
    position * (rightPoint.value - leftPoint.value)
  );
}

function interpolateTime(
  leftPoint: NormalisedPoint,
  rightPoint: NormalisedPoint,
  targetValue: number,
): number {
  const position =
    (targetValue - leftPoint.value) /
    (rightPoint.value - leftPoint.value);

  return (
    leftPoint.time +
    position * (rightPoint.time - leftPoint.time)
  );
}

function findFirstPointAtOrAfter<T>(
  points: T[],
  target: number,
  selector: (point: T) => number,
): number {
  let low = 0;
  let high = points.length - 1;

  while (low < high) {
    const middle = Math.floor((low + high) / 2);

    if (selector(points[middle]) < target) {
      low = middle + 1;
    } else {
      high = middle;
    }
  }

  return low;
}

function daysBetween(
  time: number,
  referenceTime: number,
): number {
  return (time - referenceTime) / MILLISECONDS_PER_DAY;
}

function parseTime(value: DateInput, name: string): number {
  let time: number;

  if (value instanceof Date) {
    time = value.getTime();
  } else if (typeof value === "number") {
    time = value;
  } else if (typeof value === "string") {
    time = new Date(value).getTime();
  } else {
    throw new TypeError(
      `${name} must be a Date, date string, or Unix timestamp in milliseconds.`,
    );
  }

  if (!Number.isFinite(time)) {
    throw new Error(`${name} is not a valid date.`);
  }

  return time;
}

function parseNumber(value: number, name: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number.`);
  }

  return value;
}
