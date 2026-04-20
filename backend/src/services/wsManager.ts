type WsConnection = { socket: { send: (data: string) => void; readyState: number } };

class WsManager {
  private connections = new Map<string, Set<WsConnection>>();

  register(userId: string, conn: WsConnection) {
    if (!this.connections.has(userId)) {
      this.connections.set(userId, new Set());
    }
    this.connections.get(userId)!.add(conn);
  }

  unregister(userId: string, conn: WsConnection) {
    const set = this.connections.get(userId);
    if (!set) return;
    set.delete(conn);
    if (set.size === 0) this.connections.delete(userId);
  }

  emit(userId: string, payload: unknown) {
    const set = this.connections.get(userId);
    if (!set) return;
    const data = JSON.stringify(payload);
    for (const conn of set) {
      if (conn.socket.readyState === 1) {
        try {
          conn.socket.send(data);
        } catch {
          // ignore send errors — connection may be closing
        }
      }
    }
  }

  broadcast(payload: unknown) {
    for (const userId of this.connections.keys()) {
      this.emit(userId, payload);
    }
  }
}

export const wsManager = new WsManager();
