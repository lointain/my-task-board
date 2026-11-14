export type TaskStatus = "todo" | "doing" | "done" | "archived";

export interface DemoTask {
  id: string;
  title: string;
  urgency: number;
  importance: number;
  status: TaskStatus;
  due?: string;
  tag?: string;
}
