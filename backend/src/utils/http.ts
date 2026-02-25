import { Request, Response } from 'express';

export const handleControllerError = (
  req: Request,
  res: Response,
  error: unknown,
  logContext: string,
  message: string,
  statusCode = 500,
) => {
  const err = error instanceof Error ? error : new Error(String(error));
  req.log?.error(
    { err, message: err.message, stack: err.stack, requestId: req.requestId, path: req.path, method: req.method },
    logContext,
  );
  const payload: { error: string; detail?: string } = { error: message };
  if (process.env.NODE_ENV !== 'production') {
    payload.detail = err.message;
  }
  res.status(statusCode).json(payload);
};
