import { Cron } from "croner";
import { env } from "@/shared/config/env";
import {
  withJobLock,
  type JobLockOptions,
  type JobLockResult,
} from "@/worker/locks";
import {
  recordJobHeartbeat,
  type HeartbeatUpdateInput,
} from "@/features/worker/infrastructure/heartbeat-service";

export interface JobRunnerDeps<T = unknown> {
  acquireLock?: (
    lockKey: string,
    fn: (signal: AbortSignal) => Promise<T>,
    options?: JobLockOptions
  ) => Promise<JobLockResult<T>>;
  writeHeartbeat?: (
    jobName: string,
    input: HeartbeatUpdateInput
  ) => Promise<void>;
}

export interface JobRunnerOptions<T = unknown> {
  jobName: string;
  lockKey: string;
  timeoutMs: number;
  run: (signal: AbortSignal) => Promise<T>;
  resolveStatus?: (result: T) => string;
  deps?: JobRunnerDeps<T>;
}

function defaultResolveStatus(result: unknown): string {
  if (
    typeof result === "object" &&
    result !== null &&
    "status" in result &&
    typeof (result as { status: unknown }).status === "string"
  ) {
    return (result as { status: string }).status;
  }
  return "completed";
}

export class JobRunner<T = unknown> {
  private readonly options: JobRunnerOptions<T>;
  private readonly acquireLock: NonNullable<JobRunnerDeps<T>["acquireLock"]>;
  private readonly writeHeartbeat: NonNullable<
    JobRunnerDeps<T>["writeHeartbeat"]
  >;

  constructor(options: JobRunnerOptions<T>) {
    this.options = options;
    this.acquireLock = options.deps?.acquireLock ?? withJobLock;
    this.writeHeartbeat = options.deps?.writeHeartbeat ?? recordJobHeartbeat;
  }

  async execute(): Promise<JobLockResult<T>> {
    return this.acquireLock(
      this.options.lockKey,
      async (signal) => {
        await this.writeHeartbeat(this.options.jobName, {
          isExecuting: true,
          lastError: null,
        }).catch((err) => {
          console.error(
            `Error recording start heartbeat for ${this.options.jobName}:`,
            err
          );
        });

        try {
          const result = await this.options.run(signal);
          const status = this.options.resolveStatus
            ? this.options.resolveStatus(result)
            : defaultResolveStatus(result);

          await this.writeHeartbeat(this.options.jobName, {
            isExecuting: false,
            lastCycleAt: new Date(),
            lastCycleStatus: status,
            lastError: null,
            incrementCycle: true,
          }).catch((err) => {
            console.error(
              `Error recording completion heartbeat for ${this.options.jobName}:`,
              err
            );
          });

          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          await this.writeHeartbeat(this.options.jobName, {
            isExecuting: false,
            lastCycleAt: new Date(),
            lastCycleStatus: "failed",
            lastError: errorMessage,
          }).catch((err) => {
            console.error(
              `Error recording failure heartbeat for ${this.options.jobName}:`,
              err
            );
          });
          throw error;
        }
      },
      {
        timeoutMs: this.options.timeoutMs,
        onSkipped: () => {
          console.warn(
            `[${this.options.jobName}] Lock "${this.options.lockKey}" busy, skipping cycle.`
          );
        },
      }
    );
  }

  static run<T>(
    options: JobRunnerOptions<T>
  ): Promise<JobLockResult<T>> {
    return new JobRunner<T>(options).execute();
  }
}

export interface ScheduledJobOptions<T> extends JobRunnerOptions<T> {
  schedule: string;
  timezone?: string;
}

export function scheduleLockedJob<T>(
  options: ScheduledJobOptions<T>
): Cron {
  const { schedule, timezone, ...runnerOptions } = options;
  const runner = new JobRunner(runnerOptions);
  return new Cron(
    schedule,
    { timezone: timezone ?? env.APP_TIMEZONE, protect: true },
    async () => {
      await runner.execute().catch((err) => {
        console.error(`[${runnerOptions.jobName}] Scheduled execution failed:`, err);
      });
    }
  );
}
