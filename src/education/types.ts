export type WeekdayType = "concept" | "mistake" | "exercise" | "reflection" | "case_study" | "recap" | "preparation";
export type Difficulty = "beginner" | "intermediate";

export type EducationScheduleChannel = {
  channelKey: string;
  enabled: boolean;
  dailyTime: string;
  contentCategory: string;
  skip?: boolean;
  noRepeatDays?: number;
};

export type EducationScheduleConfig = {
  timezone: string;
  enabled: boolean;
  defaultNoRepeatDays: number;
  channels: EducationScheduleChannel[];
};

export type EducationPost = {
  key: string;
  category: string;
  weekdayType: WeekdayType;
  difficulty: Difficulty;
  title: string;
  body: string;
  practical?: string;
  question: string;
  disclaimer?: string;
};

export type EducationContentBank = {
  posts: EducationPost[];
};

export type EducationCalendarDay = {
  date: string;
  posts: Array<{ channelKey: string; postKey: string }>;
};

export type EducationCalendar = {
  days: EducationCalendarDay[];
};

export type EducationRenderedEmbed = {
  title: string;
  description: string;
  fields: Array<{ name: string; value: string }>;
  footer?: { text: string };
  timestamp: string;
};

export type EducationRenderedPayload = {
  content?: string;
  embeds?: EducationRenderedEmbed[];
  allowedMentions: { parse: [] };
};

export type EducationMessage = {
  id: string;
  content: string;
};

export type EducationChannel = {
  id: string;
  key: string;
  name: string;
  send(payload: EducationRenderedPayload): Promise<EducationMessage>;
};

export type EducationPostRecord = {
  date: string;
  timezone: string;
  channelKey: string;
  postKey: string;
  discordChannelId?: string;
  discordMessageId?: string;
  postedAt?: string;
  status: "posted" | "skipped" | "failed";
  error?: string;
};

export type EducationState = {
  posts: EducationPostRecord[];
};

export type EducationPlanItem = {
  date: string;
  timezone: string;
  channelKey: string;
  scheduledTime: string;
  postKey?: string;
  title?: string;
  alreadyPosted: boolean;
  skipped: boolean;
  reason?: string;
};

export type EducationValidationIssue = {
  level: "error" | "warning";
  path: string;
  message: string;
};

export interface ContentProvider {
  getPosts(): Promise<EducationPost[]>;
  getPostByKey(key: string): Promise<EducationPost | undefined>;
}
