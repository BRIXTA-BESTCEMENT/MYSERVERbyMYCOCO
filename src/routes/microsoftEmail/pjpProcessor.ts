import { randomUUID } from "crypto";
// ✅ Importing the dedicated Payload Builder we just perfected
import { PjpPayloadBuilder } from "./pjpPayloadbuilder";
import { db } from "../../db/db";
import { dailyTasks, users, dealers } from "../../db/schema";

interface FuzzyUser {
    id: number;
    strictName: string;
    tokens: string[];
}

export class PjpProcessor {
    private excelBuilder = new PjpPayloadBuilder();

    // Caches for O(1) Time Complexity mappings
    private dealerMapCache: Map<string, string> | null = null;
    private userMapCache: Map<string, number> | null = null;
    private userFuzzyCache: FuzzyUser[] | null = null; 
    
    private lastMapUpdate = 0;
    private readonly MAP_TTL_MS = 5 * 60 * 1000;
    private readonly CHUNK_SIZE = 1000;

    /* =========================================================
       HELPER: NORMALIZE STRINGS
    ========================================================= */
    private normalizeName(name: string): string {
        if (!name) return "";
        return name
            .toUpperCase()
            .replace(/^M\/S\.?\s*/, "")
            .replace(/[^A-Z0-9]/g, "");
    }

    /* =========================================================
       HELPERS: CACHES & MATCHING
    ========================================================= */
    private async refreshCaches(): Promise<void> {
        const now = Date.now();
        if (this.dealerMapCache && this.userMapCache && this.userFuzzyCache && (now - this.lastMapUpdate < this.MAP_TTL_MS)) {
            return;
        }

        console.log("[PjpProcessor] 🔄 Refreshing User & Dealer Maps...");

        // Dealers Map
        const allDealers = await db.select({ id: dealers.id, name: dealers.name }).from(dealers);
        const dMap = new Map<string, string>();
        for (const d of allDealers) {
            if (d.name) dMap.set(this.normalizeName(d.name), d.id);
        }

        // Users Map & Fuzzy Cache
        const allUsers = await db.select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName
        }).from(users);

        const uMap = new Map<string, number>();
        const uFuzzy: FuzzyUser[] = [];

        for (const u of allUsers) {
            const fullName = `${u.firstName || ""} ${u.lastName || ""}`.trim();
            if (fullName) {
                const strictName = this.normalizeName(fullName);
                uMap.set(strictName, u.id);

                const cleanSpacedName = fullName.toUpperCase().replace(/[^A-Z0-9\s]/g, "").trim();
                const tokens = cleanSpacedName.split(/\s+/).filter(Boolean);
                
                uFuzzy.push({ id: u.id, strictName, tokens });
            }
        }

        this.dealerMapCache = dMap;
        this.userMapCache = uMap;
        this.userFuzzyCache = uFuzzy;
        this.lastMapUpdate = now;
    }

    private resolveUser(rawExcelName: string): number | null {
        if (!rawExcelName || !rawExcelName.trim()) return null;

        const cleanExcelName = rawExcelName.toUpperCase().replace(/^M\/S\.?\s*/, "").replace(/[^A-Z0-9\s]/g, "").trim();
        const excelTokens = cleanExcelName.split(/\s+/).filter(Boolean);
        const strictExcel = excelTokens.join("");

        if (!strictExcel) return null;

        // 1. Exact Match 
        if (this.userMapCache!.has(strictExcel)) {
            return this.userMapCache!.get(strictExcel)!;
        }

        // 2. Deep Match Fallbacks 
        for (const dbUser of this.userFuzzyCache!) {
            if (dbUser.strictName.includes(strictExcel) || strictExcel.includes(dbUser.strictName)) {
                console.log(`[PjpProcessor] 🪄 Substring match: "${rawExcelName}" -> DB ID: ${dbUser.id}`);
                return dbUser.id;
            }

            const allDbWordsInExcel = dbUser.tokens.length > 0 && dbUser.tokens.every(token => excelTokens.includes(token));
            if (allDbWordsInExcel) {
                console.log(`[PjpProcessor] 🪄 Word-by-Word match: "${rawExcelName}" -> DB ID: ${dbUser.id}`);
                return dbUser.id;
            }

            if (excelTokens.length === 1 && dbUser.tokens.includes(excelTokens[0])) {
                console.log(`[PjpProcessor] 🪄 Single Name match: "${rawExcelName}" -> DB ID: ${dbUser.id}`);
                return dbUser.id;
            }
        }

        return null;
    }

    /* =========================================================
       MAIN PROCESSOR LOGIC
    ========================================================= */
    public async processFiles(mailId: string, subject: string, files: any[]): Promise<void> {
        await this.refreshCaches();

        for (const file of files) {
            if (!file?.name?.match(/\.(xlsx|xls|csv)$/i) || !file.contentBytes) continue;

            const buffer = Buffer.from(file.contentBytes, "base64");
            if (!buffer.length) continue;

            const payload = await this.excelBuilder.buildFromBuffer(buffer, {
                messageId: mailId,
                fileName: file.name,
                subject: subject
            });

            const currentBatchId = randomUUID();
            const pjpInserts: typeof dailyTasks.$inferInsert[] = [];

            for (const task of payload.tasks) {
                const resolvedUserId = this.resolveUser(task.responsiblePerson);
                const normCounterName = this.normalizeName(task.counterName);
                const resolvedDealerId = this.dealerMapCache!.get(normCounterName) || null;

                if (!resolvedUserId) {
                    console.warn(`[PjpProcessor] ❌ Skipped row: User "${task.responsiblePerson}" not found in DB.`);
                    continue;
                }

                pjpInserts.push({
                    id: randomUUID(),
                    pjpBatchId: currentBatchId,
                    userId: resolvedUserId,
                    dealerId: resolvedDealerId,
                    dealerNameSnapshot: task.counterName,
                    dealerMobile: task.mobile,
                    zone: task.zone,
                    area: task.area,
                    route: task.route,
                    objective: task.objective,
                    visitType: task.type,
                    requiredVisitCount: task.requiredVisitCount,
                    week: task.week,
                    taskDate: task.date || new Date().toISOString().split("T")[0],
                    status: "Assigned",
                });
            }

            if (pjpInserts.length > 0) {
                await db.transaction(async (tx) => {
                    for (let i = 0; i < pjpInserts.length; i += this.CHUNK_SIZE) {
                        await tx.insert(dailyTasks).values(pjpInserts.slice(i, i + this.CHUNK_SIZE));
                    }
                });
                console.log(`[PjpProcessor] ✅ Pushed ${pjpInserts.length} tasks to DB. BatchID: ${currentBatchId}`);
            }
        }
    }
}