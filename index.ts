// src/server/index.ts
import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// --- Import ALL your API route setups ---
import setupMasonStatsRoute from './src/routes/dataFetchingRoutes/masonpc/masonstatscheck'
import setupAuthRoutes from './src/routes/auth'; 
import setupAuthAdminRoutes from './src/routes/authAdminApp';
import setupUsersRoutes from './src/routes/users'; 
import setupCompaniesRoutes from './src/routes/companies'; 
import setupLogoutAuthRoutes from './src/routes/logout';
import setupR2Upload from './src/routes/cloudfareRoutes/cloudfare'; 
import setupBrandsAndMappingRoutes from './src/routes/dataFetchingRoutes/salesmanapp/brandMappingFetch';
import setupCompetitionReportsRoutes from './src/routes/dataFetchingRoutes/salesmanapp/competetionReports';
import setupDailyTasksRoutes from './src/routes/dataFetchingRoutes/salesmanapp/dailyTasks';
import setupDealersRoutes from './src/routes/dataFetchingRoutes/salesmanapp/dealers';
import setupPJPRoutes from './src/routes/dataFetchingRoutes/salesmanapp/pjp';
import setupDealerReportsAndScoresRoutes from './src/routes/dataFetchingRoutes/salesmanapp/dealerReportandScores';
import setupRatingsRoutes from './src/routes/dataFetchingRoutes/salesmanapp/ratings';
import setupSalesmanLeaveApplicationsRoutes from './src/routes/dataFetchingRoutes/salesmanapp/salesmanLeaveApplications';
import setupSalesOrdersRoutes from './src/routes/dataFetchingRoutes/salesmanapp/salesOrder';
import setupDailyVisitReportsRoutes from './src/routes/dataFetchingRoutes/salesmanapp/dvr';
import setupSalesmanAttendanceRoutes from './src/routes/dataFetchingRoutes/salesmanapp/salesmanAttendance';
import setupTechnicalVisitReportsRoutes from './src/routes/dataFetchingRoutes/salesmanapp/tvr';
import setupTsoMeetingsGetRoutes from './src/routes/dataFetchingRoutes/salesmanapp/tsoMeetings';
import setupMasonsOnMeetingsGetRoutes from './src/routes/dataFetchingRoutes/masonpc/masonOnMeeting';
import setupMasonsOnSchemeGetRoutes from './src/routes/dataFetchingRoutes/masonpc/masonOnScheme';
import setupMasonsPcSideRoutes from './src/routes/dataFetchingRoutes/masonpc/masonpcSide';
import setupSchemesOffersRoutes from './src/routes/dataFetchingRoutes/masonpc/schemesOffers';
import setupBagLiftsGetRoutes from './src/routes/dataFetchingRoutes/masonpc/bagsLift';
import setupPointsLedgerGetRoutes from './src/routes/dataFetchingRoutes/masonpc/pointsLedger';
import setupRewardCategoriesGetRoutes from './src/routes/dataFetchingRoutes/masonpc/rewardCategories';
import setupRewardsGetRoutes from './src/routes/dataFetchingRoutes/masonpc/rewards';
import setupRewardsRedemptionGetRoutes from './src/routes/dataFetchingRoutes/masonpc/rewardsRedemption';
import setupKycSubmissionsRoutes from './src/routes/dataFetchingRoutes/masonpc/kycSubmissions';
import setupTechnicalSitesRoutes from './src/routes/dataFetchingRoutes/salesmanapp/technicalSites';
import setupSchemeSlabsGetRoutes from './src/routes/dataFetchingRoutes/masonpc/schemeSlabs';
import setupMasonSlabAchievementsGetRoutes from './src/routes/dataFetchingRoutes/masonpc/masonSlabAchievements';
import setupLogisticsIORoutes from './src/routes/dataFetchingRoutes/logistics/logisticsIO';
import setupCollectionReportsRoutes from './src/routes/dataFetchingRoutes/adminapp/collectionReports';
import setupOutstandingReportsGetRoutes from './src/routes/dataFetchingRoutes/adminapp/outstandingReports';
import setupVerifiedDealersGetRoutes from './src/routes/dataFetchingRoutes/salesmanapp/verifiedDealers';

