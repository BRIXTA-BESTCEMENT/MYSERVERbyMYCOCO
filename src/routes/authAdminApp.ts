// server/src/routes/authAdminApp.ts

import { Request, Response, Express, NextFunction } from 'express';
import { db } from '../db/db';
import { users, roles, userRoles } from '../db/schema';
import { eq } from 'drizzle-orm';
import pkg from 'jsonwebtoken';

const { sign, verify } = pkg;

// Helper function to safely convert BigInt to JSON
function toJsonSafe(obj: any): any {
  return JSON.parse(
    JSON.stringify(obj, (_, value) =>
      typeof value === 'bigint' ? Number(value) : value
    )
  );
}

// --------------------------------------------------
// ADMIN JWT VERIFICATION MIDDLEWARE
// --------------------------------------------------
export const verifyAdminToken = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token is missing' });
  }

  if (!process.env.JWT_SECRET) {
    console.error('JWT_SECRET is not defined');
    return res.status(500).json({ error: 'Server configuration error' });
  }

  verify(token, process.env.JWT_SECRET, (err: any, decodedUser: any) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }
    
    // Optional: Extra layer of security to ensure this token belongs to an admin
    if (!decodedUser.isAdmin) {
        return res.status(403).json({ error: 'Insufficient privileges. Admin access required.' });
    }

    (req as any).user = decodedUser;
    next();
  });
};

// --------------------------------------------------
// ROUTES
// --------------------------------------------------
export default function setupAuthAdminRoutes(app: Express) {
  
  // --------------------------------------------------
  // ADMIN LOGIN
  // --------------------------------------------------
  app.post('/api/auth/admin/login', async (req: Request, res: Response) => {
    try {
      const loginId = String(req.body?.loginId ?? '').trim();
      const password = String(req.body?.password ?? '');

      if (!loginId || !password) {
        return res.status(400).json({ error: 'Login ID and password are required' });
      }

      if (!process.env.JWT_SECRET) {
        return res.status(500).json({ error: 'Server configuration error' });
      }

      // 1. Fetch User and verify Admin Credentials
      const [userRecord] = await db
        .select({
          id: users.id,
          email: users.email,
          status: users.status,
          isAdminAppUser: users.isAdminAppUser,
          adminAppLoginId: users.adminAppLoginId,
          adminAppHashedPassword: users.adminAppHashedPassword,
        })
        .from(users)
        .where(eq(users.adminAppLoginId, loginId))
        .limit(1);

      // Verify existence, active status, and specific admin flag
      if (!userRecord || !userRecord.isAdminAppUser) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      if (userRecord.status !== 'active') {
        return res.status(401).json({ error: 'Admin account is not active' });
      }

      if (userRecord.adminAppHashedPassword !== password) {
        return res.status(401).json({ error: 'Invalid admin credentials' });
      }

      // 2. Fetch Matrix Roles & Permissions via user_roles junction
      const userRolesData = await db
        .select({
          orgRole: roles.orgRole,
          jobRole: roles.jobRole,
          grantedPerms: roles.grantedPerms,
        })
        .from(userRoles)
        .innerJoin(roles, eq(userRoles.roleId, roles.id))
        .where(eq(userRoles.userId, userRecord.id));

      // 3. Aggregate matrix properties 
      // A user might technically have multiple roles in the junction table, 
      // so we use Sets to deduplicate permissions and roles.
      const permsSet = new Set<string>();
      const orgRolesSet = new Set<string>();
      const jobRolesSet = new Set<string>();

      userRolesData.forEach((row) => {
        if (row.orgRole) orgRolesSet.add(row.orgRole);
        if (row.jobRole) jobRolesSet.add(row.jobRole);
        
        // Extract permissions safely
        if (Array.isArray(row.grantedPerms)) {
          row.grantedPerms.forEach((perm) => permsSet.add(perm));
        } else if (typeof row.grantedPerms === 'string') {
           try {
             const parsed = JSON.parse(row.grantedPerms);
             if (Array.isArray(parsed)) parsed.forEach(p => permsSet.add(p));
           } catch (e) {}
        }
      });

      // Convert Sets back to arrays for the JWT payload
      const aggregatedPerms = Array.from(permsSet);
      const primaryOrgRole = Array.from(orgRolesSet)[0] || null;      
      const jobRolesList = Array.from(jobRolesSet).filter(Boolean);

      // 4. Create the Rich JWT
      const tokenPayload = {
        id: userRecord.id,
        email: userRecord.email,
        isAdmin: true, // Flag for middleware checks
        orgRole: primaryOrgRole,
        jobRole: jobRolesList,
        perms: aggregatedPerms, 
      };

      const token = sign(
        tokenPayload,
        process.env.JWT_SECRET,
        { expiresIn: '3d' } // Shorter expiration for admin panels is standard practice
      );

      // Return token and safe user data
      return res.json({
        success: true,
        token,
        user: {
          id: userRecord.id,
          email: userRecord.email,
          orgRole: primaryOrgRole,
          jobRole: jobRolesList,
          permissions: aggregatedPerms
        }
      });

    } catch (err) {
      console.error('Admin Login error:', err);
      return res.status(500).json({ error: 'Login failed due to a server error' });
    }
  });

  console.log('✅ Admin Auth routes loaded');
}