import type { Request, Response } from 'express';
import { ZodError } from 'zod';

export interface SessionUser {
  userId: string;
  userName: string;
  userRole: string;
}

export function sessionUser(req: Request): SessionUser {
  const session = (req as any).session || {};
  return {
    userId: session.userId,
    userName: session.userName || 'Unknown',
    userRole: session.userRole || 'Unknown',
  };
}

/** Consistent error shape across the new modules. */
export function handleRouteError(res: Response, error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    });
  }

  const status = (error as any)?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 600) {
    return res.status(status).json({ error: (error as any).message || fallback });
  }

  console.error(`${fallback}:`, error);
  return res.status(500).json({ error: fallback });
}

/** Offset pagination with a hard server-side cap. */
export function paginate(req: Request, defaultLimit = 50, maxLimit = 200) {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(maxLimit, Math.max(1, Number(req.query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

export function pagedResponse<T>(items: T[], total: number, page: number, limit: number) {
  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      hasMore: page * limit < total,
    },
  };
}

/** Escapes user input before it is used inside a RegExp. */
export function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
