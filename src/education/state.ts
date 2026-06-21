import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { EducationPostRecord, EducationState } from "./types.js";

export const emptyEducationState = (): EducationState => ({ posts: [] });

export async function loadEducationState(path = "state/education-posts-state.json"): Promise<EducationState> {
  try {
    const raw = await readFile(path, "utf8");
    const parsed = JSON.parse(raw) as Partial<EducationState>;
    return { posts: parsed.posts ?? [] };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyEducationState();
    throw error;
  }
}

export async function saveEducationState(state: EducationState, path = "state/education-posts-state.json") {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export async function writeEducationAuditLog(date: string, records: EducationPostRecord[]) {
  const path = `logs/education-posts/${date}.json`;
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify({ date, records }, null, 2)}\n`, "utf8");
}
