import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { generateTurnCredentials } from './signaling/turn-credentials';

@Controller()
export class TurnController {
  @Post('/turn-credentials')
  create(@Headers('authorization') authorization?: string) {
    const token = authorization?.replace(/^Bearer\s+/i, '');
    const isAllowed =
      token === process.env.VIEWER_ACCESS_TOKEN ||
      token === process.env.CAMERA_DEVICE_TOKEN;

    if (!isAllowed) {
      throw new UnauthorizedException();
    }

    // TURN 凭证只返回短期签名结果，长期 shared secret 只保留在服务端。
    const credentials = generateTurnCredentials(
      process.env.TURN_SECRET ?? '',
      Number(process.env.TURN_TTL_SECONDS ?? 3600),
    );

    return {
      urls: (process.env.TURN_URLS ?? '').split(',').filter(Boolean),
      ...credentials,
    };
  }
}