// --- Import DELETE route setups ---
import setupDealersDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/dealers';
import setupPermanentJourneyPlansDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/pjp';
import setupTechnicalVisitReportsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/tvr';
import setupDailyVisitReportsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/dvr';
import setupDailyTasksDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/dailytask';
import setupSalesmanLeaveApplicationsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/salesmanleave';
import setupCompetitionReportsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/competetionreports';
import setupBrandsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/brands';
import setupRatingsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/ratings';
import setupSalesOrdersDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/salesOrder';
import setupDealerReportsAndScoresDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/dealerReportsAndScores';
import setupTsoMeetingsDeleteRoutes from './src/routes/deleteRoutes/salesmanapp/tsoMeetings';

//firebase stuff 
import './src/firebase/admin';
import setupAuthFirebaseRoutes from './src/routes/authFirebase';

// --- Import POST route setups ---
import setupDailyVisitReportsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/dvr';
import setupTechnicalVisitReportsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/tvr';
import setupPermanentJourneyPlansPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/pjp';
import setupDealersPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/addDealer';
import setupSalesmanLeaveApplicationsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/salesManleave';
import setupCompetitionReportsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/competitionReport';
import setupDailyTasksPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/dailytasks';
import setupDealerReportsAndScoresPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/dealerReportsAndScores';
import setupRatingsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/ratings';
import setupBrandsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/brand';
import setupSalesOrdersPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/salesOrder';
import setupDealerBrandMappingPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/brandMapping';
import setupAttendanceCheckInRoutes from './src/routes/formSubmissionRoutes/salesmanapp/attendanceIn';
import setupAttendanceCheckOutRoutes from './src/routes/formSubmissionRoutes/salesmanapp/attendanceOut';
import setupTsoMeetingsPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/tsoMeetings';
import setupMasonOnMeetingPostRoutes from './src/routes/formSubmissionRoutes/masonpc/masonOnMeeting';
import setupMasonOnSchemePostRoutes from './src/routes/formSubmissionRoutes/masonpc/masonOnScheme';
import setupMasonPcSidePostRoutes from './src/routes/formSubmissionRoutes/masonpc/masonpcSide';
import setupSchemesOffersPostRoutes from './src/routes/formSubmissionRoutes/masonpc/schemesOffers';
import setupBagLiftsPostRoute from './src/routes/formSubmissionRoutes/masonpc/bagsLift';
import setupRewardsRedemptionPostRoute from './src/routes/formSubmissionRoutes/masonpc/rewardsRedemption';
import setupKycSubmissionsPostRoute from './src/routes/formSubmissionRoutes/masonpc/kycSubmission';
import setupRewardsPostRoute from './src/routes/formSubmissionRoutes/masonpc/rewards';
import setupPointsLedgerPostRoutes from './src/routes/dataFetchingRoutes/masonpc/pointsLedger';
import setupTechnicalSitesPostRoutes from './src/routes/formSubmissionRoutes/salesmanapp/technicalSites';
import setupSchemeSlabsPostRoute from './src/routes/formSubmissionRoutes/masonpc/schemeSlabs';
import setupMasonSlabAchievementsPostRoute from './src/routes/formSubmissionRoutes/masonpc/masonSlabAchievements';
import setupLogisticsIOSubmissionRoute from './src/routes/formSubmissionRoutes/logistics/logisticsIO';


