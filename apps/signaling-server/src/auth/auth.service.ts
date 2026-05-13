import { Injectable } from '@nestjs/common';

type AuthRole = 'camera' | 'viewer';

@Injectable()
export class AuthService {
  isValidToken(role: AuthRole, token: string) {
    if (role === 'camera') {
      return token === process.env.CAMERA_DEVICE_TOKEN;
    }

    return token === process.env.VIEWER_ACCESS_TOKEN;
  }
}
