import { Request, Response, NextFunction } from 'express';
import { hasPermission } from './auth';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req as any).session?.userId) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    if (!allowedRoles.includes((req as any).session?.userRole || '')) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}

export function requirePermission(resource: string, action: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!(req as any).session?.userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const userRole = (req as any).session?.userRole;
    if (!hasPermission(userRole, resource, action)) {
      return res.status(403).json({ error: 'Insufficient permissions for this action' });
    }
    
    next();
  };
}

export function attachUser(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  if (session?.userId) {
    (req as any).user = {
      id: session.userId,
      role: session.userRole,
      name: session.userName,
      email: session.userEmail,
    };
  }
  next();
}

export function checkInactivityTimeout(req: Request, res: Response, next: NextFunction) {
  const session = (req as any).session;
  
  if (session?.userId) {
    const userRole = session.userRole;
    const now = Date.now();
    const INACTIVITY_TIMEOUT = 30 * 60 * 1000;
    
    if (userRole !== 'Admin') {
      if (session.lastActivity) {
        const inactiveTime = now - session.lastActivity;
        
        if (inactiveTime > INACTIVITY_TIMEOUT) {
          session.destroy((err: any) => {
            if (err) {
              console.error('Error destroying session:', err);
            }
          });
          return res.status(401).json({ 
            error: 'Session expired due to inactivity',
            code: 'INACTIVITY_TIMEOUT'
          });
        }
      }
      
      session.lastActivity = now;
    }
  }
  
  next();
}
