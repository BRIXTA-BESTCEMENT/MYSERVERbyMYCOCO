// src/services/emailSystem.ts
import axios from "axios";

export class EmailSystem {
  private tenantId: string;
  private clientId: string;
  private clientSecret: string;
  private mailbox: string;

  private static GRAPH_BASE = "https://graph.microsoft.com/v1.0";

  // token cache (shared per instance)
  private accessToken: string | null = null;
  private expiresAt = 0;

  constructor() {
    this.tenantId = process.env.TENANT_ID!;
    this.clientId = process.env.CLIENT_ID!;
    this.clientSecret = process.env.CLIENT_SECRET!;
    this.mailbox = process.env.MAILBOX!;

    if (!this.tenantId || !this.clientId || !this.clientSecret || !this.mailbox) {
      throw new Error("EmailSystem: Missing required environment variables");
    }
  }

  // ---------- AUTH ----------
  private async getAccessToken(): Promise<string> {
    const now = Date.now();

    if (this.accessToken && now < this.expiresAt) {
      return this.accessToken;
    }

    const params = new URLSearchParams();
    params.append("client_id", this.clientId);
    params.append("client_secret", this.clientSecret);
    params.append("scope", "https://graph.microsoft.com/.default");
    params.append("grant_type", "client_credentials");

    const res = await axios.post(
      `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`,
      params
    );

    this.accessToken = res.data.access_token;
    this.expiresAt = now + (res.data.expires_in - 60) * 1000;

    return this.accessToken!;
  }

  // ---------- GRAPH CORE ----------
  private async graphGet<T = any>(path: string): Promise<T> {
    const token = await this.getAccessToken();

    const res = await axios.get(
      `${EmailSystem.GRAPH_BASE}${path}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data;
  }

  private async graphPost<T = any>(path: string, body: any): Promise<T> {
    const token = await this.getAccessToken();

    const res = await axios.post(
      `${EmailSystem.GRAPH_BASE}${path}`,
      body,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.data;
  }

  // ---------- PUBLIC API ----------
  async getInbox(limit = 10) {
    return this.graphGet(
      `/users/${this.mailbox}/messages?$top=${limit}&$orderby=receivedDateTime desc`
    );
  }

  async getAttachments(messageId: string) {
    return this.graphGet(
      `/users/${this.mailbox}/messages/${messageId}/attachments`
    );
  }

  async sendMail(
    to: string,
    subject: string,
    content: string
  ) {
    return this.graphPost(
      `/users/${this.mailbox}/sendMail`,
      {
        message: {
          subject,
          body: {
            contentType: "Text",
            content,
          },
          toRecipients: [
            { emailAddress: { address: to } },
          ],
        },
      }
    );
  }

  async moveMail(
    messageId: string,
    destinationFolderId: string
  ) {
    return this.graphPost(
      `/users/${this.mailbox}/messages/${messageId}/move`,
      { destinationId: destinationFolderId }
    );
  }
}
