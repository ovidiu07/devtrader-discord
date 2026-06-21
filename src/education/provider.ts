import { loadEducationContentBank } from "./loadConfig.js";
import type { ContentProvider, EducationPost } from "./types.js";

export class StaticYamlContentProvider implements ContentProvider {
  constructor(private readonly path = "config/education-content-bank.yml") {}

  async getPosts(): Promise<EducationPost[]> {
    return (await loadEducationContentBank(this.path)).posts;
  }

  async getPostByKey(key: string): Promise<EducationPost | undefined> {
    return (await this.getPosts()).find((post) => post.key === key);
  }
}

export class LLMContentProvider implements ContentProvider {
  async getPosts(): Promise<EducationPost[]> {
    throw new Error("LLMContentProvider is reserved for a future approved content-generation workflow.");
  }

  async getPostByKey(): Promise<EducationPost | undefined> {
    throw new Error("LLMContentProvider is reserved for a future approved content-generation workflow.");
  }
}
