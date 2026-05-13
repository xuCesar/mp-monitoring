import { useState } from 'react';
import { RemoteVideo } from './components/RemoteVideo';
import { ViewerStatus, type ViewerConnectionStatus } from './components/ViewerStatus';

export function App() {
  const [status] = useState<ViewerConnectionStatus>('connecting');

  return (
    <main>
      <h1>实时监控</h1>
      <ViewerStatus status={status} />
      <RemoteVideo />
    </main>
  );
}