// --- Import UPDATE (PATCH) route setups ---
import setupDealersPatchRoutes from './src/routes/updateRoutes/salesmanapp/dealers';
import setupPjpPatchRoutes from './src/routes/updateRoutes/salesmanapp/pjp';
import setupDailyTaskPatchRoutes from './src/routes/updateRoutes/salesmanapp/dailytask';
import setupDealerBrandMappingPatchRoutes from './src/routes/updateRoutes/salesmanapp/brandMapping';
import setupBrandsPatchRoutes from './src/routes/updateRoutes/salesmanapp/brands';
import setupRatingsPatchRoutes from './src/routes/updateRoutes/salesmanapp/ratings';
import setupDealerScoresPatchRoutes from './src/routes/updateRoutes/salesmanapp/dealerReportandScores';
import setupDailyVisitReportsPatchRoutes from './src/routes/updateRoutes/salesmanapp/dvr';
import setupTechnicalVisitReportsPatchRoutes from './src/routes/updateRoutes/salesmanapp/tvr';
import setupTsoMeetingsPatchRoutes from './src/routes/updateRoutes/salesmanapp/tsoMeetings';
import setupSalesOrdersPatchRoutes from './src/routes/updateRoutes/salesmanapp/salesorder';
import setupMasonPcSidePatchRoutes from './src/routes/updateRoutes/masonpc/masonpcSide';
import setupSchemesOffersPatchRoutes from './src/routes/updateRoutes/masonpc/schemesOffers';
import setupKycSubmissionsPatchRoute from './src/routes/updateRoutes/masonpc/kycSubmission';
import setupRewardsPatchRoute from './src/routes/updateRoutes/masonpc/rewards';
import setupRewardsRedemptionPatchRoute from './src/routes/updateRoutes/masonpc/rewardsRedemption';
import setupBagLiftsPatchRoute from './src/routes/updateRoutes/masonpc/bagsLift';
import setupTechnicalSitesUpdateRoutes from './src/routes/updateRoutes/salesmanapp/technicalSites';
import setupLogisticsIOUpdateRoutes from './src/routes/updateRoutes/logistics/logisticsIO';
import setupLeaveUpdateRoute from './src/routes/updateRoutes/salesmanapp/salesmanLeaves';

// --- Import GEO TRACKING route setups ---
import setupGeoTrackingRoutes from './src/routes/geoTrackingRoutes/geoTracking';
import setupJourneyOpsRoutes from './src/routes/geoTrackingRoutes/journeyOps';

// ----- TeamView Routes -----
import setupTeamViewRoutes from './src/routes/teamView/getView';

// --- TelegramBot + AI Bot setups ---
import setupAiService from './src/bots/aiService';
//import setupTelegramService from './src/bots/telegramService';

// WEBSOCKET SYSTEM
import { attachWebSocket } from './src/websocket/socketServer';

//notunRendami
import setupAuthCredentialRoutes from './src/routes/authCredentials';
import setupAuthLogisticsRoutes from './src/routes/authLogistics';

// Microsoft Email
import setupMicrosoftEmailRoutes from './src/routes/microsoftEmail/emailRoute';

//weirdEMAILWORKERthatwillPOLLevery30s
//import { EmailSystemWorker } from './src/routes/microsoftEmail/emailsystemworker';
import { MasterEmailWorker } from "./src/services/masteremailworker";
import setupProjectionRoutes from './src/routes/dataFetchingRoutes/adminapp/projectionReports';
import setupProjectionVsActualRoutes from './src/routes/dataFetchingRoutes/adminapp/projectionVsActualReports';
import { setupAutoApproveCron } from './src/workers/autoApprove';

// admin App Email Worker
import setupHrReportsRoutes from './src/routes/dataFetchingRoutes/adminapp/hr_reports';
import setupHrReportsPostRoutes from './src/routes/formSubmissionRoutes/adminapp/hr_reports';
import setupHrReportsUpdateRoutes from './src/routes/updateRoutes/adminapp/hr_reports';

//----------------MainMasterEMAILWORKER--------------------

const emailRouter = new MasterEmailWorker();
emailRouter.Start();

//----------------MainMasterEMAILWORKER-------------------- OLD

// const worker = new EmailSystemWorker();

// worker.Start().catch((e) => {
//   console.error("Worker crashed unexpectedly:", e);
// });

// Initialize environment variables

// ADD THIS DEBUG LINE:
console.log('DATABASE_URL loaded:', process.env.DATABASE_URL ? 'YES' : 'NO');
console.log('DATABASE_URL length:', process.env.DATABASE_URL?.length || 0);

// --- Server Setup ---
const app: Express = express();
//const PORT = process.env.PORT || 8080;
const DEFAULT_PORT = 8000;
const parsed = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
const PORT = Number.isNaN(parsed) ? DEFAULT_PORT : parsed;


// --- Core Middleware ---
// Enable Cross-Origin Resource Sharing for all routes
app.use(cors());

// Enable the express.json middleware to parse JSON request bodies
app.use(express.json());

app.use(express.static(path.join(process.cwd(), 'public')));

app.use((req: Request, res: Response, next: NextFunction) => {
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = Array.isArray(forwarded)
    ? forwarded[0]
    : forwarded?.split(',')[0];

  const ip =
    realIp ||
    req.socket.remoteAddress ||
    'unknown';

  const userAgent = req.headers['user-agent'] || 'unknown';

  console.log(
    `[${new Date().toISOString()}]`,
    'IP:', ip,
    '|',
    req.method,
    req.url,
    '| UA:',
    userAgent
  );

  next();
});

