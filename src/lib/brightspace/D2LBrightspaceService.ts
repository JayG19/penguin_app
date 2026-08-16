import type { BrightspaceService } from "./BrightspaceService";
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
 * Live D2L Brightspace (Valence) API client.
 *
 * Authentication: OAuth 2.0 authorization-code grant (the ID-Key legacy auth
 * is deprecated by D2L since 20.23.1). Flow:
 *   1. Register an OAuth 2.0 app in Brightspace (Admin Tools → Manage
 *      Extensibility → OAuth 2.0) → client id + secret.
 *   2. User visits /api/brightspace/connect → redirected to
 *      https://auth.brightspace.com/oauth2/auth to approve.
 *   3. /api/brightspace/callback exchanges the code at
 *      https://auth.brightspace.com/core/connect/token, and tokens are stored
 *      encrypted (AES-256-GCM) per user.
 *   4. This client sends `Authorization: Bearer <token>` and transparently
 *      refreshes expired tokens via the refresh_token grant.
 *
 * API versions: LP (org/users) and LE (courses/content/etc.) are versioned
 * separately; the constants below target widely-supported versions and can be
 * bumped per-tenant (GET /d2l/api/versions/ lists what a tenant supports).
 *
 * NOTE: this class is exercised only when BRIGHTSPACE_MODE=live and a user has
 * connected their account. Endpoint coverage varies by tenant permissions —
 * every method degrades to an empty list on 403/404 so a partially-scoped
 * token still syncs what it can.
 */

const AUTH_BASE = "https://auth.brightspace.com";
const LP = "1.31";
const LE = "1.67";

export interface D2LConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
}

export interface TokenStore {
  load(): Promise<TokenSet | null>;
  save(tokens: TokenSet): Promise<void>;
}

export class D2LBrightspaceService implements BrightspaceService {
  readonly mode = "live" as const;
  private tokens: TokenSet | null = null;

  constructor(private config: D2LConfig, private tokenStore?: TokenStore) {}

