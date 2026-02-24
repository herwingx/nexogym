import { Request, Response } from 'express';

export const handleControllerError = (
  req: Request,
  res: Response,
  error: unknown,
  logContext: string,
  message: string,
  statusCode = 500,
) => {
  req.log?.error({ err: error, requestId: req.requestId, path: req.path, method: req.method }, logContext);
  res.status(statusCode).json({ error: message });
};