// --- API Routes ----

// A simple health-check or welcome route
app.get('/api', (req: Request, res: Response) => {
  res.status(200).json({ 
    message: 'Welcome to the Field Force Management API!',
    timestamp: new Date().toISOString()
  });
});

// --- Modular Route Setup ---
console.log('🔌 Registering API routes...');

// reports from mail
setupCollectionReportsRoutes(app);
setupOutstandingReportsGetRoutes(app);
setupVerifiedDealersGetRoutes(app);
setupProjectionVsActualRoutes(app);
setupProjectionRoutes(app);

// admin app reports 
setupHrReportsRoutes(app);
setupHrReportsPostRoutes(app);
setupHrReportsUpdateRoutes(app);


// Authentication and Users (FIRST)
setupAuthRoutes(app);                    // /api/auth/login, /api/user/:id
setupAuthAdminRoutes(app);               // /api/auth/admin/login
setupUsersRoutes(app);                   // /api/users/*
setupCompaniesRoutes(app);                // /api/companies
setupLogoutAuthRoutes(app);               // /api/auth/logout
//firebase
setupAuthFirebaseRoutes(app);
setupAuthLogisticsRoutes(app);

// Core Data Endpoints (GET)
setupBrandsAndMappingRoutes(app);        // /api/brands/*, /api/dealer-brand-mapping/*
setupDealersRoutes(app);                 // /api/dealers/*
setupDailyTasksRoutes(app);              // /api/daily-tasks/*
setupPJPRoutes(app);                     // /api/pjp/*

// Reports Endpoints (GET)
setupCompetitionReportsRoutes(app);      // /api/competition-reports/*
setupDailyVisitReportsRoutes(app);       // /api/daily-visit-reports/*
setupTechnicalVisitReportsRoutes(app);   // /api/technical-visit-reports/*
setupTsoMeetingsGetRoutes(app);

// Additional Data Endpoints (GET)
setupDealerReportsAndScoresRoutes(app);  // /api/dealer-reports-scores/*
setupRatingsRoutes(app);                 // /api/ratings/*
setupSalesmanLeaveApplicationsRoutes(app); // /api/leave-applications/*
setupSalesOrdersRoutes(app);             // /api/sales-orders/*
setupSalesmanAttendanceRoutes(app);      // /api/salesman-attendance/*

// mason pc side
setupMasonStatsRoute(app);
setupMasonsOnMeetingsGetRoutes(app);
setupMasonsOnSchemeGetRoutes(app);
setupMasonsPcSideRoutes(app);
setupSchemesOffersRoutes(app);
setupBagLiftsGetRoutes(app);
setupPointsLedgerGetRoutes(app);
setupRewardsGetRoutes(app);
setupRewardsRedemptionGetRoutes(app);
setupKycSubmissionsRoutes(app);
setupTechnicalSitesRoutes(app);
setupSchemeSlabsGetRoutes(app);
setupMasonSlabAchievementsGetRoutes(app);

//logistics
setupLogisticsIORoutes(app);


// POST Endpoints
setupTechnicalVisitReportsPostRoutes(app); // POST /api/technical-visit-reports/*
setupPermanentJourneyPlansPostRoutes(app); // POST /api/permanent-journey-plans/*
setupDealersPostRoutes(app);             // POST /api/dealers/*
setupSalesmanLeaveApplicationsPostRoutes(app); // POST /api/leave-applications/*
setupCompetitionReportsPostRoutes(app);  // POST /api/competition-reports/*
setupDailyTasksPostRoutes(app);          // POST /api/daily-tasks/*
setupDealerReportsAndScoresPostRoutes(app); // POST /api/dealer-reports-scores/*
setupRatingsPostRoutes(app);             // POST /api/ratings/*
setupBrandsPostRoutes(app);              // POST /api/brands/*
setupSalesOrdersPostRoutes(app);         // POST /api/sales-orders/*
setupDealerBrandMappingPostRoutes(app);  // POST /api/dealer-brand-mapping/*
setupDailyVisitReportsPostRoutes(app);   // POST /api/daily-visit-reports/*
setupAttendanceCheckInRoutes(app);       // POST /api/attendance/check-in/*
setupAttendanceCheckOutRoutes(app);      // POST /api/attendance/check-out/*
setupTsoMeetingsPostRoutes(app);         // TSO meeting r ENDPOINT r initiations kaam kore