  static authorizeUrl(config: D2LConfig, redirectUri: string, scopes: string, state: string) {
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: scopes,
      state,
    });
    return `${AUTH_BASE}/oauth2/auth?${params}`;
  }

  static async exchangeCode(config: D2LConfig, redirectUri: string, code: string): Promise<TokenSet> {
    const res = await fetch(`${AUTH_BASE}/core/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
    const json = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
  }

  private async refreshTokens(refreshToken: string): Promise<TokenSet> {
    const res = await fetch(`${AUTH_BASE}/core/connect/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });
    if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`);
    const json = await res.json();
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? refreshToken,
      expiresAt: Date.now() + json.expires_in * 1000,
    };
  }

  private async accessToken(): Promise<string> {
    if (!this.tokens) this.tokens = (await this.tokenStore?.load()) ?? null;
    if (!this.tokens) throw new Error("Brightspace account not connected. Visit /api/brightspace/connect first.");
    if (Date.now() > this.tokens.expiresAt - 60_000) {
      this.tokens = await this.refreshTokens(this.tokens.refreshToken);
      await this.tokenStore?.save(this.tokens);
    }
    return this.tokens.accessToken;
  }

  private async api<T>(path: string): Promise<T | null> {
    const token = await this.accessToken();
    const res = await fetch(`${this.config.baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 403 || res.status === 404) return null;
    if (!res.ok) throw new Error(`Brightspace API ${path} → ${res.status}`);
    return (await res.json()) as T;
  }

  async ping() {
    try {
      const whoami = await this.api<{ UniqueName: string }>(`/d2l/api/lp/${LP}/users/whoami`);
      return { ok: true, message: `Connected as ${whoami?.UniqueName ?? "unknown user"}` };
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Connection failed" };
    }
  }

  async getCourses(): Promise<BSCourse[]> {
    // Paged: myenrollments returns { Items: [...], PagingInfo: { HasMoreItems, Bookmark } }
    const items: BSCourse[] = [];
    let bookmark = "";
    for (let page = 0; page < 10; page++) {
      const res = await this.api<{
        Items: Array<{ OrgUnit: { Id: number; Name: string; Code: string; Type: { Id: number } } }>;
        PagingInfo: { HasMoreItems: boolean; Bookmark: string };
      }>(`/d2l/api/lp/${LP}/enrollments/myenrollments/?orgUnitTypeId=3${bookmark ? `&bookmark=${bookmark}` : ""}`);
      if (!res) break;
      for (const it of res.Items) {
        items.push({
          externalId: String(it.OrgUnit.Id),
          code: it.OrgUnit.Code || it.OrgUnit.Name,
          name: it.OrgUnit.Name,
          term: "",
          url: `${this.config.baseUrl}/d2l/home/${it.OrgUnit.Id}`,
        });
      }
      if (!res.PagingInfo?.HasMoreItems) break;
      bookmark = res.PagingInfo.Bookmark;
    }
    return items;
  }

  async getCourseDetails(id: string): Promise<BSCourse | null> {
    const res = await this.api<{ Identifier: string; Name: string; Code: string; Description?: { Text: string } }>(
      `/d2l/api/lp/${LP}/courses/${id}`,
    );
    if (!res) return null;
    return {
      externalId: id,
      code: res.Code,
      name: res.Name,
      term: "",
      description: res.Description?.Text,
      url: `${this.config.baseUrl}/d2l/home/${id}`,
    };
  }

  async getCourseContent(id: string): Promise<BSModule[]> {
    const toc = await this.api<{ Modules: D2LTocModule[] }>(`/d2l/api/le/${LE}/${id}/content/toc`);
    if (!toc) return [];
    const mapItem = (t: D2LTocTopic, order: number) => ({
      externalId: `topic-${t.TopicId}`,
      title: t.Title,
      type: (t.TypeIdentifier === "Link" ? "link" : t.TypeIdentifier === "File" ? "file" : "page") as "file" | "link" | "page",
      url: t.Url ? `${this.config.baseUrl}${t.Url}` : undefined,
      order,
      updatedAt: t.LastModifiedDate ?? undefined,
    });
    const flatten = (mods: D2LTocModule[], out: BSModule[] = []) => {
      mods.forEach((m, i) => {
        out.push({
          externalId: `module-${m.ModuleId}`,
          title: m.Title,
          order: out.length + i,
          items: (m.Topics ?? []).map(mapItem),
        });
        if (m.Modules?.length) flatten(m.Modules, out);
      });
      return out;
    };
    return flatten(toc.Modules ?? []);
  }

  async getAssignments(id: string): Promise<BSAssignment[]> {
    const folders = await this.api<D2LDropboxFolder[]>(`/d2l/api/le/${LE}/${id}/dropbox/folders/`);
    if (!folders) return [];
    return folders.map((f) => ({
      externalId: `dropbox-${f.Id}`,
      title: f.Name,
      description: f.CustomInstructions?.Text,
      dueAt: f.DueDate ?? undefined,
      url: `${this.config.baseUrl}/d2l/lms/dropbox/user/folder_submit_files.d2l?ou=${id}&db=${f.Id}`,
    }));
  }

  async getQuizzes(id: string): Promise<BSQuiz[]> {
    const res = await this.api<{ Objects: D2LQuiz[] }>(`/d2l/api/le/${LE}/${id}/quizzes/`);
    if (!res) return [];
    return (res.Objects ?? []).map((q) => ({
      externalId: `quiz-${q.QuizId}`,
      title: q.Name,
      kind: /final/i.test(q.Name) ? "final" : /midterm|exam/i.test(q.Name) ? "midterm" : "quiz",
      startAt: q.StartDate ?? q.DueDate ?? undefined,
      url: `${this.config.baseUrl}/d2l/lms/quizzing/user/quiz_summary.d2l?ou=${id}&qi=${q.QuizId}`,
    }));
  }

  async getAnnouncements(id: string): Promise<BSAnnouncement[]> {
    const res = await this.api<D2LNewsItem[]>(`/d2l/api/le/${LE}/${id}/news/`);
    if (!res) return [];
    return res.map((n) => ({
      externalId: `news-${n.Id}`,
      title: n.Title,
      body: n.Body?.Text ?? "",
      postedAt: n.StartDate ?? n.CreatedDate ?? new Date().toISOString(),
      url: `${this.config.baseUrl}/d2l/le/news/${id}/${n.Id}/view`,
    }));
  }

  async getUsers(id: string): Promise<BSContactInfo[]> {
    const res = await this.api<D2LClasslistUser[]>(`/d2l/api/le/${LE}/${id}/classlist/`);
    if (!res) return [];
    return res
      .filter((u) => u.RoleId != null && u.DisplayName)
      .filter((u) => /instructor|professor|teacher|ta|teaching/i.test(u.RoleName ?? ""))
      .map((u) => ({
        externalId: `user-${u.Identifier}`,
        name: u.DisplayName,
        role: /ta|teaching assistant/i.test(u.RoleName ?? "") ? ("ta" as const) : ("professor" as const),
        email: u.Email ?? undefined,
      }));
  }

  async getGrades(id: string): Promise<BSGradeItem[]> {
    const values = await this.api<D2LGradeValue[]>(`/d2l/api/le/${LE}/${id}/grades/values/myGradeValues/`);
    if (!values) return [];
    return values
      .filter((g) => g.GradeObjectTypeName === "Numeric")
      .map((g) => ({
        externalId: `grade-${g.GradeObjectIdentifier}`,
        name: g.GradeObjectName,
        category: "other",
        weight: g.WeightedDenominator ?? 0,
        score: g.PointsNumerator ?? undefined,
        maxScore: g.PointsDenominator ?? 100,
      }));
  }

  async getResources(id: string): Promise<BSResource[]> {
    // Brightspace has no first-class "resources" API; course links live in
    // content topics of type Link, already surfaced by getCourseContent.
    void id;
    return [];
  }
}

interface D2LTocTopic { TopicId: number; Title: string; TypeIdentifier: string; Url?: string; LastModifiedDate?: string }
interface D2LTocModule { ModuleId: number; Title: string; Modules?: D2LTocModule[]; Topics?: D2LTocTopic[] }
interface D2LDropboxFolder { Id: number; Name: string; DueDate?: string; CustomInstructions?: { Text: string } }
interface D2LQuiz { QuizId: number; Name: string; StartDate?: string; DueDate?: string }
interface D2LNewsItem { Id: number; Title: string; Body?: { Text: string }; StartDate?: string; CreatedDate?: string }
interface D2LClasslistUser { Identifier: string; DisplayName: string; Email?: string; RoleId?: number; RoleName?: string }
interface D2LGradeValue {
  GradeObjectIdentifier: string;
  GradeObjectName: string;
  GradeObjectTypeName: string;
  PointsNumerator?: number;
  PointsDenominator?: number;
  WeightedDenominator?: number;
}
