import type {
  BSAnnouncement,
  BSAssignment,
  BSContactInfo,
  BSCourse,
  BSGradeItem,
  BSModule,
  BSQuiz,
  BSResource,
} from "./types";

/**
 * Abstraction over the D2L Brightspace (Valence) API.
 *
 * Implementations:
 *  - MockBrightspaceService — realistic demo data, evolves between syncs.
 *  - D2LBrightspaceService  — real OAuth 2.0 API client (needs credentials,
 *    see docs/BRIGHTSPACE.md).
 *
 * The sync engine only talks to this interface, so demo mode → live mode is a
 * configuration change (BRIGHTSPACE_MODE=live), not a code change.
 */
export interface BrightspaceService {
  /** Human-readable label shown in the sync UI. */
  readonly mode: "mock" | "live";

  ping(): Promise<{ ok: boolean; message: string }>;
  getCourses(): Promise<BSCourse[]>;
  getCourseDetails(courseExternalId: string): Promise<BSCourse | null>;
  getCourseContent(courseExternalId: string): Promise<BSModule[]>;
  getAssignments(courseExternalId: string): Promise<BSAssignment[]>;
  getQuizzes(courseExternalId: string): Promise<BSQuiz[]>;
  getAnnouncements(courseExternalId: string): Promise<BSAnnouncement[]>;
  getUsers(courseExternalId: string): Promise<BSContactInfo[]>;
  getGrades(courseExternalId: string): Promise<BSGradeItem[]>;
  getResources(courseExternalId: string): Promise<BSResource[]>;
}

import { MockBrightspaceService } from "./MockBrightspaceService";
import { D2LBrightspaceService, type TokenSet } from "./D2LBrightspaceService";
import { brightspaceMode } from "./config";

/**
 * @param generation Number of syncs already completed (mock uses this to
 * simulate the source changing over time; live implementation ignores it).
 * @param userId Owner of the OAuth tokens used in live mode.
 */
export function getBrightspaceService(generation = 0, userId?: string): BrightspaceService {
  if (brightspaceMode() === "live") {
    const config = {
      baseUrl: process.env.BRIGHTSPACE_BASE_URL ?? "",
      clientId: process.env.BRIGHTSPACE_CLIENT_ID ?? "",
      clientSecret: process.env.BRIGHTSPACE_CLIENT_SECRET ?? "",
    };
    const tokenStore = userId
      ? {
          async load(): Promise<TokenSet | null> {
            const { db } = await import("@/lib/db");
            const { decrypt } = await import("@/lib/crypto");
            const row = await db.brightspaceConnection.findUnique({ where: { userId } });
            return row ? (JSON.parse(decrypt(row.tokens)) as TokenSet) : null;
          },
          async save(tokens: TokenSet): Promise<void> {
            const { db } = await import("@/lib/db");
            const { encrypt } = await import("@/lib/crypto");
            await db.brightspaceConnection.upsert({
              where: { userId },
              create: { userId, tokens: encrypt(JSON.stringify(tokens)) },
              update: { tokens: encrypt(JSON.stringify(tokens)) },
            });
          },
        }
      : undefined;
    return new D2LBrightspaceService(config, tokenStore);
  }
  return new MockBrightspaceService(generation);
}
