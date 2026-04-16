// src/routes/formsubmissionRoutes/adminapp/hr_reports.ts
import { Request, Response, Express } from "express";
import { db } from "../../../db/db";
import { hrReports } from "../../../db/schema";
import { v4 as uuidv4 } from "uuid";

export default function setupHrReportsPostRoutes(app: Express) {
  const endpoint = "adminapp/hr-reports";

  // POST: Create a new row for Multiple Interviews
  app.post(`/api/${endpoint}/interviews`, async (req: Request, res: Response) => {
    try {
      const { interviews } = req.body; // Expecting an array

      if (!Array.isArray(interviews) || interviews.length === 0) {
        return res.status(400).json({ error: "Expected an array of interviews." });
      }

      const newInterviews = interviews.map((i: any) => ({
        id: uuidv4(),
        name: i.name,
        designation: i.designation,
        department: i.department,
        dateOfInterview: i.dateOfInterview
      }));

      await db.insert(hrReports).values({
        reportDate: new Date().toISOString().split('T')[0],
        rawPayload: {}, 
        interviews: newInterviews, 
      });

      return res.json({ success: true, message: "Interviews added successfully" });
    } catch (err) {
      console.error("[HR POST ERROR - Interviews]", err);
      return res.status(500).json({ success: false, error: "Failed to add interviews" });
    }
  });

  // POST: Create a new row for Multiple Performers
  app.post(`/api/${endpoint}/performers`, async (req: Request, res: Response) => {
    try {
      const { type, performers } = req.body; // Expecting an array now

      if (!['top', 'bottom'].includes(type) || !Array.isArray(performers) || performers.length === 0) {
        return res.status(400).json({ error: "Invalid payload format. Expected an array of performers." });
      }

      // Map the incoming array and assign a UUID to each person
      const newPerformers = performers.map((p: any) => ({
        id: uuidv4(),
        name: p.name,
        designation: p.designation,
        department: p.department
      }));

      await db.insert(hrReports).values({
        reportDate: new Date().toISOString().split('T')[0],
        rawPayload: {}, 
        topPerformers: type === 'top' ? newPerformers : null,
        bottomPerformers: type === 'bottom' ? newPerformers : null,
      });

      return res.json({ success: true, message: "Performers added successfully" });
    } catch (err) {
      console.error("[HR POST ERROR - Performers]", err);
      return res.status(500).json({ success: false, error: "Failed to add performers" });
    }
  });

  console.log("✅ HR Reports POST endpoints setup complete");
}