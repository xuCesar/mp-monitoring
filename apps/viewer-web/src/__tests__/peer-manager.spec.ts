import { describe, expect, it, vi } from 'vitest';
import { createViewerPeerManager } from '../lib/peer-manager';

describe('createViewerPeerManager', () => {
  it('creates an answer when an offer arrives', async () => {
    const setRemoteDescription = vi.fn().mockResolvedValue(undefined);
    const createAnswer = vi.fn().mockResolvedValue({ type: 'answer', sdp: 'answer-sdp' });
    const setLocalDescription = vi.fn().mockResolvedValue(undefined);

    const manager = createViewerPeerManager({
      peerFactory: () =>
        ({
          setRemoteDescription,
          createAnswer,
          setLocalDescription,
        }) as unknown as RTCPeerConnection,
    });

    const answer = await manager.acceptOffer({
      type: 'offer',
      sdp: 'offer-sdp',
    });

    expect(setRemoteDescription).toHaveBeenCalledWith({
      type: 'offer',
      sdp: 'offer-sdp',
    });
    expect(createAnswer).toHaveBeenCalled();
    expect(setLocalDescription).toHaveBeenCalledWith(answer);
    expect(answer.type).toBe('answer');
  });
});
