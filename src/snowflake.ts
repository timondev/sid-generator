/**
 * snowflake.ts
 * @fileoverview SnowflakeID generator and destructor.
 *
 * (C) TimonDEV
 * MIT LICENSE
 */
import * as _cluster from 'cluster';
const cluster = _cluster as unknown as _cluster.Cluster; // typings fix

export class SnowflakeID {
  // constants for generating snowflakes.
  public static readonly EPOCH = 1420070400000;
  private static readonly ZERO_BIGINT = BigInt(0);

  // constants for shifting bits.
  private static readonly WORKER_SHIFT = BigInt(17);
  private static readonly PROCESS_SHIFT = BigInt(12);
  private static readonly TIME_SHIFT = BigInt(22);

  // constants for deconstructing bits.
  private static readonly WORKER_TRUNCATE = BigInt(0x3e0000);
  private static readonly PROCESS_TRUNCATE = BigInt(0x1f000);
  private static readonly INCREMENT_TRUNCATE = BigInt(0xfff);

  // limiter for process and worker component. 2
  private static readonly LIMITER = BigInt(2 ** 5);

  // components for generating snowflakes
  private static lastTime: number;
  private static increment = SnowflakeID.ZERO_BIGINT;
  private static processId = BigInt(process.pid);
  private static workerId = BigInt('NODE_UNIQUE_ID' in process.env ? cluster.worker.id : 0);

  /** copy of snowflake as bigint. */
  public snowflake: bigint;

  /** deconstructed from snowflake, use `new Date(timestamp)` to convert it to a Date Object. */
  public timestamp: number;

  /** deconstructed from snowflake ranging from 0 to 32. */
  public processId: number;

  /** deconstructed from snowflake ranging from 0 to 32. */
  public workerId: number;

  /** deconstructed from snowflake ranging from 0 to 4095. */
  public increment: number;

  /**
   * deconstruct snowflake generated by `generate()`.
   * @param snowflake to be deconstructed.
   */
  public constructor(snowflake: string = SnowflakeID.generate()) {
    if (typeof snowflake != 'string')
      throw new Error('SnowflakeID() expects bigint converted to string as input.');
    if (Number.isNaN(snowflake) || Number.isSafeInteger(Number(snowflake)))
      throw new Error('SnowflakeID expects a bigint as input.');

    this.snowflake = BigInt(snowflake);
    this.timestamp = Number(this.snowflake >> SnowflakeID.TIME_SHIFT) + SnowflakeID.EPOCH;
    this.workerId = Number((this.snowflake & SnowflakeID.WORKER_TRUNCATE) >> SnowflakeID.WORKER_SHIFT);
    this.processId = Number(
      (this.snowflake & SnowflakeID.PROCESS_TRUNCATE) >> SnowflakeID.PROCESS_SHIFT,
    );
    this.increment = Number(this.snowflake & SnowflakeID.INCREMENT_TRUNCATE);
  }

  /**
   * generates an unique snowflake identifier.
   *
   * ```markdown
   * snowflakes are 64-bit integers consisting of 4 components:
   *
   * timestamp | internal workerID | internal processID      | increment |
   * --------- | ----------------- | ---------------------   | --------- |
   * 42 bits   | 5 bits            | 5bits                   | 12bits    |
   * unique    | used for clusters | used for multiprocesses | unique    |
   * ```
   *
   * @external https://en.wikipedia.org/wiki/SnowflakeID_ID
   * @returns snowflake
   */
  public static generate(): string {
    const time = Date.now();

    // update increment
    this.updateIncrement(time);

    // construct snowflake
    let snowflake = BigInt(time - SnowflakeID.EPOCH) << SnowflakeID.TIME_SHIFT;
    snowflake += SnowflakeID.workerId % SnowflakeID.LIMITER << SnowflakeID.WORKER_SHIFT;
    snowflake += SnowflakeID.processId % SnowflakeID.LIMITER << SnowflakeID.PROCESS_SHIFT;
    snowflake += SnowflakeID.increment;

    // convert snowflake to string representation
    return snowflake.toString();
  }

  /**
   * updates increment for use in `SnowflakeID.generate()`.
   * when more than 4095 ids are generated in under 1ms, this function
   * will wait for the remaining time of the milli-second to prevent collisions.
   *
   * @param time current timestamp
   * @returns
   */
  private static updateIncrement(time: number): void {
    if (time != SnowflakeID.lastTime) {
      SnowflakeID.increment = SnowflakeID.ZERO_BIGINT;
      return;
    }

    if (++SnowflakeID.increment > 4095) {
      SnowflakeID.increment = SnowflakeID.ZERO_BIGINT;

      while (Date.now() <= time) {}
    }

    SnowflakeID.lastTime = time;
  }
}

export default SnowflakeID;
