import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { TurnController } from '../src/turn.controller';

describe('TurnController', () => {
  let controller: TurnController;

  beforeAll(async () => {
    process.env.VIEWER_ACCESS_TOKEN = 'viewer-token';
    process.env.CAMERA_DEVICE_TOKEN = 'camera-token';
    process.env.TURN_SECRET = 'turn-secret';
    process.env.TURN_TTL_SECONDS = '3600';
    process.env.TURN_URLS = 'turn:monitor.example.com:3478?transport=udp';

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    controller = moduleRef.get(TurnController);
  });

  it('returns short-lived credentials for authorized callers', async () => {
    const response = controller.create('Bearer viewer-token');

    expect(response.urls).toEqual(['turn:monitor.example.com:3478?transport=udp']);
    expect(response.username).toBeTruthy();
    expect(response.credential).toBeTruthy();
    expect(response.ttlSeconds).toBe(3600);
  });

  it('rejects unauthorized callers', async () => {
    expect(() => controller.create('Bearer wrong-token')).toThrow('Unauthorized');
  });
});