// mason pc side
setupMasonOnMeetingPostRoutes(app);
setupMasonOnSchemePostRoutes(app);
setupMasonPcSidePostRoutes(app);
setupSchemesOffersPostRoutes(app);
setupRewardCategoriesGetRoutes(app);
setupKycSubmissionsPostRoute(app);
setupRewardsPostRoute(app);
setupPointsLedgerPostRoutes(app);
setupTechnicalSitesPostRoutes(app);
setupSchemeSlabsPostRoute(app);
setupMasonSlabAchievementsPostRoute(app);

// logistics
setupLogisticsIOSubmissionRoute(app);

// DELETE Endpoints
setupDealersDeleteRoutes(app);           // DELETE /api/dealers/*
setupPermanentJourneyPlansDeleteRoutes(app); // DELETE /api/permanent-journey-plans/*
setupTechnicalVisitReportsDeleteRoutes(app); // DELETE /api/technical-visit-reports/*
setupDailyVisitReportsDeleteRoutes(app); // DELETE /api/daily-visit-reports/*
setupDailyTasksDeleteRoutes(app);        // DELETE /api/daily-tasks/*
setupSalesmanLeaveApplicationsDeleteRoutes(app); // DELETE /api/leave-applications/*
setupCompetitionReportsDeleteRoutes(app); // DELETE /api/competition-reports/*
setupBrandsDeleteRoutes(app);            // DELETE /api/brands/*
setupRatingsDeleteRoutes(app);           // DELETE /api/ratings/*
setupSalesOrdersDeleteRoutes(app);       // DELETE /api/sales-orders/*
setupDealerReportsAndScoresDeleteRoutes(app); // DELETE /api/dealer-reports-scores/*
setupTsoMeetingsDeleteRoutes(app);

// UPDATE (PATCH) endpoints
setupDealersPatchRoutes(app);
setupDealerScoresPatchRoutes(app);
setupRatingsPatchRoutes(app);
setupDailyTaskPatchRoutes(app);
setupDealerBrandMappingPatchRoutes(app);
setupBrandsPatchRoutes(app);
setupPjpPatchRoutes(app);
setupDailyVisitReportsPatchRoutes(app);
setupTechnicalVisitReportsPatchRoutes(app);
setupTsoMeetingsPatchRoutes(app);
setupSalesOrdersPatchRoutes(app);
setupLeaveUpdateRoute(app);

// mason pc side
setupMasonPcSidePatchRoutes(app);
setupSchemesOffersPatchRoutes(app);
setupBagLiftsPostRoute(app);
setupRewardsRedemptionPostRoute(app);
setupKycSubmissionsPatchRoute(app);
setupRewardsPatchRoute(app);
setupRewardsRedemptionPatchRoute(app);
setupBagLiftsPatchRoute(app);
setupTechnicalSitesUpdateRoutes(app);

//notunrendami
setupAuthCredentialRoutes(app);

// logistics
setupLogisticsIOUpdateRoutes(app);

// ---------- GEO TRACKING SETUP--------
setupGeoTrackingRoutes(app);
setupJourneyOpsRoutes(app);

// ------- Team View --------
setupTeamViewRoutes(app);

//------------ CLOUDFARE ----------------
setupR2Upload(app);
console.log('✅ All routes registered successfully.');

//------------ TelegramBot + AI setup ----------------
setupAiService(app);
//setupTelegramService(app);

// -------- Microsoft Email -------------
setupMicrosoftEmailRoutes(app);

setupAutoApproveCron();


// Handle 404 - Not Found for any routes not matched above
app.use((req: Request, res: Response) => {
  res.status(404).json({ success: false, error: 'Resource not found' });
});

// Handle 500 - Generic Internal Server Error
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack); // Log the error stack for debugging
  res.status(500).json({ 
    success: false, 
    error: 'Internal Server Error',
    details: err.message 
  });
});

// --- Start the Server ---
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server is running and listening on http://0.0.0.0:${PORT}`);
});

// WEBSOCKET START
attachWebSocket(server);