import type { Request, Response } from 'express';

import { authService } from '../services/auth.service.js';
import { asyncHandler } from '../utils/async-handler.js';

const register = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.register(req.body);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    data: result
  });
});

const login = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.login(req.body, {
    userAgent: req.get('user-agent') ?? null,
    ipAddress: req.ip || null
  });

  res.status(200).json({
    success: true,
    message: 'User logged in successfully',
    data: result
  });
});

const refresh = asyncHandler(async (req: Request, res: Response) => {
  const result = await authService.refresh(req.body.refreshToken, {
    userAgent: req.get('user-agent') ?? null,
    ipAddress: req.ip || null
  });

  res.status(200).json({
    success: true,
    message: 'Token refreshed successfully',
    data: result
  });
});

const logout = asyncHandler(async (req: Request, res: Response) => {
  await authService.logout(req.body.refreshToken);

  res.status(200).json({
    success: true,
    message: 'User logged out successfully'
  });
});

const logoutAll = asyncHandler(async (req: Request, res: Response) => {
  await authService.logoutAll(req.user.id);

  res.status(200).json({
    success: true,
    message: 'All sessions revoked successfully'
  });
});

export const authController = {
  register,
  login,
  refresh,
  logout,
  logoutAll
} as const;
