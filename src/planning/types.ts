export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dependencies: string[]; // IDs of tasks that must complete first
  verifyCommand?: string; // Command to run to verify this task
  attempts: number;
  maxAttempts: number;
  error?: string;
}

export interface Plan {
  id: string;
  goal: string;
  createdAt: Date;
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'failed';
  summary: string;
  tasks: Task[];
  currentTaskIndex: number;
  verifyCommands: {
    build?: string;
    test?: string;
    lint?: string;
  };
  workingDirectory: string;
}

export interface PlanConfig {
  maxTaskAttempts: number;
  runBuildAfterEachTask: boolean;
  runTestAfterEachTask: boolean;
  stopOnFirstFailure: boolean;
}

export const DEFAULT_PLAN_CONFIG: PlanConfig = {
  maxTaskAttempts: 3,
  runBuildAfterEachTask: true,
  runTestAfterEachTask: false,
  stopOnFirstFailure: false,
};

export interface VerificationResult {
  success: boolean;
  command: string;
  output: string;
  exitCode: number;
}

export interface ExecutionResult {
  task: Task;
  success: boolean;
  output: string;
  verification?: VerificationResult;
}
