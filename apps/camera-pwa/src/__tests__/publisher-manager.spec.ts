import { describe, expect, it, vi } from 'vitest';
import { createPublisherManager } from '../lib/publisher-manager';

describe('createPublisherManager', () => {
  it('creates an offer for a joined viewer', async () => {
    const createOffer = vi.fn().mockResolvedValue({ type: 'offer', sdp: 'offer-sdp' });
    const setLocalDescription = vi.fn().mockResolvedValue(undefined);
    const addTrack = vi.fn();

    const manager = createPublisherManager({
      stream: { getTracks: () => [{ id: 'video-track' }, { id: 'audio-track' }] } as unknown as MediaStream,
      peerFactory: () =>
        ({
          createOffer,
          setLocalDescription,
          addTrack,
        }) as unknown as RTCPeerConnection,
    });

    const offer = await manager.createOfferForViewer('viewer-1');

    expect(addTrack).toHaveBeenCalledTimes(2);
    expect(setLocalDescription).toHaveBeenCalledWith(offer);
    expect(offer.sdp).toBe('offer-sdp');
  });
});
