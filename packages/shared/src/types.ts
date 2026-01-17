export type WidgetId = "rightnow" | "schedule";

export type WidgetDefinition = {
  id: WidgetId;
  title: string;
  endpoint: string;
};